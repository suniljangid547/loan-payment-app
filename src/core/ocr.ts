/**
 * Lightweight receipt "OCR" fallback — works fully offline without any native
 * ML Kit module (which requires a dev build). Two paths:
 * 1) On-device vision API path (future: dev build with mlkit/text-recognition)
 *    is behind a feature flag and returns null here so callers degrade safely.
 * 2) Offline amount/date parser that extracts plausible values from any text
 *    (e.g. a manually pasted receipt text, or the file name). The image
 *    picker itself is the UX win: user picks a photo, the form pre-fills.
 */

import { isoDate } from './dates';

export interface ReceiptParse {
  amount: number | null; // minor units (paise/cents), unscaled
  date: string | null; // YYYY-MM-DD
  rawText: string;
}

/** Extract amount and date from free-form receipt text. Pure regex, no network. */
const AMOUNT_PATTERNS: RegExp[] = [
  //₹ 1,234.56 or Rs 1234.56 or INR 1234
  /(?:rs\.?|inr|₹)\s*([0-9][0-9,]*\.?[0-9]*)/i,
  // total/amount/grand total: 1,234.56
  /(?:total|amount|grand\s*total|net\s*pay|payable|bill)\s*[:\-]?\s*([0-9][0-9,]*\.?[0-9]*)/i,
  // fallback: biggest decimal-looking number (last resort)
  /([0-9][0-9,]*\.[0-9]{2})/,
];

const DATE_PATTERNS: RegExp[] = [
  /(\d{4}-\d{2}-\d{2})/,
  /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/,
  /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})/i,
];

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function parseAmount(text: string): number | null {
  const normalized = text.replace(/,/g, '');
  for (const p of AMOUNT_PATTERNS) {
    const m = normalized.match(p);
    if (!m) continue;
    const raw = (m[1] ?? '').trim();
    const val = Number.parseFloat(raw);
    if (!Number.isFinite(val) || val <= 0) continue;
    return Math.round(val * 100);
  }
  return null;
}

function parseDate(text: string): string | null {
  const trimmed = text.trim();
  for (const p of DATE_PATTERNS) {
    const m = trimmed.match(p);
    if (!m) continue;
    // ISO already
    if (/^\d{4}-\d{2}-\d{2}$/.test(m[1])) {
      const d = new Date(`${m[1]}T12:00:00`);
      if (!Number.isNaN(d.getTime())) return m[1];
      continue;
    }
    // DD/MM/YYYY or DD-MM-YYYY
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(m[1] ?? '')) {
      const parts = (m[1] ?? '').split(/[\/\-]/);
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        const iso = `${yyyy}-${mm}-${dd}`;
        const d = new Date(`${iso}T12:00:00`);
        if (!Number.isNaN(d.getTime())) return iso;
      }
    }
    // 12 Jan 2026 style
    if (m.length >= 4) {
      const dd = m[1]!.padStart(2, '0');
      const mm = MONTHS[m[2]!.toLowerCase().slice(0, 3)] ?? '01';
      const yyyy = m[3]!;
      const iso = `${yyyy}-${mm}-${dd}`;
      const d = new Date(`${iso}T12:00:00`);
      if (!Number.isNaN(d.getTime())) return iso;
    }
  }
  // today as last resort → null (form will default to today on save)
  return null;
}

export function parseReceiptText(text: string): ReceiptParse {
  return {
    amount: parseAmount(text),
    date: parseDate(text),
    rawText: text.slice(0, 4000),
  };
}

/**
 * Stub that will call a real on-device model when a dev build is available.
 * Today it returns null and the caller falls back to `parseReceiptText` on
 * any text the user pastes, or just the image itself (no extraction yet).
 */
export async function runOcrOnImage(_uri: string): Promise<ReceiptParse | null> {
  // Placeholder for future: `expo-mlkit-text-recognition` or similar.
  // Keeping the file offline-safe and build-safe on Expo Go.
  return null;
}

export function todayIsoOr(parsed: string | null): string {
  return parsed ?? isoDate();
}
