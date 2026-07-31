// Stable random identifier for this browser/device.
// Not PII — random UUID persisted in localStorage.
const KEY = 'print-station:fp';

export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    let fp = localStorage.getItem(KEY);
    if (!fp) {
      fp = (crypto as any)?.randomUUID?.() || `fp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(KEY, fp);
    }
    return fp;
  } catch {
    return `fp-${Date.now()}`;
  }
}

export function getDeviceLabel(): string {
  if (typeof window === 'undefined') return 'Servidor';
  const ua = navigator.userAgent || '';
  const isMac = /Mac/i.test(ua);
  const isWin = /Windows/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const os = isMac ? 'Mac' : isWin ? 'Windows' : isAndroid ? 'Android' : isIOS ? 'iOS' : 'Dispositivo';
  const browser = /Edg/i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : 'Navegador';
  return `${os} • ${browser}`;
}
