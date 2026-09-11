/// <reference types="node" />
import assert from 'node:assert';
import { buildPlan } from '../src/core/plan';
import { interestDue, interestSavedWithExtra, projectPayoff, stepPayment } from '../src/core/interest';
import { rankLoans } from '../src/core/priority';
import { spendingCoach, type CoachCategoryInput } from '../src/core/coach';
import { dailyIdea, SKILL_KEYS } from '../src/core/ideas';
import { groceryMemory } from '../src/core/grocery';
import { validateBackup } from '../src/db/backup';
import type { LoanRow } from '../src/core/types';

const base: LoanRow = {
  id: 1,
  name: 'Golu sekha',
  lender: 'Golu',
  type: 'sekda',
  purpose: 'medical',
  purpose_regret: 0,
  mode: 'interest_only',
  principal_total: 100000,
  principal_remaining: 100000,
  interest_rate: 2,
  rate_period: 'monthly',
  compounding: 'simple_on_principal',
  emi_amount: null,
  emi_day: null,
  flexible_months: null,
  card_minimum_due: null,
  due_date: null,
  status: 'active',
  created_at: '2026-01-01',
  closed_at: null,
};

// sekda: 1 lakh @2%/month = 2000 interest, principal stays if only interest paid
assert.strictEqual(Math.round(interestDue(base)), 2000);
const only = stepPayment(base, 2000);
assert.strictEqual(only.interestPart, 2000);
assert.strictEqual(only.principalPart, 0);
// pay 12000 → 2000 interest + 10000 principal
const big = stepPayment(base, 12000);
assert.strictEqual(big.principalPart, 10000);

// EMI loan: 50k @12% yearly over 12 → standard EMI ≈ 4442.5, payoff in 12 months
const emi: LoanRow = {
  ...base,
  id: 2,
  mode: 'fixed_emi',
  compounding: 'interest_on_interest',
  principal_total: 50000,
  principal_remaining: 50000,
  interest_rate: 12,
  rate_period: 'yearly',
  emi_amount: 4442,
};
const payoff = projectPayoff(emi, 4442);
assert.ok(payoff.months !== null && payoff.months >= 12 && payoff.months <= 13, `months=${payoff.months}`);

// too-low payment on compound loan → never closes
assert.strictEqual(projectPayoff(emi, 400).months, null);

// extra one-time 4000 on sekda reduces lifetime interest vs interest-only
const saved = interestSavedWithExtra(base, 4000);
assert.ok(saved.interestSaved > 700, `interestSaved=${saved.interestSaved}`);

// card minimum-only spins for ages; full bill clears in 1
const card: LoanRow = {
  ...base,
  id: 3,
  mode: 'credit_card',
  type: 'credit_card',
  compounding: 'interest_on_interest',
  principal_total: 30000,
  principal_remaining: 30000,
  interest_rate: 36,
  rate_period: 'yearly',
  card_minimum_due: 1500,
  due_date: '2026-10-05',
};
const minOnly = projectPayoff(card, 1500);
assert.ok(minOnly.months === null || minOnly.months > 24, `minOnly=${minOnly.months}`);

// priority: overdue card tops a clean sekda with same-ish rate
const sekdaHigh: LoanRow = { ...base, id: 4, interest_rate: 3 };
const ranked = rankLoans([sekdaHigh, { ...card, id: 5 }], '2026-10-01');
assert.strictEqual(ranked[0].loan.id, 5, JSON.stringify(ranked.map((r) => [r.loan.id, r.score])));
assert.ok(ranked[0].reasons.length > 0);

// plan simulation: 15k/mo, redirect on, 12 months
const plan = buildPlan([sekdaHigh, card], 15000, { redirectFreedEmis: true, todayIso: '2026-10-01' });
assert.strictEqual(plan.totalCount, 2);
assert.ok(plan.totalInterest >= 0);
const spent = plan.months.reduce((s, m) => s + m.payments.reduce((x, p) => x + p.amount, 0), 0);
assert.ok(spent <= 15000 * 12 + 1, `spent=${spent}`);
const cardRow = plan.rows.find((r) => r.loanId === card.id)!;
assert.ok(cardRow.payoffMonth !== null, 'card should clear within 12 at 15k/mo');

// monthly totalRemaining must fall monotonically and reconcile with principal paid
const totalStart = plan.rows.reduce((s, r) => s + r.startBalance, 0);
let prev = totalStart;
for (const m of plan.months) {
  assert.ok(m.totalRemaining <= prev, `debt must not grow: ${prev} -> ${m.totalRemaining}`);
  prev = m.totalRemaining;
}
const totalPrincipal = plan.rows.reduce((s, r) => s + r.principalPaid, 0);
assert.ok(
  Math.abs(plan.months[plan.months.length - 1].totalRemaining - (totalStart - totalPrincipal)) < 1,
  'final balance must reconcile with principal paid',
);

// spending coach: over-budget category wins, cut = spent - limit
const cats: CoachCategoryInput[] = [
  { category_id: 1, category_name: 'Groceries', category_name_key: 'cat.groceries', is_fixed: 0, spent: 800000, limit_amount: 500000 },
  { category_id: 2, category_name: 'Rent', category_name_key: 'cat.rent', is_fixed: 1, spent: 900000, limit_amount: null },
  { category_id: 3, category_name: 'Travel', category_name_key: 'cat.travel', is_fixed: 0, spent: 400000, limit_amount: null },
];
const coach = spendingCoach(cats, [base], '2026-10-01');
assert.ok(coach && coach.kind === 'over', `kind=${coach?.kind}`);
assert.strictEqual(coach.categoryId, 1);
assert.strictEqual(coach.cut, 300000);
// sekda baseline only pays interest (never closes) → the win is "never → closes in N"
assert.strictEqual(coach.monthsSaved, null);
assert.ok((coach.closesIn ?? 0) > 0, `closesIn=${coach.closesIn}`);

