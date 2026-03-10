import {
  lookupSensorValue,
  dataLoaded,
  dataStartMs,
  dataEndMs,
  getRealHistory,
  getRealForecast,
} from './dataService';

export type RiskLevel = 'safe' | 'warning' | 'danger';

export interface Bridge {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  baseLevel: number;
}

export interface BridgeState {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  waterLevel: number;
  trend: number; // cm change vs 3h ago (negative = water rising)
  trendLabel: string;
  risk: RiskLevel;
  temperature: number;
  precipitation: number;
  riskProbability: number;
  description: string;
  floodRiskIndex: number; // 0-100
  timeToCritical: number | null; // hours until danger, null if not applicable
}

export interface Notification {
  id: string;
  level: 'info' | 'warning' | 'critical';
  bridgeId: number | null;
  bridgeName: string | null;
  time: Date;
  message: string;
}

export const bridges: Bridge[] = [
  { id: 1, name: 'Мост №1 (Качинский)', latitude: 56.055194, longitude: 92.849541, baseLevel: 230 },
  { id: 2, name: 'Мост №2 (Качинский-2)', latitude: 56.055089, longitude: 92.849443, baseLevel: 225 },
  { id: 3, name: 'Мост №3 (ул. Ленина)', latitude: 56.041981, longitude: 92.837895, baseLevel: 108 },
  { id: 4, name: 'Мост №4 (ул. Ленина-2)', latitude: 56.041933, longitude: 92.837641, baseLevel: 115 },
  { id: 5, name: 'Мост №5 (ул. Маркса)', latitude: 56.035662, longitude: 92.832438, baseLevel: 165 },
  { id: 6, name: 'Мост №6 (ул. Маркса-2)', latitude: 56.035424, longitude: 92.832358, baseLevel: 158 },
  { id: 7, name: 'Мост №7 (Перенсона)', latitude: 56.031382, longitude: 92.835985, baseLevel: 172 },
  { id: 8, name: 'Мост №8 (ул. Горького)', latitude: 56.025501, longitude: 92.842188, baseLevel: 215 },
  { id: 9, name: 'Мост №9 (Профсоюзов)', latitude: 56.016898, longitude: 92.853078, baseLevel: 102 },
  { id: 10, name: 'Мост №10 (Покровка)', latitude: 56.017247, longitude: 92.865712, baseLevel: 195 },
  { id: 11, name: 'Мост №11 (Покровка-2)', latitude: 56.017958, longitude: 92.869607, baseLevel: 205 },
  { id: 12, name: 'Мост №12 (ул. Павлова)', latitude: 56.018107, longitude: 92.875531, baseLevel: 240 },
  { id: 13, name: 'Мост №13 (Николаевка)', latitude: 56.015563, longitude: 92.894825, baseLevel: 152 },
  { id: 14, name: 'Мост №14 (Николаевка-2)', latitude: 56.015233, longitude: 92.896581, baseLevel: 178 },
];

const BRIDGE1_BASE = 230;

export function getRiskLevel(wl: number): RiskLevel {
  if (wl < 120) return 'danger';
  if (wl < 180) return 'warning';
  return 'safe';
}

