# Loan Freedom App — Full Product & Tech Plan (v1)

> Based on 43 answered questions (Sep 2026). Working title: **"Karz Mukut" / "DebtFree"** (final naam later).
> Tagline idea: "Loan ka poora hisaab, AI ka pakka plan."

---

## 0. Assumptions & clarifications (answers me jo unclear tha)

1. **Q7 ka jawab ulta padha gaya** — final interpretation: **App khud recommend karega** ki aayi hui income ka kitna hissa kis loan me jaye (user ko 2–3 options + reason ke saath). Sirf-paise-yaad-rakhne-wala diary nahi banega, warna app ka koi use nahi. (Confirm karna hai)
2. **Q10** — Default view = **sorted priority list** ("ye loan pehle bharo, KYON ye reason"). "Full 12-month plan" ek secondary screen/toggle hoga.
3. **Q19** — Maan rahe hain insurance status onboarding me pucha jayega; "Nahi hai" wale ko educational card dikhega. Reminder nahi, bas one-time + quarterly gentle nudge.
4. **Q42 bank loan offers** — Direct bank tie-up ke bina AI sirf **generic balance-transfer suggestion** dega ("70% loan 24% pe hai, bank loan ~12% pe transfer karne ke liye apne bank se poocho" + free comparison resources). Koi lending/loan-selling nahi (compliance risk).
5. **Family share (Q33)** = read-only access email invite se. Family income add (Q9) = primary user enter karta hai, tagged & lag-flagged.
6. **Only free resources** — paid APIs avoid. OCR = on-device (ML Kit), backend = Supabase free tier, auth = free, notifications = local.

---

## 1. Product pillars

| # | Pillar | One-line |
|---|--------|----------|
| 1 | Loan Tracker | Har udhaar (bank→sekda→dost→credit card) ek jagah, exact "total due" ke saath |
| 2 | Income Hub | Multi-source, multi-person income, tagged |
| 3 | AI Repayment Strategist | Kaunsa loan pehle, kyun, kitna bachega — priority engine + 12-mahina plan |
| 4 | AI Cash-Coach | Paisa aate hi instant "daal do, itna byaj bachega" notification |
| 5 | Expense + Budget | Category khata, UPI/cash split, budget→loan-risk warning, receipt OCR |
| 6 | Safety Net | Emergency fund coach + health-insurance education card |
| 7 | Side-Income AI | Skill-based roz ka practical idea + free YouTube/course |
| 8 | Family & Global | Read-only family view, multi-language/currency, offline-first |

**Positioning:** "Ye app loan nahi deta, loan **khatam** karta hai." No ads. Freemium.

---

## 2. Screen map (user journey)

```
Splash → Language/Country → Auth (Email/Google/Apple)
→ Onboarding Wizard (8 steps, conversational):
   name → job type (Job/Business/Freelance/Kheti/Student/Other) → skills (multi-select + custom)
   → income sources (add now/later) → loans (quick add 1, rest baad me) → expenses snapshot
   → insurance? (hai/nahi + cover) → emergency fund? → goals + AI language (Hindi/Eng/Hinglish)
→ HOME (Dashboard)
   ├── Today's Plan (aaj kya dena/khana hai + 1 motivation line)
   ├── Debt Progress Ring (overall X% khatam, ~Y mahine bache)
   ├── Priority Loans (sorted card list, reason chip ke saath)
   ├── AI Coach banner ("₹10,000 aaye? 4,000 sekda wale me daalo → ₹800 bachega")
   └── Quick add: [+] Paisa Aaya  [+] Kharcha  [+ Loan]
→ Loans tab → Loan detail (progress bar, amortization mini-chart, payment history)
→ Income tab → sources + family member breakdown (lag indicator)
→ Expenses tab → categories, budget bars, UPI/Cash/Card/Bank split, receipt-scan FAB
→ Plan tab → AI priority list ⇄ 12-month plan toggle, simulators, "loan closed → EMI redirect" cards
→ Insights tab → graphs (balance over time, per-loan progress, expense vs budget)
→ Profile → language, currency, theme, family sharing, backup, premium
```

---

## 3. Data model (SQLite mirror — offline-first)

