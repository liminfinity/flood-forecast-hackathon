import { Droplets, Bell, BarChart3, Moon, Sun } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Notification } from '@/data/notificationService';
import { getModeLabel } from '@/data/mockData';
import type { BridgeState } from '@/data/mockData';
import { ExportButton } from './ExportButton';
import { useTheme } from '@/hooks/useTheme';

interface HeaderProps {
  mode: 'history' | 'current' | 'forecast';
  selectedDate: Date;
  notifications: Notification[];
  onNotificationsClick: () => void;
  bridgeStates: BridgeState[];
  onAnalyticsClick?: () => void;
}

const modeBadgeClasses = {
  history: 'bg-muted text-muted-foreground',
  current: 'bg-safe/15 text-safe',
  forecast: 'bg-primary/15 text-primary',
};

export function Header({ mode, selectedDate, notifications, onNotificationsClick, bridgeStates, onAnalyticsClick }: HeaderProps) {
  const criticalCount = notifications.filter(n => n.level === 'critical').length;
  const totalCount = notifications.length;
  const { theme, toggle } = useTheme();

  return (
    <header className="border-b border-border bg-card/90 backdrop-blur-sm shrink-0">
      <div className="flex items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-primary">
            <Droplets className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-foreground leading-tight">АкваНадзор Кача</h1>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground">Система мониторинга уровня воды и прогнозирования паводков</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <span className={`rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium ${modeBadgeClasses[mode]}`}>
            {getModeLabel(mode)}
          </span>
          <span className="text-xs text-muted-foreground hidden lg:block">
            {format(selectedDate, 'dd MMM yyyy, HH:mm', { locale: ru })}
          </span>
          {onAnalyticsClick && (
            <button
              onClick={onAnalyticsClick}
              className="rounded-lg p-1.5 sm:p-2 text-muted-foreground transition hover:bg-muted"
              title="Математическая модель"
            >
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          )}
          <button
            onClick={toggle}
            className="rounded-lg p-1.5 sm:p-2 text-muted-foreground transition hover:bg-muted"
            title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
          >
            {theme === 'light' ? <Moon className="h-4 w-4 sm:h-5 sm:w-5" /> : <Sun className="h-4 w-4 sm:h-5 sm:w-5" />}
          </button>
          <ExportButton states={bridgeStates} selectedDate={selectedDate} />
          <button
            onClick={onNotificationsClick}
            className="relative rounded-lg p-1.5 sm:p-2 text-muted-foreground transition hover:bg-muted"
          >
            <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
            {totalCount > 0 && (
              <span className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${criticalCount > 0 ? 'bg-danger' : 'bg-warning'}`}>
                {totalCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