export function getRiskLabel(risk: RiskLevel): string {
  return risk === 'safe' ? 'Норма' : risk === 'warning' ? 'Внимание' : 'Опасно';
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function getRiskDescription(risk: RiskLevel, trend: number): string {
  if (risk === 'danger') {
    return trend < 0
      ? 'Критический уровень воды. Прогнозируется дальнейший рост.'
      : 'Критический уровень воды. Ожидается стабилизация.';
  }
  if (risk === 'warning') {
    return trend < 0
      ? 'Повышенный уровень воды. Наблюдается рост.'
      : 'Повышенный уровень воды. Состояние стабильное.';
  }
  return trend < 0
    ? 'Уровень воды в норме. Прогнозируется незначительный рост.'
    : 'Состояние стабильное. Угрозы нет.';
}

function getTrendLabel(trendCm: number): string {
  if (trendCm < -10) return '↑ быстро растёт';
  if (trendCm < -3) return '↑ растёт';
  if (trendCm > 10) return '↓ быстро снижается';
  if (trendCm > 3) return '↓ снижается';
  return '→ стабильно';
}

/**
 * Compute flood risk index 0-100 from water level, trend, precipitation.
 */
function computeFloodRiskIndex(wl: number, trendCm: number, precipitation: number): number {
  // Water level component: 180=0%, 120=70%, <80=100%
  let levelScore = 0;
  if (wl < 120) levelScore = 70 + Math.min(30, (120 - wl) / 40 * 30);
  else if (wl < 180) levelScore = ((180 - wl) / 60) * 70;

  // Trend component: rising water adds up to 15 points
  let trendScore = 0;
  if (trendCm < 0) trendScore = Math.min(15, Math.abs(trendCm) / 10 * 15);

  // Precipitation component: up to 15 points
  let precipScore = Math.min(15, precipitation / 5 * 15);

  return Math.min(100, Math.round(levelScore + trendScore + precipScore));
}

/**
 * Estimate hours until critical level (120cm) based on current trend.
 * Returns null if water is not rising or already critical.
 */
function estimateTimeToCritical(wl: number, trendPer3h: number): number | null {
  if (wl < 120) return 0; // Already critical
  if (trendPer3h >= 0) return null; // Not rising
  const ratePerHour = trendPer3h / 3;
  const cmToGo = wl - 120;
  const hours = cmToGo / Math.abs(ratePerHour);
  return Math.round(hours);
}

export function getWaterLevel(bridgeId: number, date: Date): number {
  if (!dataLoaded) return getWaterLevelSynthetic(bridgeId, date);

  const bridge = bridges.find((b) => b.id === bridgeId)!;
  const dateMs = date.getTime();

  let rec = lookupSensorValue(bridgeId, dateMs);
  if (rec) return rec.waterLevelCm;

  const b1rec = lookupSensorValue(1, dateMs);
  if (b1rec) {
    const offset = bridge.baseLevel - BRIDGE1_BASE;
    const noise = pseudoRandom(bridgeId * 137 + Math.floor(dateMs / 3600000)) * 10 - 5;
    return Math.max(50, Math.round(b1rec.waterLevelCm + offset + noise));
  }

  return getWaterLevelSynthetic(bridgeId, date);
}

function getWaterLevelSynthetic(bridgeId: number, date: Date): number {
  const bridge = bridges.find((b) => b.id === bridgeId)!;
  const base = bridge.baseLevel;
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
  const hour = date.getHours() + date.getMinutes() / 60;
  const seasonal = -55 * Math.exp(-Math.pow(dayOfYear - 115, 2) / 500);
  const daily = 5 * Math.sin(((hour - 6) * Math.PI) / 12);
  const dayNum = Math.floor(date.getTime() / 86400000);
  const noise = pseudoRandom(bridgeId * 137 + dayNum * 17 + Math.floor(hour) * 3) * 14 - 7;
  return Math.max(50, Math.round(base + seasonal + daily + noise));
}

function getTemperature(bridgeId: number, date: Date): number {
  if (dataLoaded) {
    let rec = lookupSensorValue(bridgeId, date.getTime());
    if (rec) return rec.temperature;
    rec = lookupSensorValue(1, date.getTime());
    if (rec) return rec.temperature;
  }
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const base = -15 + 25 * Math.sin(((dayOfYear - 80) * Math.PI) / 183);
  return Math.round(base + pseudoRandom(dayOfYear * 31) * 6 - 3);
}

function getPrecipitation(bridgeId: number, date: Date): number {
  if (dataLoaded) {
    let rec = lookupSensorValue(bridgeId, date.getTime());
    if (rec) return rec.precipitation;
    rec = lookupSensorValue(1, date.getTime());
    if (rec) return rec.precipitation;
  }
  const dayNum = Math.floor(date.getTime() / 86400000);
  const val = pseudoRandom(bridgeId * 53 + dayNum * 29);
  return val > 0.7 ? Math.round(val * 100) / 10 : 0;
}

export function getBridgeStates(date: Date): BridgeState[] {
  return bridges.map((b) => {
    const waterLevel = getWaterLevel(b.id, date);
    const risk = getRiskLevel(waterLevel);
    const pastLevel = getWaterLevel(b.id, new Date(date.getTime() - 3 * 3600000));
    const trend = waterLevel - pastLevel;
    const precipitation = getPrecipitation(b.id, date);

    return {
      id: b.id,
      name: b.name,
      latitude: b.latitude,
      longitude: b.longitude,
      waterLevel,
      trend,
      trendLabel: getTrendLabel(trend),
      risk,
      temperature: getTemperature(b.id, date),
      precipitation,
      riskProbability:
        risk === 'danger'
          ? 85 + Math.round(pseudoRandom(b.id * 7) * 15)
          : risk === 'warning'
          ? 40 + Math.round(pseudoRandom(b.id * 11) * 30)
          : Math.round(pseudoRandom(b.id * 13) * 15),
      description: getRiskDescription(risk, trend),
      floodRiskIndex: computeFloodRiskIndex(waterLevel, trend, precipitation),
      timeToCritical: estimateTimeToCritical(waterLevel, trend),
    };
  });
}

export function getHistory(
  bridgeId: number,
  centerDate: Date,
  hours = 48
): { time: string; value: number }[] {
  if (dataLoaded) {
    const result = getRealHistory(bridgeId, centerDate, hours);
    if (result.length > 0) return result;
  }
  return Array.from({ length: hours }, (_, i) => {
    const t = new Date(centerDate.getTime() - (hours - 1 - i) * 3600000);
    return { time: t.toISOString(), value: getWaterLevel(bridgeId, t) };
  });
}

export function getForecast(
  bridgeId: number,
  fromDate: Date,
  hours = 72
): { time: string; value: number }[] {
  if (dataLoaded) {
    const result = getRealForecast(bridgeId, fromDate, hours);
    if (result.length > 0) return result;
  }
  return Array.from({ length: hours }, (_, i) => {
    const t = new Date(fromDate.getTime() + (i + 1) * 3600000);
    return { time: t.toISOString(), value: getWaterLevel(bridgeId, t) };
  });
}

export function generateNotifications(states: BridgeState[], date: Date): Notification[] {
  const notifs: Notification[] = [];

  states.forEach((b) => {
    if (b.risk === 'danger') {
      notifs.push({
        id: `danger-${b.id}`,
        level: 'critical',
        bridgeId: b.id,
        bridgeName: b.name,
        time: date,
        message: `Критический уровень воды (${b.waterLevel} см). Есть риск подтопления.`,
      });
    }
    if (b.risk === 'warning') {
      notifs.push({
        id: `warn-${b.id}`,
        level: 'warning',
        bridgeId: b.id,
        bridgeName: b.name,
        time: new Date(date.getTime() - 1800000),
        message: `Повышенный уровень воды (${b.waterLevel} см). Требуется наблюдение.`,
      });
    }
    if (b.trend < -10 && b.risk === 'safe') {
      notifs.push({
        id: `trend-${b.id}`,
        level: 'info',
        bridgeId: b.id,
        bridgeName: b.name,
        time: date,
        message: `Быстрый подъём воды: ${Math.abs(b.trend)} см за 3 часа.`,
      });
    }
    if (b.timeToCritical !== null && b.timeToCritical > 0 && b.timeToCritical < 24) {
      notifs.push({
        id: `ttc-${b.id}`,
        level: 'warning',
        bridgeId: b.id,
        bridgeName: b.name,
        time: date,
        message: `Прогноз: до критического уровня ~${b.timeToCritical}ч.`,
      });
    }
  });

  if (states.some((b) => b.precipitation > 3)) {
    const maxPrecip = Math.max(...states.map(b => b.precipitation));
    notifs.push({
      id: 'rain-warning',
      level: 'warning',
      bridgeId: null,
      bridgeName: null,
      time: new Date(date.getTime() - 3600000),
      message: `Обильные осадки (${maxPrecip} мм) — возможен подъём воды.`,
    });
  }

  return notifs.sort((a, b) => b.time.getTime() - a.time.getTime());
}

/** Generate event log entries */
export interface EventLogEntry {
  time: Date;
  type: 'danger' | 'warning' | 'rain' | 'trend' | 'info';
  message: string;
  bridgeId?: number;
}

export function generateEventLog(states: BridgeState[], date: Date): EventLogEntry[] {
  const events: EventLogEntry[] = [];

  states.forEach(b => {
    if (b.risk === 'danger') {
      events.push({
        time: new Date(date.getTime() - pseudoRandom(b.id * 31) * 3600000),
        type: 'danger',
        message: `${b.name}: критический уровень ${b.waterLevel} см`,
        bridgeId: b.id,
      });
    }
    if (b.risk === 'warning') {
      events.push({
        time: new Date(date.getTime() - 1800000 - pseudoRandom(b.id * 41) * 5400000),
        type: 'warning',
        message: `${b.name}: повышенный уровень ${b.waterLevel} см`,
        bridgeId: b.id,
      });
    }
    if (b.trend < -8) {
      events.push({
        time: new Date(date.getTime() - 900000 - pseudoRandom(b.id * 53) * 3600000),
        type: 'trend',
        message: `${b.name}: подъём воды ${Math.abs(b.trend)} см / 3ч`,
        bridgeId: b.id,
      });
    }
    if (b.precipitation > 3) {
      events.push({
        time: new Date(date.getTime() - 2400000 - pseudoRandom(b.id * 67) * 7200000),
        type: 'rain',
        message: `Осадки ${b.precipitation} мм в районе ${b.name}`,
        bridgeId: b.id,
      });
    }
  });

  // Always add a system info event
  events.push({
    time: new Date(date.getTime() - 7200000),
    type: 'info',
    message: 'Данные сенсоров обновлены',
  });

  return events.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 20);
}

