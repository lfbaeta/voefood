const TABLE_KEY = 'pdv-table-number';

/** Guarda a mesa lida via QR Code (?mesa=N) para vincular o pedido do cliente. */
export function setTableSession(tableNumber: number) {
  try {
    sessionStorage.setItem(TABLE_KEY, String(tableNumber));
  } catch {
    /* ignore */
  }
}

export function getTableSession(): number | null {
  try {
    const raw = sessionStorage.getItem(TABLE_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function clearTableSession() {
  try {
    sessionStorage.removeItem(TABLE_KEY);
  } catch {
    /* ignore */
  }
}
