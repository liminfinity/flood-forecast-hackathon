import { Droplets, Bell, BarChart3, Moon, Sun, Menu, X } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Notification } from '@/data/notificationService';
import { getModeLabel } from '@/data/mockData';
import type { BridgeState } from '@/data/mockData';
import { ExportButton } from './ExportButton';
import { useTheme } from '@/hooks/useTheme';
import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { AnimatePresence, motion } from 'framer-motion';

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
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-border bg-card/90 backdrop-blur-sm shrink-0 relative z-50">
      <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-2.5 lg:px-6 lg:py-3">
        {/* Logo */}
        <div className="flex items-center gap-2 sm:gap-2.5 lg:gap-3">
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 lg:h-9 lg:w-9 items-center justify-center rounded-lg bg-primary">
            <Droplets className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm lg:text-base font-bold text-foreground leading-tight">АкваНадзор Кача</h1>
            <p className="text-[9px] sm:text-[10px] lg:text-[11px] text-muted-foreground hidden sm:block">
              Мониторинг уровня воды и прогнозирование паводков
            </p>
          </div>
        </div>

        {/* Desktop/Tablet actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-3">
          <span className={`rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] lg:text-xs font-medium ${modeBadgeClasses[mode]}`}>
            {getModeLabel(mode)}
          </span>
          <span className="text-xs text-muted-foreground hidden lg:block">
            {format(selectedDate, 'dd MMM yyyy, HH:mm', { locale: ru })}
          </span>

          {/* Analytics - hidden on mobile, in menu */}
          {onAnalyticsClick && (
            <button
              onClick={onAnalyticsClick}
              className="hidden sm:flex rounded-lg p-1.5 lg:p-2 text-muted-foreground transition hover:bg-muted"
              title="Математическая модель"
            >
              <BarChart3 className="h-4 w-4 lg:h-5 lg:w-5" />
            </button>
          )}

          {/* Theme toggle - hidden on mobile, in menu */}
          <button
            onClick={toggle}
            className="hidden sm:flex rounded-lg p-1.5 lg:p-2 text-muted-foreground transition hover:bg-muted"
            title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
          >
            {theme === 'light' ? <Moon className="h-4 w-4 lg:h-5 lg:w-5" /> : <Sun className="h-4 w-4 lg:h-5 lg:w-5" />}
          </button>

          {/* Export - hidden on mobile, in menu */}
          <div className="hidden sm:block">
            <ExportButton states={bridgeStates} selectedDate={selectedDate} />
          </div>

          {/* Notifications - always visible */}
          <button
            onClick={onNotificationsClick}
            className="relative rounded-lg p-1.5 lg:p-2 text-muted-foreground transition hover:bg-muted"
          >
            <Bell className="h-4 w-4 lg:h-5 lg:w-5" />
            {totalCount > 0 && (
              <span className={`absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 sm:h-4 sm:min-w-4 items-center justify-center rounded-full px-0.5 sm:px-1 text-[8px] sm:text-[10px] font-bold text-white ${criticalCount > 0 ? 'bg-danger' : 'bg-warning'}`}>
                {totalCount}
              </span>
            )}
          </button>

          {/* Burger menu - mobile only */}
          {isMobile && (
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted sm:hidden"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile dropdown menu */}
      <AnimatePresence>
        {menuOpen && isMobile && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border bg-card sm:hidden"
          >
            <div className="flex flex-col gap-1 p-3">
              <p className="text-[10px] text-muted-foreground px-2 mb-1">
                {format(selectedDate, 'dd MMM yyyy, HH:mm', { locale: ru })}
              </p>
              {onAnalyticsClick && (
                <button
                  onClick={() => { onAnalyticsClick(); setMenuOpen(false); }}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs text-foreground hover:bg-muted transition active:bg-muted/80"
                >
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Математическая модель
                </button>
              )}
              <button
                onClick={() => { toggle(); setMenuOpen(false); }}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs text-foreground hover:bg-muted transition active:bg-muted/80"
              >
                {theme === 'light' ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
                {theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
              </button>
              <div className="px-1">
                <ExportButton states={bridgeStates} selectedDate={selectedDate} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
