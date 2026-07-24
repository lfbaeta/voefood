import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';

interface ChipsInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  presets?: string[];
}

export function ChipsInput({ value, onChange, placeholder, presets = [] }: ChipsInputProps) {
  const [draft, setDraft] = useState('');
  const safe = Array.isArray(value) ? value : [];

  function add(text: string) {
    const t = text.trim();
    if (!t) return;
    if (safe.includes(t)) return;
    onChange([...safe, t]);
    setDraft('');
  }
  function remove(t: string) {
    onChange(safe.filter((x) => x !== t));
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(draft); }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" size="icon" onClick={() => add(draft)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {safe.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {safe.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
              <span className="text-xs">{t}</span>
              <button type="button" onClick={() => remove(t)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {presets.length > 0 && (
        <div className="pt-1">
          <p className="text-[11px] text-muted-foreground mb-1">Sugestões (clique para adicionar):</p>
          <div className="flex flex-wrap gap-1.5">
            {presets.filter((p) => !safe.includes(p)).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => add(p)}
                className="text-[11px] px-2 py-1 rounded-md border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                + {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}