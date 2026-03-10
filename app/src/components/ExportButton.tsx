import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BridgeState } from '@/data/mockData';
import { getRiskLabel } from '@/data/mockData';
import { format } from 'date-fns';

interface Props {
  states: BridgeState[];
  selectedDate: Date;
}

export function ExportButton({ states, selectedDate }: Props) {
  const handleExport = () => {
    const header = 'ID,Название,Широта,Долгота,Уровень воды (см),Риск,Индекс риска,Температура,Осадки,Тренд';
    const rows = states.map(s =>
      [
        s.id,
        `"${s.name}"`,
        s.latitude,
        s.longitude,
        s.waterLevel,
        getRiskLabel(s.risk),
        s.floodRiskIndex,
        s.temperature,
        s.precipitation,
        `"${s.trendLabel}"`,
      ].join(',')
    );
    const csv = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `floodwatch_${format(selectedDate, 'yyyy-MM-dd_HH-mm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      className="gap-1.5 text-xs"
    >
      <Download className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Экспорт CSV</span>
    </Button>
  );
}