```
Person(id, name, role=self|spouse|parent|other)
Loan(
  id, name, lender, loan_type,            // bank|nbfc|personal|gold|vehicle|kheti|sekda_bayaj|dost_relative|credit_card|other
  purpose,                                 // "Kuy liya?"
  purpose_fulfilled,                       // yes|no|ongoing  → Q: "jis kaam ke liye liya wo hua ya nahi"
  mode,                                    // fixed_emi | flexible_when_able | interest_first (sekda)
  principal_total, principal_remaining,
  interest_rate, interest_frequency,       // yearly | monthly
  interest_compounding,                    // simple_on_principal | interest_on_interest  (add karte time dono option — user ki choice)
  emi_amount, emi_day, next_due_date,
  is_secured,
  created_at, closed_at
)
CreditCardExt(loan_id, total_due, minimum_due, statement_date, due_date, billing_cycle, payment_mode)
   // total_due + minimum_due BOTH track → "jalid se jalid clear" strategy:
   // minimum ke baad bache hue pe jitna jaldi ho sake, kyunki full-clear na hone pe pure bill pe byaj lagta hai
FlexibleLoanExt(loan_id, promised_back_date, negotiable_months, last_settlement_talk_at)
   // dost/relative wala: AI poochta hai "ye paisa kitne mahine baad de sakte ho?" → soft reminder timeline
Payment(id, loan_id, amount, principal_part, interest_part, date, method, note)
IncomeSource(id, person_id, name, type,                      // salary|business|commission|bonus|kheti|rental|deal|freelance|other(custom field)
  cadence,          // monthly_fixed|irregular|one_time
  expected_day, expected_amount, is_family_contribution, lag_flag)
IncomeEvent(id, source_id, person_id, amount, date, allocated_json, note)
ExpenseCategory(id, name, is_fixed)   // seed: khana/grocery, kiraya, light_bill(variable), bachho ki fees, ration, travel, medical, phone, festival, other + custom
Budget(month, category_id, person_id, limit, warn_thresholds=[80%,100%])
Expense(id, category_id, amount, date, pay_method,           // upi|cash|card|bank_transfer|other
  receipt_uri, ocr_json, created_by)
EmergencyFund(id, target, balance, monthly_suggest)
InsuranceEdu(id, has_insurance, cover_amount, family_members, shown_at)
SuggestionLog(id, type, payload, user_action,                 // accepted|dismissed → AI ko feedback signal
  created_at)
Skill(id, name, availability_hours)   // driving, dukaan, mobile_repair, kheti, cooking, computer, tailoring, electrician, plumbing, beauty, tuition, video_editing, written_content, two_wheeler, phone + CUSTOM
```

Money storage: integer paise/cents + currency code (multi-currency safe).

---

## 4. Loan add-flow (Q1–Q5 final fields)

**Common:** Loan name • Kisse liya (lender) • Type (chips: Bank/Personal/Gold/Vehicle/Kheti/Sekda-Bayaj/Dost-Cousin/Credit card/Other) • Total amount • **Remaining amount YA total EMIs — user jo jaanta ho wahi; app doosra auto-derive kare** ("logo ko nahi pata kitna bana hua hai" → dono input support + auto-calc) • Byaj % + **yearly ya monthly** • EMI date • Loan ka purpose + **"wo kaam hua ya nahi?"** (insight: failed-purpose loans ko AI priority me upar laata hai — sunk-cost mindset todne ke liye)

**Byaj calculation (Q2):** add karte hi 2 options poocho:
1. "Sirf principal pe byaj" (simple, sekda-style: 1 lakh × 2% = ₹2000/mahina, principal fixed jab tak na de)
2. "Byaj Judkar uspe byaj" (compounding/amortized EMI)
→ Dono ke liye alag engine (Sec 5). Monthly-rate toggle bhi (sekda me 2%/month common hai).

**No photo/proof upload** (Q3 — user ne mana kiya). ✅ simpler.

**Flexible loans (Q4):** mode = "jab paisa ho tab dunga" → AI onboarding pe poochta hai *"kitne mahine aur ruk sakte ho?"* → promised-back date banta hai → reminder uske around, EMI-style nahi.

**Credit card (Q5):** Total Due + Minimum Due dono + statement/due date. AI strategy: minimum-bachao (late fee + interest cycle se bachne ka floor) → phir **maximum possible total-dupe** — kyunki minimum bharne pe rest pe ~36–42% annual byaj chalu rehta hai. "Jalid se jalid clear" mode default.

---

## 5. AI Repayment Engine (sabse important)

### 5.1 Priority scoring (deterministic, explainable)
```
score = w1*interest_rate_normalized
      + w2*late_damage        // penalty/CIBIL/card-spin risk
      + w3*small_balance_bonus// snowball: jaldi ek loan "closed" = motivation
      + w4*purpose_regret     // failed-purpose loan upar
      + w5*credit_card_boost  // 36-42% hidden interest
```
Default mix **Avalanche + Snowball hybrid** (byaj bachao, par chhota-jeet bhi dikhao). Har card pe one-line reason: *"Ye pehle karo — 3% monthly = 36% saal ka, sabse mehnga."*

### 5.2 Amortization engines
- `simple_on_principal` (sekda): monthly interest = P × r; EMI me jo gaya sirf usse P ghatता; byaj kabhi nahi ruka — "jaldi principal do, byaj katega" messaging.
- `interest_on_interest` (EMI/compounding): standard EMI formula + schedule generator.
- Credit card: revolving minimum-due model.

