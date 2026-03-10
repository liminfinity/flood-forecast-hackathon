import { Lightbulb } from 'lucide-react';

interface Props {
  explanations: string[];
}

export function ModelExplanation({ explanations }: Props) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Lightbulb className="h-3.5 w-3.5 text-warning" />
        <p className="text-xs font-medium text-foreground">Почему система оценивает риск?</p>
      </div>
      <div className="space-y-1 text-[11px] text-muted-foreground">
        {explanations.map((text, i) => (
          <p key={i}>• {text}</p>
        ))}
      </div>
    </div>
  );
}
