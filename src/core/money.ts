/**
 * Money is stored as integer minor units (paise / cents).
 */
function currencyMinor(currency: string): number {
  try {
    const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency });
    return fmt.resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function toMinor(input: string | number, currency: string): number {
  const n = typeof input === 'number' ? input : parseFloat(input.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10 ** currencyMinor(currency));
}

export function fromMinor(minor: number, currency: string): number {
  return minor / 10 ** currencyMinor(currency);
}

export function formatMoney(minor: number, currency: string, opts?: { compact?: boolean }): string {
  const value = fromMinor(minor, currency);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: opts?.compact || Math.abs(value) >= 100000 ? 0 : 2,
      notation: opts?.compact && Math.abs(value) >= 1000 ? 'compact' : 'standard',
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatNumber(value: number, digits = 2): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}
