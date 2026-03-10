import { ShieldCheck, AlertTriangle, AlertOctagon, Activity } from 'lucide-react';
import type { CombinedRisk } from '@/data/cfrmService';
import { getRiskClassLabel, getRiskClassColor } from '@/data/cfrmService';
import { RiskScoreBadge } from './RiskScoreBadge';

interface Props {
  combined: CombinedRisk;
  currentLevel: number;
}

const classIcons = {
  LOW: ShieldCheck,
  MEDIUM: AlertTriangle,
  HIGH: AlertOctagon,
  CRITICAL: AlertOctagon,
};

const classBorder: Record<string, string> = {
  safe: 'border-safe/30',
  warning: 'border-warning/30',
  elevated: 'border-elevated/30',
  danger: 'border-danger/30',
};

const classBg: Record<string, string> = {
  safe: 'bg-safe/5',
  warning: 'bg-warning/5',
  elevated: 'bg-elevated/5',
  danger: 'bg-danger/5',
};

const classText: Record<string, string> = {
  safe: 'text-safe',
  warning: 'text-warning',
  elevated: 'text-elevated',
  danger: 'text-danger',
};

export function CombinedForecastPanel({ combined, currentLevel }: Props) {
  const colorKey = getRiskClassColor(combined.combinedClass);
  const Icon = classIcons[combined.combinedClass];

  return (
    <div className={`rounded-lg border ${classBorder[colorKey]} ${classBg[colorKey]} p-3 space-y-3`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${classText[colorKey]}`} />
        <h3 className="text-xs font-semibold text-foreground">Итоговая оценка ситуации</h3>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
        <div>
          <p className="text-muted-foreground">Текущий уровень</p>
          <p className="font-semibold text-foreground">{currentLevel} см</p>
        </div>
        {combined.onnxForecast && (
          <div>
            <p className="text-muted-foreground">Прогноз +24ч</p>
            <p className="font-semibold text-foreground">{combined.onnxForecast.h24} см</p>
          </div>
        )}
        <div>
          <p className="text-muted-foreground">Индекс CFRM</p>
          <p className="font-semibold text-foreground">{combined.cfrm.score.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Итоговый класс</p>
          <RiskScoreBadge score={combined.combinedScore} riskClass={combined.combinedClass} />
        </div>
      </div>

      <p className="text-[11px] text-foreground/80 leading-relaxed">{combined.summary}</p>
    </div>
  );
}
