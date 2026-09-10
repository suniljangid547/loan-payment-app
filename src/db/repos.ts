import type { SQLiteDatabase } from 'expo-sqlite';
import { interestDue } from '@/core/interest';
import { isoDate, monthOf } from '@/core/dates';
import type {
  BudgetRow,
  Cadence,
  Compounding,
  ExpenseCategoryRow,
  ExpenseRow,
  IncomeEventRow,
  IncomeSourceRow,
  IncomeType,
  LoanMode,
  LoanRow,
  LoanType,
  PaymentRow,
  PayMethod,
  PersonRow,
  RatePeriod,
} from '@/core/types';

export async function listLoans(db: SQLiteDatabase): Promise<LoanRow[]> {
  return db.getAllAsync<LoanRow>('SELECT * FROM loans ORDER BY status, id');
}

export async function getLoan(db: SQLiteDatabase, id: number): Promise<LoanRow | null> {
  return db.getFirstAsync<LoanRow>('SELECT * FROM loans WHERE id = ?', id);
}

export interface LoanInput {
  name: string;
  lender: string | null;
  type: LoanType;
  purpose: string | null;
  purpose_regret: boolean;
  mode: LoanMode;
  principal_total: number;
  principal_remaining: number;
  interest_rate: number;
  rate_period: RatePeriod;
  compounding: Compounding;
  emi_amount: number | null;
  emi_day: number | null;
  flexible_months: number | null;
  card_minimum_due: number | null;
  due_date: string | null;
}

export async function createLoan(db: SQLiteDatabase, input: LoanInput): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO loans (name, lender, type, purpose, purpose_regret, mode, principal_total,
      principal_remaining, interest_rate, rate_period, compounding, emi_amount, emi_day,
      flexible_months, card_minimum_due, due_date, status, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?)`,
    input.name,
    input.lender,
    input.type,
    input.purpose,
    input.purpose_regret ? 1 : 0,
    input.mode,
    input.principal_total,
    input.principal_remaining,
    input.interest_rate,
    input.rate_period,
    input.compounding,
    input.emi_amount,
    input.emi_day,
    input.flexible_months,
    input.card_minimum_due,
    input.due_date,
    isoDate(),
  );
  return Number(res.lastInsertRowId);
}

export async function updateLoan(
  db: SQLiteDatabase,
  id: number,
  input: LoanInput,
): Promise<void> {
  await db.runAsync(
    `UPDATE loans SET name=?, lender=?, type=?, purpose=?, purpose_regret=?, mode=?,
      principal_total=?, principal_remaining=?, interest_rate=?, rate_period=?, compounding=?,
      emi_amount=?, emi_day=?, flexible_months=?, card_minimum_due=?, due_date=? WHERE id=?`,
    input.name,
    input.lender,
    input.type,
    input.purpose,
    input.purpose_regret ? 1 : 0,
    input.mode,
    input.principal_total,
    input.principal_remaining,
    input.interest_rate,
    input.rate_period,
    input.compounding,
    input.emi_amount,
    input.emi_day,
    input.flexible_months,
    input.card_minimum_due,
    input.due_date,
    id,
  );
}

export async function deleteLoan(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM payments WHERE loan_id = ?', id);
  await db.runAsync('DELETE FROM loans WHERE id = ?', id);
}

/** Records a payment, splits it into interest/principal, updates the loan. */
export async function recordPayment(
  db: SQLiteDatabase,
  loanId: number,
  amount: number,
  paidAt: string = isoDate(),
  note: string | null = null,
): Promise<{ interestPart: number; principalPart: number; closed: boolean } | null> {
  const loan = await getLoan(db, loanId);
  if (!loan || amount <= 0) return null;
  const due = Math.round(interestDue(loan));
  const interestPart = Math.min(amount, due);
  const principalPart = Math.min(loan.principal_remaining, amount - interestPart);
  const newRemaining = loan.principal_remaining - principalPart;
  const closed = newRemaining <= 0;
  await db.runAsync(
    `INSERT INTO payments (loan_id, amount, interest_part, principal_part, paid_at, note)
     VALUES (?,?,?,?,?,?)`,
    loanId,
    amount,
    interestPart,
    principalPart,
    paidAt,
    note,
  );
  await db.runAsync(
    `UPDATE loans SET principal_remaining=?, status=?, closed_at=? WHERE id=?`,
    Math.max(0, newRemaining),
    closed ? 'closed' : 'active',
    closed ? paidAt : null,
    loanId,
  );
  return { interestPart, principalPart, closed };
}

export async function listPayments(db: SQLiteDatabase, loanId: number): Promise<PaymentRow[]> {
  return db.getAllAsync<PaymentRow>(
    'SELECT * FROM payments WHERE loan_id = ? ORDER BY paid_at DESC, id DESC',
    loanId,
  );
}

export async function deletePayment(db: SQLiteDatabase, id: number, loanId: number): Promise<void> {
  const p = await db.getFirstAsync<PaymentRow>('SELECT * FROM payments WHERE id = ?', id);
  if (!p) return;
  await db.runAsync('DELETE FROM payments WHERE id = ?', id);
  const loan = await getLoan(db, loanId);
  if (loan) {
    const newRemaining = loan.principal_remaining + p.principal_part;
    await db.runAsync(
      `UPDATE loans SET principal_remaining=?, status='active', closed_at=NULL WHERE id=?`,
      newRemaining,
      loanId,
    );
  }
}

// ---------- persons / income ----------

export async function ensureSelfPerson(db: SQLiteDatabase, name: string): Promise<number> {
  const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM persons WHERE is_self = 1');
  if (row) return row.id;
  const res = await db.runAsync('INSERT INTO persons (name, is_self) VALUES (?, 1)', name || 'Me');
  return Number(res.lastInsertRowId);
}

export async function listPersons(db: SQLiteDatabase): Promise<PersonRow[]> {
  return db.getAllAsync<PersonRow>('SELECT * FROM persons ORDER BY is_self DESC, id');
}

export async function addPerson(db: SQLiteDatabase, name: string): Promise<number> {
  const res = await db.runAsync('INSERT INTO persons (name, is_self) VALUES (?, 0)', name);
  return Number(res.lastInsertRowId);
}

export interface IncomeSourceInput {
  person_id: number;
  name: string;
  type: IncomeType;
  cadence: Cadence;
  expected_day: number | null;
  expected_amount: number | null;
}

export async function createIncomeSource(db: SQLiteDatabase, i: IncomeSourceInput): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO income_sources (person_id, name, type, cadence, expected_day, expected_amount)
     VALUES (?,?,?,?,?,?)`,
    i.person_id,
    i.name,
    i.type,
    i.cadence,
    i.expected_day,
    i.expected_amount,
  );
  return Number(res.lastInsertRowId);
}

