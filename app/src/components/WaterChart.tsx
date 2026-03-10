import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Props {
  history: { time: string; value: number }[];
  forecast: { time: string; value: number }[];
}

export function WaterChart({ history, forecast }: Props) {
  const data = useMemo(() => {
    const hist = history.map(h => ({
      time: new Date(h.time).getTime(),
      actual: h.value,
      forecast: null as number | null,
    }));

    const fore = forecast.map(f => ({
      time: new Date(f.time).getTime(),
      actual: null as number | null,
      forecast: f.value,
    }));

    if (hist.length > 0 && fore.length > 0) {
      fore.unshift({
        time: hist[hist.length - 1].time,
        actual: null,
        forecast: hist[hist.length - 1].actual,
      });
    }

    return [...hist, ...fore];
  }, [history, forecast]);

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(200, 80%, 55%)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="hsl(200, 80%, 55%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={v => format(new Date(v), 'dd.MM HH:mm')}
            tick={{ fontSize: 10, fill: 'hsl(215, 15%, 50%)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'hsl(215, 15%, 50%)' }}
            axisLine={false}
            tickLine={false}
            reversed
            label={{ value: 'см', position: 'insideTopRight', offset: 10, fontSize: 10, fill: 'hsl(215, 15%, 50%)' }}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(210, 25%, 100%)',
              border: '1px solid hsl(210, 20%, 90%)',
              borderRadius: '0.5rem',
              fontSize: 11,
            }}
            labelFormatter={v => format(new Date(v as number), 'dd MMM HH:mm', { locale: ru })}
            formatter={(value: number | null, name: string) => {
              if (value === null || value === undefined) return ['-', name];
              return [`${value} см`, name === 'actual' ? 'Факт' : 'Прогноз'];
            }}
          />
          <ReferenceLine y={180} stroke="hsl(38, 90%, 55%)" strokeDasharray="4 4" strokeWidth={1} />
          <ReferenceLine y={120} stroke="hsl(0, 70%, 58%)" strokeDasharray="4 4" strokeWidth={1} />
          <Area
            type="monotone"
            dataKey="actual"
            stroke="hsl(200, 80%, 55%)"
            strokeWidth={2}
            fill="url(#waterGrad)"
            dot={false}
            connectNulls={false}
          />
          <Area
            type="monotone"
            dataKey="forecast"
            stroke="hsl(200, 80%, 55%)"
            strokeWidth={2}
            strokeDasharray="6 4"
            fill="url(#waterGrad)"
            fillOpacity={0.5}
            dot={false}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