### 5.3 Features
- **12-month plan** (toggle): har mahine kisko kitna, projected payoff dates, total interest saved vs "minimum only".
- **Loan-closed redirect (Q11):** "Golu sekda band → ₹5,000/mahine free. Isse Riya card me jodo → 4 mahine jaldi. **Pehle:** AI poochta hai *'aane wale 3 mahino me koi bada kharcha (fees/shadi/upchar) to nahi?'*" → haan = smaller redirect + reserve.
- **Short-month handler (Q12):** flow = reason poocho (medical/festival/collection-late/income-drop) → **unavoidables protect karo** (fixed EMIs jo ruk hi nahi sakte, card minimums) → flexible + non-performing ko defer → defer-list with recovery plan next month.
- **Instant allocation (Q7):** paisa enter karte hi 2–3 options: "Best interest save" / "Safest (due protect)" / "Fastest one-loan-gone" — user tap, done.
- **What-if math everywhere:** "₹4,000 extra = ₹800 byaj bacha" style live copy on every notification & card.
- **Emergency fund (Q22):** target = ~1 mahine ka essential kharcha (min ₹10k default). Monthly suggest: "₹1,000 alag rakho, loan 2 hafte late se kuch nahi hota, par bina fund ke beemar me naya loan lagega." Fund-first rule short-month handler me built-in.
- **Insurance education (Q19–21):** "Nahi hai" → one card: *"Aapke 5 loans, ₹X mahikana EMI. Hospital ka ₹2 lakh aaya to ya to naya loan ya EMI skip — dono me se ek chuno. ₹500/mahine wala parivaar plan ye risk hata deta hai."* + free government scheme info (Ayushman Bharat PM-JAY etc.) + "apne area me agent se baat karo" nudge. **No reminders, no selling, term/life insurance skip.** ✅
- **Grocery-month-start memory (Q24):** naya mahina → "Pichle mahine ki grocery ₹6,200 thi. Ye mahine aadhi cheezein (tel, aata, daal) bachi hain → ₹2,500 budget kaafi. Bacha ₹2,500 = Riya card pe daalo → ₹260 bacha." Data = expenses history + user ka "kya bache hain" 1-tap answer.

### 5.4 AI execution: hybrid
- **On-device rules engine** = offline-critical stuff (priority, due protection, redirect math, what-if) → 100% offline, private, instant.
- **Cloud LLM (user text only, Hinglish output)** = reason conversations, motivation lines, side-income ideas, plan explanations. All numbers come from rules engine → LLM sirf *samjhaata* hai, calculate nahi (hallucination-safe).

---

## 6. Income (Q6–Q9)
- Sources: **Salary (fixed day) | Commission (deal/laptop) | Bonus | Kheti/Fasal | Business (roz alag) | Rent | Freelance | Custom field**. Same person 3 jagah se salary → 3 source entries.
- **Family members** add kar sakte ho income (wife/son) → har entry tagged *"Sunita ka commission"* + **lag flag** (dependent/irregular) → dashboard pe "Parivaar income: ₹18,500 (lag: ₹4k)" dikhता ki kiski kitni hai.
- Manual entry only (no SMS/UPI auto-read ✅ privacy). Har income event → allocation sheet (5.3).

## 7. Expenses (Q14–Q18)
- Category-wise + custom; fixed/variable tags (light_bill = variable per user).
- Pay-method split views: UPI / Cash / Card / Bank transfer.
- **Budgets with loan-linked warnings:** 80% = "aadha ho gaya"; 100% = **"₹15k cross = ya to EMI miss ya naya udhaar — dono me ₹X ka nuksaan. Rokne ka last point: ₹Y."**
- **Spending coach:** "Bahar khana ₹8,000/mahina → ₹4,000 karo = ek loan 2 mahine jaldi" (auto-computed from real numbers, monthly digest me).
- **Receipt OCR:** camera → ML Kit text → amount/date/store detect → 2-tap confirm → expense add. Fully on-device, free.

## 8. Side-income AI (Q25–28)
- Onboarding: job/business/freelance? + skills (driving, dukaan, mobile repair, kheti, cooking, computer, tailoring, electrician, plumbing, beauty, tuition, video editing, content writing, two-wheeler + **custom**).
- **Daily 1 idea** (evening 7pm): *"Aapke paas bike + 2 ghante → shaam ko Rapido/Porter 4 din = ₹2,400/mahina = Anil ka poora sekda byaj."* (har idea ko ek loan ke number se joda hua).
- Skill se free YouTube/course suggest (searched & curated links, hok ka suggestion). No paid courses.
- Idea language = user-selected (Hindi/English/Hinglish).

