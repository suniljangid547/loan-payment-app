/**
 * Local premium gating (no external SDK key needed). Keeps PLAN §12 honest:
 * - Free tier: everything core works forever (trust).
 * - Premium gates: 12-month plan details + unlimited receipt scans.
 * State lives in the local settings store so it works offline and survives
 * restarts. RevenueCat can replace the `isPremium` check later by swapping
 * the store key — call sites stay the same.
 */
import { useSettings } from '@/store/settings';

export type Entitlement = 'free' | 'premium';

export function entitlement(): Entitlement {
  const s = useSettings.getState() as unknown as { premium?: boolean } & ReturnType<typeof useSettings.getState>;
  return (s as unknown as { premium?: boolean }).premium ? 'premium' : 'free';
}

export function isPremium(): boolean {
  return entitlement() === 'premium';
}

/** Display copy for the paywall sheet. Kept in code so it works even before i18n is ready. */
export function paywallCopy(lang: string): { title: string; bullets: string[]; cta: string; later: string } {
  if (lang === 'hi') {
    return {
      title: 'Premium — 12 महीने का पूरा प्लान',
      bullets: ['हर महीने क़िस्त + ब्याज का हिसाब', 'अनलिमिटेड रसीद स्कैन', 'परिवार शेयर + क्लाउड बैकअप', 'कोई विज्ञापन नहीं'],
      cta: 'Premium चालू करें',
      later: 'बाद में',
    };
  }
  if (lang === 'hinglish') {
    return {
      title: 'Premium — poora 12 mahine ka plan',
      bullets: ['Har mahine ka EMI+byaj plan', 'Unlimited receipt scans', 'Family share + cloud backup', 'Koi ads nahi'],
      cta: 'Premium le lo',
      later: 'Abhi nahi',
    };
  }
  return {
    title: 'Premium — full 12-month plan',
    bullets: ['Month-by-month EMI + interest', 'Unlimited receipt scans', 'Family share + cloud backup', 'No ads, ever'],
    cta: 'Unlock Premium',
    later: 'Maybe later',
  };
}
