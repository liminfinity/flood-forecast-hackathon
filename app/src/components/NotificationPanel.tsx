import { X, AlertTriangle, AlertOctagon, Info, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Notification } from '@/data/mockData';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

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

function NotificationList({ notifications, onClose, onGoToBridge }: Omit<Props, 'open'>) {
  const criticalCount = notifications.filter(n => n.level === 'critical').length;
  const warningCount = notifications.filter(n => n.level === 'warning').length;

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Оповещения</h3>
          {criticalCount > 0 && (
            <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
              {criticalCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-bold text-white">
              {warningCount}
            </span>
          )}
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm font-medium text-safe">Всё в норме</p>
            <p className="text-xs text-muted-foreground mt-1">Нет активных оповещений</p>
          </div>
        ) : (
          notifications.map(n => {
            const cfg = levelConfig[n.level];
            const Icon = cfg.icon;
            return (
              <div key={n.id} className="border-b border-border/50 px-4 py-3 last:border-0">
                <div className="flex items-start gap-2.5">
                  <div className={`mt-0.5 rounded-md p-1.5 ${cfg.className}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {format(n.time, 'HH:mm', { locale: ru })}
                      </span>
                      <span className={`text-[9px] font-medium rounded px-1 py-0.5 ${cfg.className}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed mt-0.5">{n.message}</p>
                    {n.bridgeId && (
                      <button
                        onClick={() => onGoToBridge(n.bridgeId!)}
                        className="mt-1.5 flex items-center gap-1 text-[10px] text-primary hover:underline active:opacity-70 py-0.5"
                      >
                        <MapPin className="h-3 w-3" />
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
    </>
  );
}

export function NotificationPanel({ open, notifications, onClose, onGoToBridge }: Props) {
  const isMobile = useIsMobile();

  // Mobile: full-screen modal
  if (isMobile) {
    return (
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[998] bg-foreground/20 backdrop-blur-sm"
              onClick={onClose}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-[999] flex flex-col bg-card rounded-t-2xl shadow-xl border-t border-border"
              style={{ maxHeight: '75vh' }}
            >
              <div className="flex justify-center pt-2 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
              <NotificationList notifications={notifications} onClose={onClose} onGoToBridge={onGoToBridge} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Desktop/Tablet: dropdown panel
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="absolute right-2 sm:right-4 top-2 z-50 w-80 rounded-lg border border-border bg-card shadow-lg max-h-96 flex flex-col"
        >
          <NotificationList notifications={notifications} onClose={onClose} onGoToBridge={onGoToBridge} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
