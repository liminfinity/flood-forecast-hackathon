import type { CfrmRiskClass } from '@/data/cfrmService';
import { getRiskClassLabel, getRiskClassColor } from '@/data/cfrmService';

interface Props {
  score: number;
  riskClass: CfrmRiskClass;
  size?: 'sm' | 'md';
}

const colorMap: Record<string, string> = {
  safe: 'bg-safe-light text-safe',
  warning: 'bg-warning-light text-warning',
  elevated: 'bg-elevated-light text-elevated',
  danger: 'bg-danger-light text-danger',
};

export function RiskScoreBadge({ score, riskClass, size = 'sm' }: Props) {
  const colorKey = getRiskClassColor(riskClass);
  const cls = colorMap[colorKey] || colorMap.safe;
  const label = getRiskClassLabel(riskClass);

  if (size === 'md') {
    return (
      <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 ${cls}`}>
        <span className="text-sm font-bold">{score.toFixed(2)}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {score.toFixed(2)} • {label}
    </span>
  );
}
