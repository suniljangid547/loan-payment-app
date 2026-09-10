import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';

export type Language = string;

export interface LangDef {
  code: Language;
  native: string;
  english: string;
}

export interface CountryDef {
  code: string;
  currency: string;
  flag: string;
  name: string;
  languages: LangDef[];
}

export interface PersistedSettings {
  onboarded: boolean;
  name: string;
  language: Language;
  country: string;
  currency: string;
  hasInsurance: boolean | null;
  insuranceDismissed: boolean;
  /** minor units; null = auto (one month of essentials) */
  fundTarget: number | null;
  /** side-income skill keys (SkillKey in core/ideas) */
  skills: string[];
}

const KEY = 'loanpay.settings.v1';

const EN: LangDef = { code: 'en', native: 'English', english: 'English' };
const HI: LangDef = { code: 'hi', native: 'हिन्दी', english: 'Hindi' };
const HINGLISH: LangDef = { code: 'hinglish', native: 'हिंग्लिश', english: 'Hinglish' };
const AR: LangDef = { code: 'ar', native: 'العربية', english: 'Arabic' };
const UR: LangDef = { code: 'ur', native: 'اردو', english: 'Urdu' };
const NE: LangDef = { code: 'ne', native: 'नेपाली', english: 'Nepali' };
const ES: LangDef = { code: 'es', native: 'Español', english: 'Spanish' };
const TA: LangDef = { code: 'ta', native: 'தமிழ்', english: 'Tamil' };
const BN: LangDef = { code: 'bn', native: 'বাংলা', english: 'Bengali' };

export const COUNTRIES: CountryDef[] = [
  { code: 'IN', currency: 'INR', flag: '🇮🇳', name: 'India', languages: [HI, EN, HINGLISH, TA] },
  { code: 'AE', currency: 'AED', flag: '🇦🇪', name: 'United Arab Emirates', languages: [EN, AR, HI, UR] },
  { code: 'SA', currency: 'SAR', flag: '🇸🇦', name: 'Saudi Arabia', languages: [AR, EN, UR] },
  { code: 'US', currency: 'USD', flag: '🇺🇸', name: 'United States', languages: [EN, ES] },
  { code: 'GB', currency: 'GBP', flag: '🇬🇧', name: 'United Kingdom', languages: [EN] },
  { code: 'PK', currency: 'PKR', flag: '🇵🇰', name: 'Pakistan', languages: [UR, EN] },
  { code: 'NP', currency: 'NPR', flag: '🇳🇵', name: 'Nepal', languages: [NE, EN] },
  { code: 'BD', currency: 'BDT', flag: '🇧🇩', name: 'Bangladesh', languages: [BN, EN] },
  { code: 'OTHER', currency: 'USD', flag: '🌍', name: 'Other', languages: [EN] },
];

export function countryByCode(code: string): CountryDef {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[COUNTRIES.length - 1];
}

const DEFAULTS: PersistedSettings = {
  onboarded: false,
  name: '',
  language: 'en',
  country: 'IN',
  currency: 'INR',
  hasInsurance: null,
  insuranceDismissed: false,
  fundTarget: null,
  skills: [],
};

function load(): PersistedSettings {
  try {
    const raw = Storage.getItemSync(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<PersistedSettings>) };
  } catch {
    // fall through to defaults
  }
  return DEFAULTS;
}

interface SettingsStore extends PersistedSettings {
  update: (partial: Partial<PersistedSettings>) => void;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...load(),
  update: (partial) => {
    set(partial);
    const { update: _update, ...persisted } = get();
    try {
      Storage.setItemSync(KEY, JSON.stringify(persisted));
    } catch {
      // storage failure should not crash the app
    }
  },
}));

export function currencyForCountry(country: string): string {
  return COUNTRIES.find((c) => c.code === country)?.currency ?? 'USD';
}
