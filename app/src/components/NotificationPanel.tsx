import { X, AlertTriangle, AlertOctagon, Info, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Notification } from '@/data/mockData';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  open: boolean;
  notifications: Notification[];
  onClose: () => void;
  onGoToBridge: (bridgeId: number) => void;
}

const levelConfig = {
  critical: { icon: AlertOctagon, className: 'text-danger bg-danger-light', label: 'Опасно' },
  warning: { icon: AlertTriangle, className: 'text-warning bg-warning-light', label: 'Внимание' },
  info: { icon: Info, className: 'text-primary bg-accent', label: 'Инфо' },
};

export function NotificationPanel({ open, notifications, onClose, onGoToBridge }: Props) {
  const criticalCount = notifications.filter(n => n.level === 'critical').length;
  const warningCount = notifications.filter(n => n.level === 'warning').length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="absolute right-2 sm:right-4 top-2 z-50 w-72 sm:w-80 rounded-lg border border-border bg-card shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-3 sm:px-4 py-2.5 sm:py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-semibold text-foreground">Оповещения</h3>
              {criticalCount > 0 && (
                <span className="rounded-full bg-danger px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-white">
                  {criticalCount}
                </span>
              )}
              {warningCount > 0 && (
                <span className="rounded-full bg-warning px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-white">
                  {warningCount}
                </span>
              )}
            </div>
            <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-64 sm:max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-5 sm:p-6 text-center">
                <p className="text-xs sm:text-sm font-medium text-safe">Всё в норме</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Нет активных оповещений</p>
              </div>
            ) : (
              notifications.map(n => {
                const cfg = levelConfig[n.level];
                const Icon = cfg.icon;
                return (
                  <div key={n.id} className="border-b border-border/50 px-3 sm:px-4 py-2.5 sm:py-3 last:border-0">
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 rounded-md p-1 ${cfg.className}`}>
                        <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] sm:text-[10px] text-muted-foreground">
                            {format(n.time, 'HH:mm', { locale: ru })}
                          </span>
                          <span className={`text-[8px] sm:text-[9px] font-medium rounded px-1 py-0.5 ${cfg.className}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-foreground leading-relaxed mt-0.5">{n.message}</p>
                        {n.bridgeId && (
                          <button
                            onClick={() => onGoToBridge(n.bridgeId!)}
                            className="mt-1 flex items-center gap-0.5 text-[9px] sm:text-[10px] text-primary hover:underline"
                          >
                            <MapPin className="h-2.5 w-2.5" />
                            Показать на карте
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
