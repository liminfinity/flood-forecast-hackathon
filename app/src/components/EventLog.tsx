import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AlertOctagon, AlertTriangle, CloudRain, TrendingUp, Info } from 'lucide-react';
import type { EventLogEntry } from '@/data/mockData';

interface Props {
  events: EventLogEntry[];
  onBridgeClick?: (id: number) => void;
}

const typeConfig = {
  danger: { icon: AlertOctagon, cls: 'text-danger' },
  warning: { icon: AlertTriangle, cls: 'text-warning' },
  rain: { icon: CloudRain, cls: 'text-water' },
  trend: { icon: TrendingUp, cls: 'text-primary' },
  info: { icon: Info, cls: 'text-muted-foreground' },
};

export function EventLog({ events, onBridgeClick }: Props) {
  if (events.length === 0) return null;

  return (
    <div className="absolute bottom-3 right-3 z-10 w-64 rounded-lg border border-border bg-card/95 backdrop-blur-sm shadow-sm">
      <div className="border-b border-border px-3 py-2">
        <p className="text-[11px] font-semibold text-foreground">Журнал событий</p>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {events.slice(0, 8).map((e, i) => {
          const cfg = typeConfig[e.type];
          const Icon = cfg.icon;
          return (
            <div
              key={i}
              className="flex items-start gap-2 border-b border-border/40 px-3 py-2 last:border-0 cursor-default hover:bg-muted/50 transition-colors"
              onClick={() => e.bridgeId && onBridgeClick?.(e.bridgeId)}
            >
              <Icon className={`h-3 w-3 mt-0.5 shrink-0 ${cfg.cls}`} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-foreground leading-snug truncate">{e.message}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {format(e.time, 'HH:mm', { locale: ru })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
