import { Info, X } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function InfoPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute top-3 left-3 z-10">
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-lg border border-border bg-card/95 p-4 backdrop-blur-sm shadow-sm max-w-[280px]"
          >
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs font-semibold text-foreground">О системе</p>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Система мониторинга уровня воды в реке Кача (Красноярск). 
              Данные собираются с датчиков, установленных на мостах, и используются 
              для прогнозирования паводков.
            </p>
            <div className="mt-2.5 space-y-1.5 text-[10px] text-muted-foreground">
              <p>📍 14 мостов с датчиками</p>
              <p>📊 Прогноз до 3 дней вперёд</p>
              <p>📅 История за последний год</p>
              <p>🔔 Уведомления о рисках</p>
            </div>
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card/95 px-3 py-2 backdrop-blur-sm shadow-sm text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Info className="h-3.5 w-3.5" />
            О системе
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
