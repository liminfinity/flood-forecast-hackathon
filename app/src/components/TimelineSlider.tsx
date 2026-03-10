import { Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface Props {
  selectedDate: Date;
  onChange: (date: Date) => void;
  dataRange?: { start: Date; end: Date } | null;
}

export function TimelineSlider({ selectedDate, onChange, dataRange }: Props) {
  const rangeStart = dataRange ? dataRange.start.getTime() : Date.now() - 30 * 24 * 3600000;
  const rangeEnd = dataRange ? dataRange.end.getTime() : Date.now() + 3 * 24 * 3600000;
  const totalHours = Math.round((rangeEnd - rangeStart) / 3600000);
  const currentOffset = Math.round((selectedDate.getTime() - rangeStart) / 3600000);

  const QUICK_BUTTONS = dataRange
    ? [
        { label: 'Начало', offset: 0 },
        { label: 'Середина', offset: Math.round(totalHours * 0.5) },
        { label: '-24ч', offset: totalHours - 24 },
        { label: '+6ч', offset: Math.min(totalHours, currentOffset + 6) },
        { label: '+24ч', offset: Math.min(totalHours, currentOffset + 24) },
        { label: '+72ч', offset: Math.min(totalHours, currentOffset + 72) },
        { label: 'Конец', offset: totalHours },
      ]
    : [
        { label: 'Сейчас', offset: Math.round((Date.now() - rangeStart) / 3600000) },
        { label: '+6ч', offset: Math.round((Date.now() + 6 * 3600000 - rangeStart) / 3600000) },
        { label: '+24ч', offset: Math.round((Date.now() + 24 * 3600000 - rangeStart) / 3600000) },
        { label: '+72ч', offset: Math.round((Date.now() + 72 * 3600000 - rangeStart) / 3600000) },
      ];

  const startLabel = dataRange
    ? format(dataRange.start, 'dd.MM.yy', { locale: ru })
    : '-30дн';
  const endLabel = dataRange
    ? format(dataRange.end, 'dd.MM.yy', { locale: ru })
    : '+3дн';

  const handleDatePick = (day: Date | undefined) => {
    if (!day) return;
    const newDate = new Date(day);
    newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
    const ms = Math.max(rangeStart, Math.min(rangeEnd, newDate.getTime()));
    onChange(new Date(ms));
  };

  return (
    <div className="border-t border-border bg-card/90 backdrop-blur-sm px-3 py-2 sm:px-6 sm:py-3 shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
        <span className="text-[11px] sm:text-xs font-medium text-foreground truncate">
          {format(selectedDate, 'dd MMM yyyy, HH:mm', { locale: ru })}
        </span>

        <Popover>
          <PopoverTrigger asChild>
            <button className="rounded-md p-1 sm:p-1.5 text-muted-foreground hover:bg-muted transition-colors">
              <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarUI
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate}
              onSelect={handleDatePick}
              locale={ru}
              className={cn("p-3 pointer-events-auto")}
              disabled={(date) => {
                const ms = date.getTime();
                return ms < rangeStart - 86400000 || ms > rangeEnd + 86400000;
              }}
            />
          </PopoverContent>
        </Popover>

        <div className="flex gap-1 sm:gap-1.5 ml-auto overflow-x-auto no-scrollbar">
          {QUICK_BUTTONS.map((btn) => (
            <button
              key={btn.label}
              onClick={() => onChange(new Date(rangeStart + btn.offset * 3600000))}
              className={`rounded-md px-2 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-medium transition whitespace-nowrap shrink-0 ${
                Math.abs(currentOffset - btn.offset) < 2
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-[9px] sm:text-[10px] text-muted-foreground w-12 sm:w-14 shrink-0">{startLabel}</span>
        <Slider
          value={[currentOffset]}
          min={0}
          max={totalHours}
          step={1}
          onValueChange={(v) => onChange(new Date(rangeStart + v[0] * 3600000))}
          className="flex-1"
        />
        <span className="text-[9px] sm:text-[10px] text-muted-foreground w-12 sm:w-14 shrink-0 text-right">{endLabel}</span>
      </div>
      {dataRange && (
        <div className="flex justify-center mt-1">
          <span className="text-[8px] sm:text-[9px] text-muted-foreground">
            Реальные данные сенсоров • {format(dataRange.start, 'dd.MM.yyyy')} — {format(dataRange.end, 'dd.MM.yyyy')}
          </span>
        </div>
      )}
    </div>
  );
}
