import { useMemo } from 'react';

interface Props {
  value: number; // 0-100
  size?: number;
}

export function FloodRiskGauge({ value, size = 96 }: Props) {
  const { color, label } = useMemo(() => {
    if (value >= 70) return { color: 'hsl(var(--danger))', label: 'Критично' };
    if (value >= 40) return { color: 'hsl(var(--warning))', label: 'Повышенный' };
    return { color: 'hsl(var(--safe))', label: 'Безопасно' };
  }, [value]);

  const r = (size - 12) / 2;
  const circumference = Math.PI * r; // half circle
  const offset = circumference - (value / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2 + 4;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`}>
        {/* Background arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
        {/* Center text */}
        <text x={cx} y={cy - 8} textAnchor="middle" className="text-xl font-bold" fill="currentColor" style={{ fontSize: size * 0.22 }}>
          {value}
        </text>
        <text x={cx} y={cy + 6} textAnchor="middle" fill="hsl(var(--muted-foreground))" style={{ fontSize: size * 0.1 }}>
          из 100
        </text>
      </svg>
      <span className="text-[11px] font-medium mt-0.5" style={{ color }}>{label}</span>
    </div>
  );
}