export const riverCoordinates: [number, number][] = [
  [92.905, 56.013],
  [92.896, 56.015],
  [92.890, 56.016],
  [92.882, 56.017],
  [92.876, 56.018],
  [92.870, 56.018],
  [92.866, 56.017],
  [92.860, 56.0168],
  [92.853, 56.017],
  [92.849, 56.019],
  [92.845, 56.022],
  [92.842, 56.0255],
  [92.839, 56.028],
  [92.836, 56.031],
  [92.834, 56.033],
  [92.832, 56.0357],
  [92.833, 56.038],
  [92.835, 56.040],
  [92.838, 56.042],
  [92.840, 56.044],
  [92.842, 56.047],
  [92.845, 56.050],
  [92.847, 56.053],
  [92.849, 56.055],
  [92.850, 56.057],
  [92.851, 56.059],
];

export function getDataTimeRange(): { start: Date; end: Date } | null {
  if (!dataLoaded || !dataStartMs || !dataEndMs) return null;
  return { start: new Date(dataStartMs), end: new Date(dataEndMs) };
}

export function getMode(date: Date): 'history' | 'current' | 'forecast' {
  if (!dataLoaded) {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff > 3600000) return 'forecast';
    if (diff < -3600000) return 'history';
    return 'current';
  }
  const range = dataEndMs - dataStartMs;
  const pos = date.getTime() - dataStartMs;
  const ratio = pos / range;
  if (ratio > 0.8) return 'forecast';
  if (ratio < 0.2) return 'history';
  return 'current';
}

export function getModeLabel(mode: 'history' | 'current' | 'forecast'): string {
  return mode === 'history' ? 'История' : mode === 'current' ? 'Текущее' : 'Прогноз';
}
