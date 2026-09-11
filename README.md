# LoanPay — har loan ka poora hisaab, offline

Offline-first loan repayment planner for Android & iOS (Expo + React Native + TypeScript).
Track every loan — bank, NBFC, sekda/moneylender, friend/relative, credit card — and let a
deterministic AI engine tell you which one to close first, why, and how much interest you save.

> "Ye app loan nahi deta, loan **khatam** karta hai." — no ads, no lending, numbers stay on your phone.

## Features

- **Loan tracker** — fixed EMI, sekda-style monthly interest, flexible (pay when able), credit card (total due + minimum due)
- **AI priority engine** — avalanche + snowball hybrid with explainable reasons (rate, due soon, small win, failed purpose, card boost)
- **12-month plan** — month-by-month simulation, freed-EMI redirect, debt-over-time chart, interest saved vs minimums-only
- **Income hub** — multi-source, family members, instant allocation sheet ("paisa aaya?") with 3 tap-to-apply options
- **Expenses & budgets** — categories, 80%/100% warnings, pay-method split, spending coach (cut → loan closes N months earlier)
- **Safety net** — emergency fund with target, insurance education card, short-month protection flow (unavoidables first)
- **Side-income ideas** — daily skill-based idea tied to your top loan's monthly interest
- **Grocery memory** — month-start 1-tap budget from last month's spend
- **Local reminders** — daily plan, EMI −3d, card due; all scheduled on-device
- **3 languages** — English, हिन्दी, Hinglish · multi-currency (INR default) · dark/light

## Tech

Expo SDK 57 · React Native 0.86 · expo-router · expo-sqlite (offline, migrations) ·
expo-notifications · react-native-svg · zustand · i18next. No backend.

## Develop

```bash
npm install
npm run start        # Expo dev server
npm run test:core    # deterministic engine tests (interest, priority, plan, coach, ideas)
npm run lint         # expo lint
npx tsc --noEmit     # typecheck
```

## Structure

```
src/core/     # pure engines: interest, priority, plan, coach, ideas, grocery, dates, money
src/db/       # sqlite schema (migrations) + repositories
src/app/      # expo-router screens: (tabs) home/loans/income/expenses/plan + flows
src/i18n/     # translations (en / hi / hinglish)
scripts/      # engine tests
```

## Build

EAS configured (`eas.json`): `development`, `preview` (apk), `production` (aab).
Bundle IDs: `com.loanpay.app`.

## Compliance

Not a lender. No loan selling, no credit-score claims, insurance content is education only.
All financial figures are estimates — verify with your lender.
