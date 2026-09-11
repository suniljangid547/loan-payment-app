import type { SQLiteDatabase } from 'expo-sqlite';
import { isoDate } from '@/core/dates';
import { DATABASE_VERSION } from './schema';

export interface BackupSettings {
  onboarded?: boolean;
  name?: string;
  language?: string;
  country?: string;
  currency?: string;
  hasInsurance?: boolean | null;
  insuranceDismissed?: boolean;
  fundTarget?: number | null;
  skills?: string[];
}

export interface BackupFile {
  app: 'loanpay';
  schemaVersion: number;
  exportedAt: string;
  settings: BackupSettings | null;
  tables: Record<string, Record<string, unknown>[]>;
}

const TABLES = [
  'persons',
  'loans',
  'payments',
  'income_sources',
  'income_events',
  'expense_categories',
  'budgets',
  'expenses',
  'fund_events',
  'short_months',
  'category_answers',
] as const;

export async function exportBackup(
  db: SQLiteDatabase,
  settings: BackupSettings,
): Promise<BackupFile> {
  const tables: BackupFile['tables'] = {};
  for (const t of TABLES) {
    tables[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  }
  return {
    app: 'loanpay',
    schemaVersion: DATABASE_VERSION,
    exportedAt: isoDate(),
    settings,
    tables,
  };
}

/** Pure validation — safe to unit test. Returns null when the file is not a usable backup. */
export function validateBackup(data: unknown): BackupFile | null {
  if (!data || typeof data !== 'object') return null;
  const b = data as Partial<BackupFile>;
  if (b.app !== 'loanpay') return null;
  if (typeof b.schemaVersion !== 'number' || b.schemaVersion < 1) return null;
  if (b.schemaVersion > DATABASE_VERSION) return null; // newer app version needed
  if (!b.tables || typeof b.tables !== 'object') return null;
  for (const t of TABLES) {
    const rows = b.tables[t];
    if (rows !== undefined && !Array.isArray(rows)) return null;
  }
  return {
    app: 'loanpay',
    schemaVersion: b.schemaVersion,
    exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
    settings: b.settings ?? null,
    tables: b.tables,
  };
}

/**
 * Replaces the whole database with the backup contents. Runs in one
 * exclusive transaction — a failure mid-way leaves the old data intact.
 */
export async function restoreBackup(db: SQLiteDatabase, backup: BackupFile): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const t of [...TABLES].reverse()) {
      await txn.execAsync(`DELETE FROM ${t}`);
    }
    for (const t of TABLES) {
      for (const row of backup.tables[t] ?? []) {
        const cols = Object.keys(row);
        if (cols.length === 0) continue;
        await txn.runAsync(
          `INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
          ...cols.map((c) => row[c] as string | number | null),
        );
      }
    }
  });
}
