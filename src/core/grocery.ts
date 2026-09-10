import { parseIso } from './dates';

export interface GroceryMemoryInput {
  categoryId: number;
  lastMonthSpent: number;
  hasBudgetThisMonth: boolean;
  answeredThisMonth: boolean;
  todayIso: string;
}

export interface GrocerySuggestion {
  categoryId: number;
  lastSpent: number;
  /** budget if half the staples are still left (~50% of last month) */
  suggestedHalf: number;
  /** budget if everything needs buying (same as last month) */
  suggestedSame: number;
}

const MIN_LAST_SPENT = 100000; // ₹1,000 — memory only makes sense with real history
const WINDOW_DAYS = 7; // month-start card

function round100(paise: number): number {
  return Math.round(paise / 10000) * 10000;
}

/**
 * Grocery month-start memory (Q24): "last month groceries were ₹X — half the
 * staples still left?" → 1-tap sets a realistic budget, freed money goes to
 * the top loan. Deterministic, purely from expense history.
 */
export function groceryMemory(input: GroceryMemoryInput): GrocerySuggestion | null {
  const day = parseIso(input.todayIso).getDate();
  if (day > WINDOW_DAYS) return null;
  if (input.answeredThisMonth || input.hasBudgetThisMonth) return null;
  if (input.lastMonthSpent < MIN_LAST_SPENT) return null;
  return {
    categoryId: input.categoryId,
    lastSpent: input.lastMonthSpent,
    suggestedHalf: round100(input.lastMonthSpent * 0.5),
    suggestedSame: round100(input.lastMonthSpent),
  };
}
