type FunctionErrorLike = Error & {
  context?: unknown;
};

function pickMessage(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) return value.map(pickMessage).filter(Boolean).join(' ') || null;
  if (typeof value !== 'object') return String(value);

  const obj = value as Record<string, unknown>;
  return (
    pickMessage(obj.error) ||
    pickMessage(obj.message) ||
    pickMessage(obj.details) ||
    pickMessage(obj.hint) ||
    null
  );
}

function appendAttempts(message: string, data: unknown): string {
  if (!data || typeof data !== 'object') return message;
  const attempts = (data as Record<string, unknown>).attempts;
  if (!Array.isArray(attempts) || attempts.length === 0) return message;
  return `${message}\nTentativas: ${attempts.map(String).join(' | ')}`;
}

async function readContext(context: unknown): Promise<string | null> {
  if (!context) return null;

  if (context instanceof Response) {
    const copy = context.clone();
    const text = await copy.text().catch(() => '');
    if (!text) return null;
    try {
      return pickMessage(JSON.parse(text)) || text;
    } catch {
      return text;
    }
  }

  return pickMessage(context);
}

export async function getFunctionErrorMessage(
  data: unknown,
  error: unknown,
  fallback = 'Não foi possível concluir a ação.',
): Promise<string> {
  const fromData = pickMessage(data);
  if (fromData) return appendAttempts(fromData, data);

  const fnError = error as FunctionErrorLike | null;
  const fromContext = await readContext(fnError?.context).catch(() => null);
  if (fromContext) return fromContext;

  const fromError = pickMessage(error);
  if (fromError && !fromError.includes('Edge Function returned a non-2xx status code')) return fromError;

  return fallback;
}