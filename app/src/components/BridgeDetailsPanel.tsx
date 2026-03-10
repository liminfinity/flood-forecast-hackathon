import { X, Thermometer, CloudRain, Waves, Cpu, Clock, TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import type { BridgeState } from '@/data/mockData';
import { getRiskLabel, getHistory, getForecast } from '@/data/mockData';
import { WaterChart } from './WaterChart';
import { FloodRiskGauge } from './FloodRiskGauge';
import { HelpTooltip } from './HelpTooltip';
import { RiskScoreBadge } from './RiskScoreBadge';
import { RiskFactorsPanel } from './RiskFactorsPanel';
import { ModelExplanation } from './ModelExplanation';
import { CombinedForecastPanel } from './CombinedForecastPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, useState, useEffect } from 'react';
import { getForecastValues, type ForecastResult } from '@/data/forecastService';
import { computeCombinedRisk, type CombinedRisk } from '@/data/cfrmService';
import { useIsMobile } from '@/hooks/use-mobile';

interface Props {
  bridge: BridgeState | null;
  selectedDate: Date;
  onClose: () => void;
}

const riskBadge: Record<string, string> = {
  safe: 'bg-safe-light text-safe',
  warning: 'bg-warning-light text-warning',
  danger: 'bg-danger-light text-danger',
};

function TrendIcon({ trend }: { trend: number }) {
  if (trend < -3) return <TrendingUp className="h-3.5 w-3.5 text-danger" />;
  if (trend > 3) return <TrendingDown className="h-3.5 w-3.5 text-safe" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function BridgeDetailsPanel({ bridge, selectedDate, onClose }: Props) {
  const history = useMemo(() => (bridge ? getHistory(bridge.id, selectedDate, 48) : []), [bridge, selectedDate]);
  const forecast = useMemo(() => (bridge ? getForecast(bridge.id, selectedDate, 72) : []), [bridge, selectedDate]);
  const isMobile = useIsMobile();

  const [pred, setPred] = useState<ForecastResult | null>(null);
  const [combinedRisk, setCombinedRisk] = useState<CombinedRisk | null>(null);

  useEffect(() => {
    if (!bridge) { setPred(null); setCombinedRisk(null); return; }
    getForecastValues(bridge.id, selectedDate.getTime()).then(result => {
      setPred(result);
      setCombinedRisk(computeCombinedRisk(bridge, selectedDate, result));
    });
  }, [bridge, selectedDate]);

  // Mobile bottom sheet
  if (isMobile) {
    return (
      <AnimatePresence>
        {bridge && (
          <>
            <div className="fixed inset-0 z-[999] bg-foreground/10 backdrop-blur-sm" onClick={onClose} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-[1000] flex flex-col bg-card rounded-t-2xl shadow-xl border-t border-border"
              style={{ maxHeight: '85vh' }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-2 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2 shrink-0">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{bridge.name}</h2>
                  <p className="text-[10px] text-muted-foreground">Сенсор #{bridge.id}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${riskBadge[bridge.risk]}`}>
                  {getRiskLabel(bridge.risk)}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
                {renderContent(bridge, pred, combinedRisk, history, forecast)}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Desktop/tablet side panel
  return (
    <AnimatePresence>
      {bridge && (
        <>
          <div className="fixed inset-0 z-[999] bg-foreground/10 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 z-[1000] flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-xl sm:w-[420px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-foreground">{bridge.name}</h2>
                <p className="text-xs text-muted-foreground">
                  Сенсор #{bridge.id} • {bridge.latitude.toFixed(4)}, {bridge.longitude.toFixed(4)}
                </p>
              </div>
              <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {renderContent(bridge, pred, combinedRisk, history, forecast)}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function renderContent(
  bridge: BridgeState,
  pred: ForecastResult | null,
  combinedRisk: CombinedRisk | null,
  history: any[],
  forecast: any[]
) {
  return (
    <>
      {/* Level + Status + Trend */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-water-light">
          <Waves className="h-5 w-5 text-water" />
        </div>
        <div>
          <div className="flex items-center gap-1">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Уровень воды</p>
            <HelpTooltip text="Расстояние от датчика до поверхности воды. Чем меньше значение — тем выше вода." />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xl sm:text-2xl font-bold text-foreground">{bridge.waterLevel} см</p>
            <div className="flex items-center gap-1">
              <TrendIcon trend={bridge.trend} />
              <span className="text-[10px] sm:text-[11px] text-muted-foreground">{bridge.trendLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* CFRM Risk Score Badge */}
      {combinedRisk && (
        <div className="flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] sm:text-[11px] text-muted-foreground">Индекс CFRM:</span>
          <RiskScoreBadge score={combinedRisk.cfrm.score} riskClass={combinedRisk.cfrm.riskClass} size="sm" />
        </div>
      )}

      {/* Combined Forecast Panel */}
      {combinedRisk && (
        <CombinedForecastPanel combined={combinedRisk} currentLevel={bridge.waterLevel} />
      )}

      {/* Flood risk gauge + Time to critical */}
      <div className="flex items-center gap-3 sm:gap-4 rounded-lg border border-border p-2.5 sm:p-3">
        <FloodRiskGauge value={bridge.floodRiskIndex} size={70} />
        <div className="flex-1 space-y-1.5">
          <div>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground">Индекс паводковой опасности</p>
            <p className="text-xs sm:text-sm font-semibold text-foreground">{bridge.floodRiskIndex} / 100</p>
          </div>
          {bridge.timeToCritical !== null && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-warning" />
              <p className="text-[10px] sm:text-[11px] text-foreground">
                {bridge.timeToCritical === 0
                  ? 'Критический уровень достигнут'
                  : `До критического уровня ~${bridge.timeToCritical}ч`}
              </p>
            </div>
          )}
          {bridge.timeToCritical === null && bridge.risk === 'safe' && (
            <p className="text-[10px] sm:text-[11px] text-safe">Угрозы нет</p>
          )}
        </div>
      </div>

      {/* Trend detail */}
      {bridge.trend !== 0 && (
        <div className="rounded-lg bg-muted/50 p-2.5 sm:p-3">
          <p className="text-[11px] sm:text-xs font-medium text-foreground">Динамика уровня воды</p>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1">
            {bridge.trend < 0
              ? `Рост уровня: +${Math.abs(bridge.trend)} см за 3 часа`
              : `Снижение уровня: -${bridge.trend} см за 3 часа`}
          </p>
        </div>
      )}

      {/* Weather */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border p-2.5 sm:p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Thermometer className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="text-[10px] sm:text-[11px]">Температура</span>
          </div>
          <p className="mt-1 text-sm sm:text-base font-semibold text-foreground">{bridge.temperature}°C</p>
        </div>
        <div className="rounded-lg border border-border p-2.5 sm:p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CloudRain className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="text-[10px] sm:text-[11px]">Осадки</span>
          </div>
          <p className="mt-1 text-sm sm:text-base font-semibold text-foreground">{bridge.precipitation} мм</p>
        </div>
      </div>

      {/* Chart */}
      <div>
        <div className="flex items-center gap-1 mb-2">
          <h3 className="text-[10px] sm:text-xs font-medium text-muted-foreground">
            Уровень воды — 48ч история и 72ч прогноз
          </h3>
          <HelpTooltip text="График показывает историю и прогноз уровня воды. Ось Y инвертирована: чем ниже линия — тем выше вода." />
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-1.5 sm:p-2">
          <WaterChart history={history} forecast={forecast} />
        </div>
        <div className="mt-1.5 sm:mt-2 flex gap-3 sm:gap-4 text-[9px] sm:text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 sm:w-4 rounded bg-water" /> Факт
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 sm:w-4 rounded border-t-2 border-dashed border-water" /> Прогноз
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 sm:w-4 rounded border-t border-dashed border-warning" /> Порог
          </span>
        </div>
      </div>

      {/* Forecast cards */}
      <div>
        <div className="flex items-center gap-1 mb-2">
          <h3 className="text-[10px] sm:text-xs font-medium text-muted-foreground">Прогноз ML-модели</h3>
          {pred && (
            <span className={`ml-1 rounded px-1.5 py-0.5 text-[8px] sm:text-[9px] font-medium ${
              pred.source === 'onnx' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {pred.source === 'onnx' ? 'CatBoost ONNX' : 'Baseline'}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {[
            { label: '+6ч', value: pred?.h6 },
            { label: '+24ч', value: pred?.h24 },
            { label: '+72ч', value: pred?.h72 },
          ].map(f => (
            <div key={f.label} className="rounded-lg border border-border p-2 sm:p-2.5 text-center">
              <p className="text-[9px] sm:text-[10px] text-muted-foreground">{f.label}</p>
              <p className="mt-0.5 text-sm sm:text-base font-semibold text-foreground">
                {f.value != null ? `${f.value} см` : '…'}
              </p>
            </div>
          ))}
        </div>
        {pred?.source === 'onnx' && (
          <div className="mt-1.5 flex items-center gap-1 text-[9px] sm:text-[10px] text-primary">
            <Cpu className="h-3 w-3" />
            Предсказание выполнено моделью CatBoost в браузере
          </div>
        )}
      </div>

      {/* ── Аналитика модели ── */}
      {combinedRisk && (
        <>
          <div className="border-t border-border pt-3 sm:pt-4">
            <div className="flex items-center gap-1.5 mb-3">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-[11px] sm:text-xs font-semibold text-foreground">Аналитика математической модели</h3>
              <span className="ml-1 rounded px-1.5 py-0.5 text-[8px] sm:text-[9px] font-medium bg-primary/15 text-primary">
                CFRM v1.0
              </span>
            </div>
            <RiskFactorsPanel cfrm={combinedRisk.cfrm} />
          </div>
          <ModelExplanation explanations={combinedRisk.cfrm.explanations} />
        </>
      )}

      {/* Forecast explanation */}
      <div className="rounded-lg bg-muted/50 p-2.5 sm:p-3">
        <p className="text-[11px] sm:text-xs font-medium text-foreground mb-1.5">Основные факторы прогноза</p>
        <div className="space-y-1 text-[10px] sm:text-[11px] text-muted-foreground">
          <p>• Осадки за 24 часа: <span className="text-foreground font-medium">{bridge.precipitation} мм</span></p>
          <p>• Уровень воды 6ч назад: <span className="text-foreground font-medium">{bridge.waterLevel + bridge.trend} см</span></p>
          <p>• Температура: <span className="text-foreground font-medium">{bridge.temperature}°C</span></p>
          <p>• Тренд изменения: <span className="text-foreground font-medium">{bridge.trendLabel}</span></p>
        </div>
      </div>
    </>
  );
}

