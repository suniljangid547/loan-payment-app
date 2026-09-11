# Store Listing — LoanPay (M4 launch material)

> Bundle IDs: `com.loanpay.app` (Android `package` + iOS `bundleIdentifier`).
> Fill placeholders marked `[ ]` before submission.

## App identity

| Field | Value |
|---|---|
| App name (30 chars max) | LoanPay — Loan ka Poora Hisaab |
| Short tagline | Har loan ka hisaab, byaj bachane ka plan |
| Category | Finance (Play) / Finance (App Store) |
| Content rating | Everyone / 4+ |
| Contains ads | No |
| In-app purchases | No (v1) · [ ] add later if paywall ships |
| Data safety | Data NOT shared, NOT collected off-device; all data stored locally; app provides account deletion via data wipe (Uninstall clears all; in-app backup is user-owned) |

## Play Store — short description (80 chars max)

```
Bank, sekda, dost, card — sab udhaar ek jagah. AI batayega pehle kaunsa bharo.
```

## Play Store — full description

```
LoanPay — loan ka poora hisaab, AI ka pakka plan.

Bank loan, sekda/bayaj, dost ya rishtedaar, credit card — sab udhaar ek jagah,
aur app khud batati hai: PEHLE KAUNSA BHAARO, AUR KYON.

💡 AI PRITICALITY ENGINE
• Har loan ke liye clear reason — "3% monthly = 36% saal ka, sabse mehnga"
• Avalanche + snowball mix: byaj bachao, chhoti jeet bhi dikhe
• Credit card ka chhupa hua 36–42% byaj pakdo

📅 12 MAHINE KA PLAN
• Har mahine kisko kitna dena hai
• Loan band hote hi uski EMI agle loan pe redirect
• "Minimum se kitna byaj bachega" — exact number

💸 PAISA AAYA? TURANT PLAN
• Income enter karo → 3 options: best byaj bachat / safest / fastest loan-band
• One tap me apply

🛡️ SAFETY NET
• Emergency fund coach — mushibat ke liye pehle ₹ alag
• Health insurance education card (Ayushman Bharat info)
• Short-month mode: medical/festival mahine me kya protect karo, kya defer

🧾 KHRACHA CONTROL
• Category-wise budget, 80%/100% warning — "₹15k cross = EMI miss ya naya udhaar"
• Spending coach: "Kharche me se ₹X bachao = loan N mahine jaldi khatam"
• UPI/Cash/Card/Bank split

⏰ REMINDERS (sab aapke phone pe)
• Subah 8: aaj ka plan · EMI se 3 din pehle alert · card due alert
• Sab LOCAL notifications — koi server nahi, koi tracking nahi

🛠️ SIDE-INCOME IDEAS
• Aapke skills (driving, tuition, silai, repair…) se roz 1 idea
• Har idea aapke loan ke byaj se juda — "₹3,000/mahina = poora byaj!"

🏠 OFFLINE-FIRST & PRIVATE
• Internet ki zaroorat nahi — sab kuch aapke phone me
• Backup file banao, doosre phone pe wapas lao
• English / हिन्दी / Hinglish · ₹ aur 8+ currencies · dark mode

LoanPay loan NAHI deta — loan KHATAM karta hai. Koi ads nahi, koi data-selling nahi.

Disclaimer: LoanPay lender nahi hai. Sab figures estimate hain — apne lender
se verify karein. Insurance jaankari sirf education ke liye hai.
```

## ASO keywords (Play "managed keywords" / App Store 100 chars)

```
loan,udhaar,karz,byaj,interest,emi,sekda,debt,repayment,hisaab,khata,paisa,loan tracker,emi reminder
```

## Release name (version 1.0.0)

```
1.0 (1) — first public release
```

## Screenshots checklist (min 2 per store, phone)

1. [ ] Dashboard — total debt ring, "AI: pay this first" card (seed: 3 loans, 42% paid)
2. [ ] Plan tab — priority list with reason chips + 12-month projection chart
3. [ ] Allocation sheet — "₹10,000 aaye — kahan daalein?" 3 options
4. [ ] Loan detail — progress bar, balance-over-time chart, payment history
5. [ ] Expenses — budget bars + spending coach banner
6. [ ] Hindi/Hinglish dashboard (localization proof)

## Feature graphic (Play, 1024×500)

- Deep green `#0B6E4F` background, white ₹ coin (matches app icon)
- Headline: "Loan ka poora hisaab" · sub: "AI ka pakka plan"
- 3 chips: "AI priority" · "12-mahina plan" · "100% offline"

## Pre-launch QA

- [ ] `npx expo start` on a physical Android + iOS device
- [ ] Onboarding all 3 steps, incl. skill selection
- [ ] Add loan of each mode (bank EMI, sekda interest-only, flexible, card)
- [ ] Record payment → split toast → close loan → redirect prompt
- [ ] Build plan → chart → share to WhatsApp
- [ ] Backup export → wipe app data → import → verify all tabs
- [ ] Notifications on device (daily 8am, EMI −3d, idea 7pm)
- [ ] Language switch mid-session (en ↔ hi ↔ hinglish)
- [ ] Currency switch INR ↔ AED on profile

## Submission notes

- Play: create app → set Data safety per table above → upload AAB (`eas build -p android --profile production`) → complete content rating questionnaire (Finance, no gambling) → internal testing track first (20–30 borrowers per PLAN open question #4)
- App Store: needs Apple Developer account + `eas build -p ios`; TestFlight beta first
- Privacy policy URL required by both stores — host a static page summarizing the "no data leaves the phone" policy (can be a GitHub Pages file in this repo)
