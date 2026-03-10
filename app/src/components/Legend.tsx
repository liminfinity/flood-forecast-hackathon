import { Info } from 'lucide-react';
import { useState } from 'react';

export function Legend() {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-border bg-card/95 p-2.5 sm:p-3 backdrop-blur-sm shadow-sm max-w-[220px] sm:max-w-[260px]">
      <p className="mb-1.5 sm:mb-2 text-[10px] sm:text-[11px] font-semibold text-foreground">Легенда</p>
      <div className="space-y-1 sm:space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-safe" />
          <span className="text-[10px] sm:text-[11px] text-foreground">Низкий риск (0–0.3)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-warning" />
          <span className="text-[10px] sm:text-[11px] text-foreground">Средний риск (0.3–0.6)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-elevated" />
          <span className="text-[10px] sm:text-[11px] text-foreground">Повышенный (0.6–0.8)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-danger" />
          <span className="text-[10px] sm:text-[11px] text-foreground">Критический (0.8–1.0)</span>
        </div>
      </div>

      <button
        onClick={() => setShowHelp(v => !v)}
        className="mt-1.5 sm:mt-2 flex items-center gap-1 text-[9px] sm:text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Info className="h-3 w-3" />
        <span>{showHelp ? 'Скрыть' : 'Подробнее'}</span>
      </button>

      {showHelp && (
        <div className="mt-2 rounded-md bg-muted/60 p-2 text-[9px] sm:text-[10px] text-muted-foreground leading-relaxed space-y-1.5">
          <div>
            <p className="font-medium text-foreground">Уровень воды (см)</p>
            <p>Расстояние от датчика до поверхности. Чем <strong>меньше</strong> — тем <strong>выше</strong> вода.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Пороги</p>
            <p>Внимание: &lt; 180 см • Опасно: &lt; 120 см</p>
          </div>
          <div>
            <p className="font-medium text-foreground">CFRM</p>
            <p>Метрика косинусной близости на основе 9 параметров уровня воды.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">ML-прогноз</p>
            <p>CatBoost ONNX-модель: +6ч, +24ч, +72ч.</p>
          </div>
        </div>
      )}
    </div>
  );
}
