/**
 * Cosine Flood Risk Metric (CFRM) — метрика оценки паводкового риска.
 * Использует ТОЛЬКО параметры из обучения ML-модели:
 * лаги уровня воды и скользящие статистики (mean, std).
 */

import type { BridgeState } from './mockData';
import { lookupSensorValue } from './dataService';
import type { ForecastResult } from './forecastService';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RiskComponents {
  currentLevel: number;      // c1 [0,1] — близость к опасному уровню
  shortTrend: number;        // c2 [0,1] — краткосрочный тренд (lag_1 vs lag_3)
  mediumTrend: number;       // c3 [0,1] — среднесрочный тренд (lag_3 vs lag_12)
  longTrend: number;         // c4 [0,1] — долгосрочный тренд (lag_12 vs lag_48)
  shortVolatility: number;   // c5 [0,1] — краткосрочная волатильность (roll_std_3)
  mediumVolatility: number;  // c6 [0,1] — среднесрочная волатильность (roll_std_12)
  longVolatility: number;    // c7 [0,1] — долгосрочная волатильность (roll_std_48)
  shortMeanLevel: number;    // c8 [0,1] — средний уровень за 6ч (roll_mean_6)
  longMeanLevel: number;     // c9 [0,1] — средний уровень за 24ч (roll_mean_24)
}

export type CfrmRiskClass = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CfrmResult {
  score: number;           // 0–1
  riskClass: CfrmRiskClass;
  components: RiskComponents;
  componentValues: { name: string; value: number; contribution: number }[];
  explanations: string[];
  horizon: 'day' | 'week' | 'month';
}

