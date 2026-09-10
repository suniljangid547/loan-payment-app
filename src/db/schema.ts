import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_VERSION = 2;

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS persons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  is_self INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  lender TEXT,
  type TEXT NOT NULL DEFAULT 'other',
  purpose TEXT,
  purpose_regret INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'fixed_emi',
  principal_total INTEGER NOT NULL,
  principal_remaining INTEGER NOT NULL,
  interest_rate REAL NOT NULL DEFAULT 0,
  rate_period TEXT NOT NULL DEFAULT 'yearly',
  compounding TEXT NOT NULL DEFAULT 'interest_on_interest',
  emi_amount INTEGER,
  emi_day INTEGER,
  flexible_months INTEGER,
  card_minimum_due INTEGER,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  closed_at TEXT
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  interest_part INTEGER NOT NULL DEFAULT 0,
  principal_part INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT NOT NULL,
  note TEXT
);
CREATE TABLE IF NOT EXISTS income_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'salary',
  cadence TEXT NOT NULL DEFAULT 'monthly_fixed',
  expected_day INTEGER,
  expected_amount INTEGER
);
CREATE TABLE IF NOT EXISTS income_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER REFERENCES income_sources(id) ON DELETE SET NULL,
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  occurred_on TEXT NOT NULL,
  note TEXT
);
CREATE TABLE IF NOT EXISTS expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  name_key TEXT,
  is_fixed INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  limit_amount INTEGER NOT NULL,
  UNIQUE(month, category_id)
);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  pay_method TEXT NOT NULL DEFAULT 'cash',
  occurred_on TEXT NOT NULL,
  note TEXT
);
`;

const SEED_CATEGORIES: [nameKey: string, isFixed: number, sort: number][] = [
  ['cat.groceries', 0, 1],
  ['cat.rent', 1, 2],
  ['cat.electricity', 0, 3],
  ['cat.fees', 1, 4],
  ['cat.ration', 1, 5],
  ['cat.travel', 0, 6],
  ['cat.mobile', 1, 7],
  ['cat.medical', 0, 8],
  ['cat.festival', 0, 9],
  ['cat.other', 0, 10],
];

const SCHEMA_V2 = `
CREATE TABLE IF NOT EXISTS fund_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delta INTEGER NOT NULL,
  occurred_on TEXT NOT NULL,
  note TEXT
);
CREATE TABLE IF NOT EXISTS short_months (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL UNIQUE,
  reason_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version === 0) {
    await db.execAsync(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
${SCHEMA_V1}`);
    for (const [nameKey, isFixed, sort] of SEED_CATEGORIES) {
      await db.runAsync(
        'INSERT INTO expense_categories (name_key, is_fixed, sort) VALUES (?, ?, ?)',
        nameKey,
        isFixed,
        sort,
      );
    }
    version = 1;
  }
  if (version === 1) {
    await db.execAsync(SCHEMA_V2);
    version = 2;
  }
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