// closing baseline (EMI loan) → months earlier + interest saved
const emiLoan: LoanRow = {
  ...base,
  id: 9,
  mode: 'fixed_emi',
  compounding: 'interest_on_interest',
  principal_total: 800000,
  principal_remaining: 800000,
  interest_rate: 18,
  rate_period: 'yearly',
  emi_amount: 30000,
};
const coachEmi = spendingCoach(cats, [emiLoan], '2026-10-01');
assert.ok(coachEmi && (coachEmi.monthsSaved ?? 0) > 0, `monthsSaved=${coachEmi?.monthsSaved}`);
assert.ok(coachEmi.interestSaved > 0, `interestSaved=${coachEmi.interestSaved}`);

// no budget → 25% cut on biggest variable category
const coachCut = spendingCoach(
  cats.map((c) => (c.category_id === 1 ? { ...c, limit_amount: null } : c)),
  [base],
  '2026-10-01',
);
assert.ok(coachCut && coachCut.kind === 'cut', `kind=${coachCut?.kind}`);
assert.strictEqual(coachCut.categoryId, 1); // groceries 800k > travel 400k
assert.strictEqual(coachCut.cut, 200000); // 25%

// tiny spends / no actives → no nudge
assert.strictEqual(spendingCoach(cats.map((c) => ({ ...c, spent: 1000 })), [base], '2026-10-01'), null);
assert.strictEqual(spendingCoach(cats, [], '2026-10-01'), null);
// 0% loan + no budget anywhere → cut branch yields no impact → no nudge
const freeLoan: LoanRow = { ...base, interest_rate: 0 };
const noBudget = cats.map((c) => ({ ...c, limit_amount: null }));
assert.strictEqual(spendingCoach(noBudget, [freeLoan], '2026-10-01'), null);
// over-budget nudge still fires with a 0% loan (budget discipline), just without impact lines
const coachFree = spendingCoach(cats, [freeLoan], '2026-10-01');
assert.ok(coachFree && coachFree.kind === 'over' && coachFree.interestSaved === 0);

// daily idea: deterministic rotation + loan tie-in
assert.strictEqual(dailyIdea([], [base], '2026-10-01'), null);
const ideaA = dailyIdea(['driving', 'tuition'], [base], '2026-10-01');
const ideaA2 = dailyIdea(['driving', 'tuition'], [base], '2026-10-01');
assert.ok(ideaA && ideaA2 && ideaA.skillKey === ideaA2.skillKey, 'same day must give the same idea');
assert.ok(SKILL_KEYS.includes(ideaA.skillKey));
// sekda: monthly interest 2000, driving earn 300000 paise → covers fully
const ideaDriving = dailyIdea(['driving'], [base], '2026-10-01');
assert.ok(ideaDriving && ideaDriving.coversFull && ideaDriving.coversPct === 100);
// big loan interest → partial cover pct
const bigSekda: LoanRow = { ...base, principal_remaining: 25000000 }; // 2% = 500000/mo
const ideaPartial = dailyIdea(['driving'], [bigSekda], '2026-10-01');
assert.ok(ideaPartial && !ideaPartial.coversFull && ideaPartial.coversPct === 60);
// unknown skills ignored
assert.strictEqual(dailyIdea(['astronaut'], [base], '2026-10-01'), null);

// grocery memory: month-start window, answered/budget/small-spend suppression
const gmOk = groceryMemory({
  categoryId: 1,
  lastMonthSpent: 620000,
  hasBudgetThisMonth: false,
  answeredThisMonth: false,
  todayIso: '2026-10-03',
});
assert.ok(gmOk);
assert.strictEqual(gmOk.suggestedSame, 620000);
assert.strictEqual(gmOk.suggestedHalf, 310000);
assert.strictEqual(
  groceryMemory({ categoryId: 1, lastMonthSpent: 620000, hasBudgetThisMonth: false, answeredThisMonth: false, todayIso: '2026-10-09' }),
  null,
  'outside month-start window',
);
assert.strictEqual(
  groceryMemory({ categoryId: 1, lastMonthSpent: 620000, hasBudgetThisMonth: false, answeredThisMonth: true, todayIso: '2026-10-03' }),
  null,
  'already answered',
);
assert.strictEqual(
  groceryMemory({ categoryId: 1, lastMonthSpent: 620000, hasBudgetThisMonth: true, answeredThisMonth: false, todayIso: '2026-10-03' }),
  null,
  'budget already set',
);
assert.strictEqual(
  groceryMemory({ categoryId: 1, lastMonthSpent: 50000, hasBudgetThisMonth: false, answeredThisMonth: false, todayIso: '2026-10-03' }),
  null,
  'history too small',
);

// backup validation: shape checks, future-schema rejection, garbage rejection
const good = {
  app: 'loanpay',
  schemaVersion: 3,
  exportedAt: '2026-09-11',
  settings: { name: 'Sunil' },
  tables: { loans: [{ id: 1 }], payments: [] },
};
assert.ok(validateBackup(good));
assert.strictEqual(validateBackup({ ...good, app: 'other' }), null);
assert.strictEqual(validateBackup({ ...good, schemaVersion: 99 }), null);
assert.strictEqual(validateBackup({ ...good, schemaVersion: 0 }), null);
assert.strictEqual(validateBackup({ ...good, tables: { loans: 'nope' } }), null);
assert.strictEqual(validateBackup('junk'), null);
assert.strictEqual(validateBackup(null), null);
// rows optional per table
assert.ok(validateBackup({ ...good, tables: {} }));

console.log('core engine tests passed ✓');
