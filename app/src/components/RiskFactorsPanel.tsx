import type { CfrmResult } from '@/data/cfrmService';

interface Props {
  cfrm: CfrmResult;
}

const barColors: Record<string, string> = {
  high: 'bg-danger',
  medium: 'bg-warning',
  low: 'bg-safe',
};

function getBarColor(value: number): string {
  if (value >= 0.6) return barColors.high;
  if (value >= 0.3) return barColors.medium;
  return barColors.low;
}

export function RiskFactorsPanel({ cfrm }: Props) {
  const sorted = [...cfrm.componentValues].sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">Факторы риска (CFRM)</h3>
      <div className="space-y-1.5">
        {sorted.map(comp => (
          <div key={comp.name} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-[11px] text-foreground truncate">{comp.name}</span>
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getBarColor(comp.value)}`}
                style={{ width: `${Math.max(2, comp.value * 100)}%` }}
              />
            </div>
            <span className="w-8 text-right text-[10px] text-muted-foreground font-mono">
              {(comp.value * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
