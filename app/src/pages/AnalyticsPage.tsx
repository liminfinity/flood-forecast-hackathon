import { useMemo } from 'react';
import { BarChart3, ArrowLeft, Shield, AlertTriangle, Activity } from 'lucide-react';
import type { BridgeState } from '@/data/mockData';
import { computeCfrm, getRiskClassLabel, type CfrmResult } from '@/data/cfrmService';
import { RiskScoreBadge } from '@/components/RiskScoreBadge';
import { RiskFactorsPanel } from '@/components/RiskFactorsPanel';
import { motion } from 'framer-motion';

interface Props {
  bridgeStates: BridgeState[];
  selectedDate: Date;
  onBridgeClick: (id: number) => void;
  onBack: () => void;
}

interface BridgeCfrm {
  bridge: BridgeState;
  cfrm: CfrmResult;
}

export default function AnalyticsPage({ bridgeStates, selectedDate, onBridgeClick, onBack }: Props) {
  const data: BridgeCfrm[] = useMemo(() => {
    return bridgeStates
      .map(b => ({ bridge: b, cfrm: computeCfrm(b, selectedDate, 'day') }))
      .sort((a, b) => b.cfrm.score - a.cfrm.score);
  }, [bridgeStates, selectedDate]);

  const avgScore = data.length > 0
    ? data.reduce((s, d) => s + d.cfrm.score, 0) / data.length
    : 0;

  const critCount = data.filter(d => d.cfrm.riskClass === 'CRITICAL').length;
  const highCount = data.filter(d => d.cfrm.riskClass === 'HIGH').length;
  const medCount = data.filter(d => d.cfrm.riskClass === 'MEDIUM').length;
  const lowCount = data.filter(d => d.cfrm.riskClass === 'LOW').length;

  const topBridge = data[0] ?? null;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/90 backdrop-blur-sm px-3 py-2.5 sm:px-6 sm:py-3 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={onBack} className="rounded-lg p-1.5 sm:p-2 text-muted-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          <div>
            <h2 className="text-sm sm:text-base font-bold text-foreground">Математическая модель CFRM</h2>
            <p className="text-[9px] sm:text-[11px] text-muted-foreground">Cosine Flood Risk Metric — оценка паводкового риска</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-5">
        {/* Summary stats */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2.5">
          {[
            { label: 'Ср. CFRM', value: avgScore.toFixed(2), icon: Activity, cls: 'text-primary' },
            { label: 'Критич.', value: critCount, icon: AlertTriangle, cls: 'text-danger' },
            { label: 'Повыш.', value: highCount, icon: AlertTriangle, cls: 'text-elevated' },
            { label: 'Средний', value: medCount, icon: Shield, cls: 'text-warning' },
            { label: 'Низкий', value: lowCount, icon: Shield, cls: 'text-safe' },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-1.5 sm:gap-2.5 rounded-lg border border-border bg-card p-2 sm:p-3 shadow-sm"
            >
              <card.icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 ${card.cls}`} />
              <div>
                <p className="text-sm sm:text-lg font-bold text-foreground leading-tight">{card.value}</p>
                <p className="text-[8px] sm:text-[10px] text-muted-foreground">{card.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Risk distribution by bridge */}
        <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
          <h3 className="text-[11px] sm:text-xs font-semibold text-foreground mb-2 sm:mb-3">Распределение риска по мостам</h3>
          <div className="space-y-1.5 sm:space-y-2">
            {data.map(({ bridge, cfrm }) => (
              <div
                key={bridge.id}
                className="flex items-center gap-2 sm:gap-3 rounded-lg p-1.5 sm:p-2 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onBridgeClick(bridge.id)}
              >
                <div className="w-28 sm:w-40 shrink-0">
                  <p className="text-[10px] sm:text-[11px] font-medium text-foreground truncate">{bridge.name}</p>
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground">{bridge.waterLevel} см</p>
                </div>
                <div className="flex-1 h-2.5 sm:h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      cfrm.riskClass === 'CRITICAL' ? 'bg-danger' :
                      cfrm.riskClass === 'HIGH' ? 'bg-elevated' :
                      cfrm.riskClass === 'MEDIUM' ? 'bg-warning' : 'bg-safe'
                    }`}
                    style={{ width: `${Math.max(3, cfrm.score * 100)}%` }}
                  />
                </div>
                <RiskScoreBadge score={cfrm.score} riskClass={cfrm.riskClass} size="sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Top risk bridge factors */}
        {topBridge && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
              <h3 className="text-[11px] sm:text-xs font-semibold text-foreground mb-1">
                Наибольший риск: {topBridge.bridge.name}
              </h3>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground mb-3">
                CFRM = {topBridge.cfrm.score.toFixed(4)} • {getRiskClassLabel(topBridge.cfrm.riskClass)}
              </p>
              <RiskFactorsPanel cfrm={topBridge.cfrm} />
            </div>
            <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
              <h3 className="text-[11px] sm:text-xs font-semibold text-foreground mb-3">Описание метрики CFRM</h3>
              <div className="space-y-2 text-[10px] sm:text-[11px] text-muted-foreground leading-relaxed">
                <p>
                  <strong className="text-foreground">Cosine Flood Risk Metric</strong> — метрика, основанная на
                  косинусной близости между вектором текущих параметров и вектором максимального риска.
                </p>
                <p>
                  9 компонентов используют те же входные параметры, что и ML-модель: лаги уровня воды, скользящие средние и волатильность.
                </p>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-safe" />
                    <span>0.0–0.3 Низкий</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-warning" />
                    <span>0.3–0.6 Средний</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-elevated" />
                    <span>0.6–0.8 Повышенный</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-danger" />
                    <span>0.8–1.0 Критический</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ONNX vs CFRM comparison */}
        <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
          <h3 className="text-[11px] sm:text-xs font-semibold text-foreground mb-2 sm:mb-3">Сравнение: ONNX-прогноз и CFRM</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] sm:text-[11px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-1.5 sm:py-2 pr-2 font-medium">Мост</th>
                  <th className="text-center py-1.5 sm:py-2 px-2 font-medium">Уровень</th>
                  <th className="text-center py-1.5 sm:py-2 px-2 font-medium hidden sm:table-cell">Риск</th>
                  <th className="text-center py-1.5 sm:py-2 px-2 font-medium">CFRM</th>
                  <th className="text-center py-1.5 sm:py-2 pl-2 font-medium">Класс</th>
                </tr>
              </thead>
              <tbody>
                {data.map(({ bridge, cfrm }) => (
                  <tr
                    key={bridge.id}
                    className="border-b border-border/40 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => onBridgeClick(bridge.id)}
                  >
                    <td className="py-1.5 sm:py-2 pr-2 font-medium text-foreground">{bridge.name}</td>
                    <td className="py-1.5 sm:py-2 px-2 text-center">{bridge.waterLevel} см</td>
                    <td className="py-1.5 sm:py-2 px-2 text-center hidden sm:table-cell">{bridge.floodRiskIndex}/100</td>
                    <td className="py-1.5 sm:py-2 px-2 text-center font-mono font-semibold">{cfrm.score.toFixed(2)}</td>
                    <td className="py-1.5 sm:py-2 pl-2 text-center">
                      <RiskScoreBadge score={cfrm.score} riskClass={cfrm.riskClass} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