export async function listIncomeSources(db: SQLiteDatabase): Promise<
  (IncomeSourceRow & { person_name: string })[]
> {
  return db.getAllAsync(
    `SELECT s.*, p.name AS person_name FROM income_sources s
     JOIN persons p ON p.id = s.person_id ORDER BY p.is_self DESC, s.id`,
  );
}

export async function deleteIncomeSource(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM income_sources WHERE id = ?', id);
}

export async function createIncomeEvent(
  db: SQLiteDatabase,
  personId: number,
  amount: number,
  occurredOn: string,
  sourceId: number | null,
  note: string | null = null,
): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO income_events (source_id, person_id, amount, occurred_on, note) VALUES (?,?,?,?,?)`,
    sourceId,
    personId,
    amount,
    occurredOn,
    note,
  );
  return Number(res.lastInsertRowId);
}

export async function listIncomeEvents(db: SQLiteDatabase, month: string): Promise<
  (IncomeEventRow & { person_name: string; source_name: string | null })[]
> {
  return db.getAllAsync(
    `SELECT e.*, p.name AS person_name, s.name AS source_name
     FROM income_events e JOIN persons p ON p.id = e.person_id
     LEFT JOIN income_sources s ON s.id = e.source_id
     WHERE substr(e.occurred_on,1,7) = ? ORDER BY e.occurred_on DESC, e.id DESC`,
    month,
  );
}

export async function incomeTotal(db: SQLiteDatabase, month: string): Promise<number> {
  const r = await db.getFirstAsync<{ t: number | null }>(
    `SELECT SUM(amount) AS t FROM income_events WHERE substr(occurred_on,1,7) = ?`,
    month,
  );
  return r?.t ?? 0;
}

// ---------- expenses / budgets ----------

export async function listCategories(db: SQLiteDatabase): Promise<ExpenseCategoryRow[]> {
  return db.getAllAsync<ExpenseCategoryRow>(
    'SELECT id, name, name_key, is_fixed, sort FROM expense_categories ORDER BY sort, id',
  );
}

export async function createCategory(
  db: SQLiteDatabase,
  name: string,
  isFixed: boolean,
): Promise<number> {
  const res = await db.runAsync(
    'INSERT INTO expense_categories (name, is_fixed, sort) VALUES (?,?,100)',
    name,
    isFixed ? 1 : 0,
  );
  return Number(res.lastInsertRowId);
}

export interface MonthSpend {
  category_id: number;
  category_name: string | null;
  category_name_key: string | null;
  is_fixed: 0 | 1;
  spent: number;
  limit_amount: number | null;
}

export async function monthSpendSummary(db: SQLiteDatabase, month: string): Promise<MonthSpend[]> {
  return db.getAllAsync<MonthSpend>(
    `SELECT c.id AS category_id, c.name AS category_name, c.name_key AS category_name_key,
       c.is_fixed AS is_fixed,
       SUM(e.amount) AS spent,
       (SELECT b.limit_amount FROM budgets b
         WHERE b.category_id = c.id AND b.month = ?) AS limit_amount
     FROM expense_categories c
     LEFT JOIN expenses e ON e.category_id = c.id AND substr(e.occurred_on,1,7) = ?
     GROUP BY c.id HAVING spent IS NOT NULL OR limit_amount IS NOT NULL
     ORDER BY c.sort, c.id`,
    month,
    month,
  );
}

export async function createExpense(
  db: SQLiteDatabase,
  categoryId: number,
  amount: number,
  payMethod: PayMethod,
  occurredOn: string,
  note: string | null,
): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO expenses (category_id, amount, pay_method, occurred_on, note) VALUES (?,?,?,?,?)`,
    categoryId,
    amount,
    payMethod,
    occurredOn,
    note,
  );
  return Number(res.lastInsertRowId);
}

