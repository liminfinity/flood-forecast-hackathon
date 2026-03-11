import { Activity, ShieldCheck, AlertTriangle, AlertOctagon, Waves } from 'lucide-react';
import type { BridgeState } from '@/data/mockData';
import { motion } from 'framer-motion';

interface StatsCardsProps {
  states: BridgeState[];
}

export function StatsCards({ states }: StatsCardsProps) {
  const safe = states.filter(s => s.risk === 'safe').length;
  const warning = states.filter(s => s.risk === 'warning').length;
  const danger = states.filter(s => s.risk === 'danger').length;
  const avgLevel = Math.round(states.reduce((sum, s) => sum + s.waterLevel, 0) / states.length);

  const cards = [
    { label: 'Мостов', value: states.length, icon: Activity, cls: 'text-primary' },
    { label: 'Норма', value: safe, icon: ShieldCheck, cls: 'text-safe' },
    { label: 'Внимание', value: warning, icon: AlertTriangle, cls: 'text-warning' },
    { label: 'Опасно', value: danger, icon: AlertOctagon, cls: 'text-danger' },
    { label: 'Ср. уровень', value: `${avgLevel} см`, icon: Waves, cls: 'text-water' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 lg:px-6 shrink-0">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-2 sm:gap-2.5 rounded-lg border border-border bg-card p-2 sm:p-2.5 lg:p-3 shadow-sm hover:shadow-md transition-shadow"
        >
          <card.icon className={`h-4 w-4 shrink-0 ${card.cls}`} />
          <div className="min-w-0">
            <p className="text-sm sm:text-base lg:text-lg font-bold text-foreground leading-tight">{card.value}</p>
            <p className="text-[9px] sm:text-[10px] lg:text-[11px] text-muted-foreground truncate">{card.label}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
