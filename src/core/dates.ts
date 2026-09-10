export function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function addMonths(iso: string, n: number): string {
  const d = parseIso(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return isoDate(d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = parseIso(fromIso).getTime();
  const b = parseIso(toIso).getTime();
  return Math.round((b - a) / 86400000);
}

/** Next occurrence of an EMI day (1-28) at/after `today`. */
export function nextDueDate(emiDay: number, todayIso: string): string {
  const t = parseIso(todayIso);
  let d = new Date(t.getFullYear(), t.getMonth(), Math.min(emiDay, 28));
  if (d < t) d = new Date(t.getFullYear(), t.getMonth() + 1, Math.min(emiDay, 28));
  return isoDate(d);
}

export function currentMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString('en', { month: 'long', year: 'numeric' });
}