export interface CombinedRisk {
  cfrm: CfrmResult;
  onnxForecast: ForecastResult | null;
  combinedScore: number;
  combinedClass: CfrmRiskClass;
  summary: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COMPONENT_NAMES = [
  'Текущий уровень',
  'Тренд (1–3ч)',
  'Тренд (3–12ч)',
  'Тренд (12–48ч)',
  'Волатильность (3ч)',
  'Волатильность (12ч)',
  'Волатильность (48ч)',
  'Средний ур. (6ч)',
  'Средний ур. (24ч)',
];

// Danger threshold in cm (lower = higher water for ultrasonic sensor)
const DANGER_LEVEL = 120;
const WARNING_LEVEL = 180;
// Max expected std deviation for normalization (in raw meters)
const MAX_STD = 0.15;
// Max trend rate for normalization (meters per hour-lag difference)
const MAX_TREND = 0.3;

const RISK_VECTOR_MAX = new Array(9).fill(1);
const NORM_MAX = Math.sqrt(9);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

function norm(v: number[]): number {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

/**
 * Get recent hourly water level values (raw, in meters) for a bridge.
 */
function getRecentValues(bridgeId: number, atMs: number, count: number): number[] {
  const sensorBridge = (bridgeId === 1 || bridgeId === 3) ? bridgeId : 1;
  const values: number[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const rec = lookupSensorValue(sensorBridge, atMs - i * 3600000);
    if (rec) values.push(rec.waterLevel);
  }
  return values;
}

function computeLag(values: number[], lag: number): number {
  const n = values.length;
  return lag <= n ? values[n - lag] : values[0] ?? 0;
}

function computeRollMean(values: number[], window: number): number {
  const n = values.length;
  const start = Math.max(0, n - window);
  const slice = values.slice(start, n);
  return slice.length > 0 ? slice.reduce((s, v) => s + v, 0) / slice.length : 0;
}

function computeRollStd(values: number[], window: number): number {
  const n = values.length;
  const start = Math.max(0, n - window);
  const slice = values.slice(start, n);
  if (slice.length === 0) return 0;
  const mean = slice.reduce((s, v) => s + v, 0) / slice.length;
  const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length;
  return Math.sqrt(variance);
}

// ─── Component computation ───────────────────────────────────────────────────

export function computeComponents(bridge: BridgeState, date: Date): RiskComponents {
  const values = getRecentValues(bridge.id, date.getTime(), 72);

  // Lags (raw meters, negative values — more negative = higher water)
  const lag1 = computeLag(values, 1);
  const lag3 = computeLag(values, 3);
  const lag12 = computeLag(values, 12);
  const lag48 = computeLag(values, 48);

  // Rolling means
  const rollMean6 = computeRollMean(values, 6);
  const rollMean24 = computeRollMean(values, 24);

  // Rolling stds
  const rollStd3 = computeRollStd(values, 3);
  const rollStd12 = computeRollStd(values, 12);
  const rollStd48 = computeRollStd(values, 48);

  // c1: Current level proximity to danger (using bridge.waterLevel in cm)
  // Lower cm value = higher water = more danger
  const currentLevel = clamp(1 - (bridge.waterLevel - DANGER_LEVEL) / (WARNING_LEVEL - DANGER_LEVEL));

  // c2–c4: Trends — negative delta means water is rising (values getting more negative)
  // Normalize: rising water (negative delta) → high risk
  const shortTrend = clamp(Math.abs(Math.min(0, lag1 - lag3)) / MAX_TREND);
  const mediumTrend = clamp(Math.abs(Math.min(0, lag3 - lag12)) / MAX_TREND);
  const longTrend = clamp(Math.abs(Math.min(0, lag12 - lag48)) / MAX_TREND);

  // c5–c7: Volatility — higher std = more unstable = higher risk
  const shortVolatility = clamp(rollStd3 / MAX_STD);
  const mediumVolatility = clamp(rollStd12 / MAX_STD);
  const longVolatility = clamp(rollStd48 / MAX_STD);

  // c8–c9: Mean levels — more negative mean = higher water = higher risk
  // Normalize using the same cm-based approach
  const meanCm6 = Math.round(Math.abs(rollMean6) * 100);
  const meanCm24 = Math.round(Math.abs(rollMean24) * 100);
  const shortMeanLevel = clamp(1 - (meanCm6 - DANGER_LEVEL) / (WARNING_LEVEL - DANGER_LEVEL));
  const longMeanLevel = clamp(1 - (meanCm24 - DANGER_LEVEL) / (WARNING_LEVEL - DANGER_LEVEL));

  return {
    currentLevel,
    shortTrend,
    mediumTrend,
    longTrend,
    shortVolatility,
    mediumVolatility,
    longVolatility,
    shortMeanLevel,
    longMeanLevel,
  };
}

// ─── CFRM Calculation ────────────────────────────────────────────────────────

function buildVector(c: RiskComponents): number[] {
  return [
    c.currentLevel,
    c.shortTrend,
    c.mediumTrend,
    c.longTrend,
    c.shortVolatility,
    c.mediumVolatility,
    c.longVolatility,
    c.shortMeanLevel,
    c.longMeanLevel,
  ];
}

export function classifyRisk(score: number): CfrmRiskClass {
  if (score < 0.3) return 'LOW';
  if (score < 0.6) return 'MEDIUM';
  if (score < 0.8) return 'HIGH';
  return 'CRITICAL';
}

export function getRiskClassLabel(cls: CfrmRiskClass): string {
  switch (cls) {
    case 'LOW': return 'Низкий риск';
    case 'MEDIUM': return 'Средний риск';
    case 'HIGH': return 'Повышенный риск';
    case 'CRITICAL': return 'Критический риск';
  }
}

export function getRiskClassColor(cls: CfrmRiskClass): string {
  switch (cls) {
    case 'LOW': return 'safe';
    case 'MEDIUM': return 'warning';
    case 'HIGH': return 'elevated';
    case 'CRITICAL': return 'danger';
  }
}

function generateExplanations(c: RiskComponents, score: number): string[] {
  const explanations: string[] = [];

  const factors = [
    { name: 'currentLevel', value: c.currentLevel },
    { name: 'shortTrend', value: c.shortTrend },
    { name: 'mediumTrend', value: c.mediumTrend },
    { name: 'longTrend', value: c.longTrend },
    { name: 'shortVolatility', value: c.shortVolatility },
    { name: 'mediumVolatility', value: c.mediumVolatility },
    { name: 'longVolatility', value: c.longVolatility },
    { name: 'shortMeanLevel', value: c.shortMeanLevel },
    { name: 'longMeanLevel', value: c.longMeanLevel },
  ].sort((a, b) => b.value - a.value);

  for (const f of factors.slice(0, 4)) {
    if (f.value < 0.15) continue;
    switch (f.name) {
      case 'currentLevel':
        explanations.push('Текущий уровень воды близок к опасной отметке');
        break;
      case 'shortTrend':
        explanations.push('Быстрый подъём воды за последние 1–3 часа');
        break;
      case 'mediumTrend':
        explanations.push('Устойчивый рост уровня за последние 3–12 часов');
        break;
      case 'longTrend':
        explanations.push('Долгосрочная тенденция к повышению уровня (12–48ч)');
        break;
      case 'shortVolatility':
        explanations.push('Высокая нестабильность уровня воды (последние 3ч)');
        break;
      case 'mediumVolatility':
        explanations.push('Повышенная волатильность уровня (12ч)');
        break;
      case 'longVolatility':
        explanations.push('Значительные колебания уровня за 48 часов');
        break;
      case 'shortMeanLevel':
        explanations.push('Средний уровень за 6ч остаётся высоким');
        break;
      case 'longMeanLevel':
        explanations.push('Средний уровень за 24ч указывает на повышенную водность');
        break;
    }
  }

  if (explanations.length === 0) {
    explanations.push('Все показатели в пределах нормы');
  }

  return explanations;
}

export function computeCfrm(
  bridge: BridgeState,
  date: Date,
  horizon: 'day' | 'week' | 'month' = 'day'
): CfrmResult {
  const components = computeComponents(bridge, date);
  const vPred = buildVector(components);

  const normPred = norm(vPred);
  let score = 0;
  if (normPred > 0) {
    const dot = dotProduct(RISK_VECTOR_MAX, vPred);
    score = clamp(dot / (NORM_MAX * normPred));
  }

  score = Math.round(score * 10000) / 10000;
  const riskClass = classifyRisk(score);

  const totalWeighted = vPred.reduce((s, v) => s + v, 0);
  const componentValues = COMPONENT_NAMES.map((name, i) => ({
    name,
    value: Math.round(vPred[i] * 100) / 100,
    contribution: totalWeighted > 0
      ? Math.round((vPred[i] / totalWeighted) * 100) / 100
      : 0,
  }));

  return {
    score,
    riskClass,
    components,
    componentValues,
    explanations: generateExplanations(components, score),
    horizon,
  };
}

// ─── Combined Risk ───────────────────────────────────────────────────────────

export function computeCombinedRisk(
  bridge: BridgeState,
  date: Date,
  forecast: ForecastResult | null
): CombinedRisk {
  const cfrm = computeCfrm(bridge, date, 'day');

  let forecastRisk = 0;
  if (forecast) {
    const minForecast = Math.min(forecast.h6, forecast.h24, forecast.h72);
    if (minForecast < 120) forecastRisk = 0.9;
    else if (minForecast < 150) forecastRisk = 0.7;
    else if (minForecast < 180) forecastRisk = 0.4;
    else forecastRisk = 0.1;
  }

  const combinedScore = clamp(
    forecast ? cfrm.score * 0.6 + forecastRisk * 0.4 : cfrm.score
  );
  const combinedClass = classifyRisk(combinedScore);

  const classLabel = getRiskClassLabel(combinedClass);
  let summary: string;
  if (combinedClass === 'CRITICAL') {
    summary = 'Критическая паводковая ситуация. Требуется немедленное реагирование.';
  } else if (combinedClass === 'HIGH') {
    summary = 'Повышенный риск паводка. Рекомендуется подготовка к возможному ухудшению.';
  } else if (combinedClass === 'MEDIUM') {
    summary = 'Умеренный риск. Необходимо продолжить наблюдение за обстановкой.';
  } else {
    summary = 'Паводковая обстановка стабильная. Угрозы не прогнозируется.';
  }

  return {
    cfrm,
    onnxForecast: forecast,
    combinedScore: Math.round(combinedScore * 10000) / 10000,
    combinedClass,
    summary,
  };
}
