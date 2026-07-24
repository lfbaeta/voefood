import { useState } from 'react';

interface BeforeAfterViewerProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export function BeforeAfterViewer({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Antes',
  afterLabel = 'Depois',
}: BeforeAfterViewerProps) {
  const [showAfter, setShowAfter] = useState<'both' | 'before' | 'after'>('both');

  return (
    <div className="space-y-3">
      <div className="flex gap-2 justify-center">
        <button
          type="button"
          onClick={() => setShowAfter('both')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            showAfter === 'both' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          Lado a lado
        </button>
        <button
          type="button"
          onClick={() => setShowAfter('before')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            showAfter === 'before' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          {beforeLabel}
        </button>
        <button
          type="button"
          onClick={() => setShowAfter('after')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            showAfter === 'after' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          {afterLabel}
        </button>
      </div>

      {showAfter === 'both' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
              {beforeLabel}
            </p>
            <div className="rounded-xl overflow-hidden border border-border bg-muted/30">
              <img src={beforeUrl} alt={beforeLabel} className="w-full h-auto object-contain" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary text-center">
              {afterLabel} ✨
            </p>
            <div className="rounded-xl overflow-hidden border border-primary/40 bg-muted/30 ring-2 ring-primary/20">
              <img src={afterUrl} alt={afterLabel} className="w-full h-auto object-contain" />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border bg-muted/30 max-w-2xl mx-auto">
          <img
            src={showAfter === 'before' ? beforeUrl : afterUrl}
            alt={showAfter === 'before' ? beforeLabel : afterLabel}
            className="w-full h-auto object-contain"
          />
        </div>
      )}
    </div>
  );
}
