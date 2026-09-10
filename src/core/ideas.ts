import { interestDue } from './interest';
import { rankLoans } from './priority';
import type { LoanRow } from './types';
import { isoDate, parseIso } from './dates';

export const SKILL_KEYS = [
  'driving',
  'tuition',
  'cooking',
  'mobile_repair',
  'tailoring',
  'beauty',
  'electrician',
  'plumbing',
  'video_editing',
  'computer',
] as const;
export type SkillKey = (typeof SKILL_KEYS)[number];

/** Modest part-time monthly earning estimates (minor units) — ideas are labelled "estimate" in UI. */
export const SKILL_EARNINGS: Record<SkillKey, number> = {
  driving: 300000,
  tuition: 400000,
  cooking: 250000,
  mobile_repair: 500000,
  tailoring: 350000,
  beauty: 450000,
  electrician: 550000,
  plumbing: 500000,
  video_editing: 500000,
  computer: 400000,
};

export interface DailyIdea {
  skillKey: SkillKey;
  earn: number;
  loanName: string | null;
  monthlyInterest: number | null;
  coversFull: boolean;
  coversPct: number;
}

/**
 * Deterministic daily side-income idea (Q25–28): rotates through the user's
 * skills by day of year and ties the earning estimate to the #1 priority
 * loan's monthly interest. Same day → same idea, offline, no LLM.
 */
export function dailyIdea(
  skills: string[],
  loans: LoanRow[],
  todayIso: string = isoDate(),
): DailyIdea | null {
  const known = skills.filter((s): s is SkillKey => (SKILL_KEYS as readonly string[]).includes(s));
  if (known.length === 0) return null;
  const d = parseIso(todayIso);
  const dayOfYear = Math.floor(
    (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const skillKey = known[dayOfYear % known.length];
  const earn = SKILL_EARNINGS[skillKey];

  const top = rankLoans(loans, todayIso)[0]?.loan ?? null;
  if (!top) {
    return { skillKey, earn, loanName: null, monthlyInterest: null, coversFull: false, coversPct: 0 };
  }
  const mi = Math.round(interestDue(top));
  if (mi <= 0) {
    return { skillKey, earn, loanName: top.name, monthlyInterest: mi, coversFull: true, coversPct: 100 };
  }
  return {
    skillKey,
    earn,
    loanName: top.name,
    monthlyInterest: mi,
    coversFull: earn >= mi,
    coversPct: Math.min(100, Math.round((earn / mi) * 100)),
  };
}