## 9. Notifications (Q13, Q31–32)
1. Subah 8: **Aaj ka plan** (aaj kaunsi EMI, aaj ka kharcha budget, aaj ka idea)
2. EMI −3d: "Paise ready rakho — [loan], ₹X"
3. **Income event → instant:** "₹10,000 aaye ✓. ₹4,000 sekda wale me daalo → ₹800 byaj bacha. [Daalo?]"
4. Budget 80% / 100% (with loan-risk line)
5. Loan closed → celebration + redirect offer (after expense question)
6. Monthly digest: kitna byaj bachaya, "you're N mahine ahead"
All local-scheduled + user can quiet-hours; no server push needed (offline-safe).

## 10. Design (Q30, 31, 34, 35)
- **Dashboard-first** with today's plan + big debt-progress ring ("70% khatam • ~3 mahine bache").
- Per-loan progress bars + balance-over-time line chart (free `victory-native`/`react-native-svg`).
- Dark + Light mode, system-follow toggle.
- Big fonts, Hinglish-first microcopy, ₹ amounts bold. Voice-input for "paisa aaya/kharcha" (free OS keyboard mic) — target user ke liye huge.
- Globalization: per-country language + currency + date format sets (IN: ₹, en-IN/hi-IN/Hinglish; AE: AED/dd-MM; etc. via Intl).

## 11. Tech stack (both platforms, free-first)
- **React Native + Expo (TypeScript)** → iOS + Android ek codebase.
- **Offline DB:** expo-sqlite (or WatermelonDB) = single source of truth, app kabhi bhi chalega.
- **Sync:** Supabase (free tier: auth [Email/Google/Apple OAuth] + Postgres + storage for receipts/backup). Last-write-wins + conflict banner. Google Drive backup = file export (JSON) via Expo FileSystem + Drive intent (v1.1) — **encrypted export** (user passphrase) for privacy.
- **OCR:** Google ML Kit Text Recognition v2 (free, on-device).
- **Notifications:** expo-notifications (local) + FCM/APNs free for future server push.
- **Charts:** react-native-svg + victory-native (free). **i18n:** i18next + Intl currency/date.
- **State/data:** Zustand + TanStack Query. **Monetization:** RevenueCat free tier (≤$2.5k/mo) ya direct IAP.
- Hosting-free admin: later Supabase edge functions for plan PDF export.

## 12. Freemium (Q40–41)
- **Free:** unlimited loans/income/expenses, priority list, basic reminders, 1 AI idea/day, 2 budgets, family view 1 member. (Core kabhi paywall nahi — trust chahiye.)
- **Premium (~₹99/mo / ₹499/yr, regional pricing):** 12-month plan + simulators, instant AI cash-coach (unlimited), receipt OCR unlimited (free me 5/mo), expense auto-coach, grocery-memory AI, cloud backup + family sharing, all themes/insights.
- **No ads. Ever.** (Q41) Data never sold; on-device-first privacy is a marketing line.

## 13. Compliance guardrails
- Not a lender/RBI-regulated entity → clear disclaimer. No loan selling, no credit-score access claims. Insurance/bank-transfer = education only, no commissions unless registered later. Financial figures labeled "estimated, verify with lender."

## 14. Build phases
| Phase | Scope | Time (solo + AI-assisted) |
|-------|-------|---------------------------|
| **M1 MVP** | Auth+i18n+theming, Loan CRUD (all modes+card), manual payments, Income CRUD+family tags, simple expenses+budgets, offline DB, progress dashboard | ~6 wks |
| **M2 Brain** | Priority engine + reasons, allocation sheet, loan-closed redirect, short-month flow, reminders, emergency fund, insurance card | ~4 wks |
| **M3 AI polish** | 12-mo plan + charts, LLM coach (Hinglish), receipt OCR, expense→loan coach, grocery memory, daily skill ideas | ~5 wks |
| **M4 Launch** | Family sharing, Drive backup, paywall (RevenueCat), Play Store + TestFlight, ASO | ~3 wks |
| **M5** | More countries/currencies, voice input, widget "aaj ka plan", WhatsApp-share plan card | ongoing |

## 15. Success metrics
- 7-day retention (core: paisa-aaya notification tap-rate), loans closed/user, avg interest saved reported, premium conversion from "12-month plan" viewers, family invites/user.

---

## Open questions (sirf 4, plan ko block nahi karte)
1. Q7 interpretation confirm: 2–3 tap options + auto-apply best? (recommended: yes)
2. App ka final naam + brand feel: "desi diary" style (warm, paper texture) ya "clean fintech" (minimal)?
3. Emergency fund default target: "1 mahine ka essential kharcha" theek hai ya fixed % rule chahiye?
4. Beta: pehle 20–30 real borrowers (sekda-wale) pe test karein before Play Store open testing?