export async function listExpenses(db: SQLiteDatabase, month: string): Promise<ExpenseRow[]> {
  return db.getAllAsync<ExpenseRow>(
    'SELECT * FROM expenses WHERE substr(occurred_on,1,7) = ? ORDER BY occurred_on DESC, id DESC',
    month,
  );
}

export async function deleteExpense(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM expenses WHERE id = ?', id);
}

export async function upsertBudget(
  db: SQLiteDatabase,
  month: string,
  categoryId: number,
  limitAmount: number,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO budgets (month, category_id, limit_amount) VALUES (?,?,?)
     ON CONFLICT(month, category_id) DO UPDATE SET limit_amount = excluded.limit_amount`,
    month,
    categoryId,
    limitAmount,
  );
}

export async function listBudgets(db: SQLiteDatabase, month: string): Promise<BudgetRow[]> {
  return db.getAllAsync<BudgetRow>('SELECT * FROM budgets WHERE month = ?', month);
}

// ---------- dashboard helpers ----------

export interface DebtTotals {
  total_borrowed: number | null;
  total_remaining: number | null;
  active_count: number | null;
  closed_count: number | null;
}

export async function debtTotals(db: SQLiteDatabase): Promise<DebtTotals> {
  const r = await db.getFirstAsync<DebtTotals>(
    `SELECT SUM(principal_total) AS total_borrowed,
            SUM(CASE WHEN status='active' THEN principal_remaining ELSE 0 END) AS total_remaining,
            SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active_count,
            SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) AS closed_count
     FROM loans`,
  );
  return r ?? { total_borrowed: 0, total_remaining: 0, active_count: 0, closed_count: 0 };
}

// ---------- M2: emergency fund & short months ----------

export async function addFundTxn(
  db: SQLiteDatabase,
  delta: number,
  occurredOn: string,
  note: string | null = null,
): Promise<number> {
  const res = await db.runAsync(
    'INSERT INTO fund_events (delta, occurred_on, note) VALUES (?,?,?)',
    delta,
    occurredOn,
    note,
  );
  return Number(res.lastInsertRowId);
}

export async function fundBalance(db: SQLiteDatabase): Promise<number> {
  const r = await db.getFirstAsync<{ t: number | null }>('SELECT SUM(delta) AS t FROM fund_events');
  return r?.t ?? 0;
}

export async function listFundTxns(db: SQLiteDatabase, limit = 10): Promise<
  { id: number; delta: number; occurred_on: string; note: string | null }[]
> {
  return db.getAllAsync(
    'SELECT id, delta, occurred_on, note FROM fund_events ORDER BY occurred_on DESC, id DESC LIMIT ?',
    limit,
  );
}

export async function recordShortMonth(
  db: SQLiteDatabase,
  month: string,
  reasonKey: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO short_months (month, reason_key, created_at) VALUES (?,?,?)
     ON CONFLICT(month) DO UPDATE SET reason_key = excluded.reason_key`,
    month,
    reasonKey,
    isoDate(),
  );
}

export async function getShortMonthReason(
  db: SQLiteDatabase,
  month: string,
): Promise<string | null> {
  const r = await db.getFirstAsync<{ reason_key: string }>(
    'SELECT reason_key FROM short_months WHERE month = ?',
    month,
  );
  return r?.reason_key ?? null;
}

export { monthOf };
