# Cast Iron Charlie — Cost Review YTD 2026
**Date:** 2026-05-20 | **Version:** 2.0.0 | **Period:** Jan 1 – May 20, 2026  
**Source:** Gmail receipts (3-query sweep) + Mercury account activity  
**Prepared by:** Claude (Cowork) for Cast Iron Productions LLC  
**Supersedes:** CIC_Cost_Review_2026-05-20_v1.0.0.md

> **v2.0.0 changes from v1.0.0:** Added $164.00 Northwest Registered Agent LLC formation fee (invoice #3ZD45W4G, 2026-03-23) — previously omitted. Added Google Cloud billing suspension flag and Mailchimp trial verification flag. Total confirmed direct CIC expenses revised from $20.18 → **$184.18**.

---

## Summary

| Category | Confirmed ($) | Estimated / Unverified ($) | Status |
|---|---|---|---|
| Legal & Professional — Filing / Formation | $164.00 | — | ✅ Confirmed |
| Technology — Domains & Hosting | $10.18 | — | ✅ Confirmed |
| Technology — AI / API Costs (direct CIC) | $10.00 | — | ✅ Confirmed |
| Technology — AI / API Costs (shared CIC + RL) | — | ~$50.00 | ⚠️ Verify amounts |
| Technology — Cloud (GCP) | — | VERIFY | ⚠️ Billing past due |
| Marketing — Email (Mailchimp) | — | $0 or $20/mo | ⚠️ Trial status unknown |
| Owner Contribution (equity in, non-expense) | $100.00 | — | ✅ Confirmed |
| **Total Confirmed Direct CIC Expenses** | **$184.18** | — | — |
| **Total w/ Shared Anthropic (estimated)** | — | **~$234.18** | — |

---

## Detailed Transactions

### ✅ Confirmed Expenses

| Date | Vendor | Product / Service | Invoice / Receipt | Amount | Payment Method | FinanceOS Status |
|---|---|---|---|---|---|---|
| 2026-03-19 | Namecheap | `castironcharlie.com` 1yr domain (+ ICANN $0.20) | Order #197514019 | **$10.18** | PayPal | ❌ Not in Mercury ledger |
| 2026-03-23 | Northwest Registered Agent LLC | Florida LLC formation + registered agent service, renewal filings, website hosting, business domain, phone, email (Bundle) | Invoice #3ZD45W4G | **$164.00** | Card (unknown) | ❌ Not in Mercury ledger — **NEW v2** |
| 2026-05-17 | Anthropic, PBC | API usage — confirmed auto-reload | Receipt #2478-2293-9203 | **$10.00** | Card on file | ❌ Not in Mercury ledger |

**Confirmed direct CIC total: $184.18**

> **Northwest Registered Agent note:** The $164.00 invoice bundles multiple services — formation filing, registered agent (ongoing annual fee), website hosting RA, business domain RA, phone service, and email service. The base coupon ($39 off) and bundle adjustment are reflected in the $164.00 total. Confirm whether the registered agent annual renewal is separately invoiced going forward.

---

### ⚠️ Shared / Likely CIC — Amounts Require Verification

> These Anthropic API receipts hit the same personal account used for CIC pipeline AND Rewrite Labs. All are presumed $10.00 auto-reload charges. Confirm at console.anthropic.com → Billing → Invoices.

| Date | Vendor | Receipt # | Est. Amount | FinanceOS Status |
|---|---|---|---|---|
| 2026-04-22 | Anthropic, PBC | #2232-5682-7684 | ~$10.00 | ❌ Not in Mercury ledger |
| 2026-04-22 | Anthropic, PBC | #2751-2990-5073 | ~$10.00 | ❌ Not in Mercury ledger |
| 2026-05-16 | Anthropic, PBC | #2837-3085-8525 | ~$10.00 | ❌ Not in Mercury ledger |
| 2026-05-16 | Anthropic, PBC | #2508-9614-3025 | ~$10.00 | ❌ Not in Mercury ledger |
| 2026-05-17 | Anthropic, PBC | #2480-0985-2063 | ~$10.00 | ❌ Not in Mercury ledger |

**Estimated Anthropic YTD total (all 6 receipts): ~$60.00**

---

### ⚠️ Requires Verification — New Findings

#### Google Cloud Platform — Billing Suspension Warning
- **Date:** 2026-04-22
- **GCP Project:** `cast-iron-productions-llc` (billing account: `018232-0A3ECB-F9128F`)
- **Alert:** Billing account past due / no valid payment method on file
- **Action:** Log into [console.cloud.google.com/billing/018232-0A3ECB-F9128F/manage](https://console.cloud.google.com/billing/018232-0A3ECB-F9128F/manage?project=cast-iron-productions-llc) to:
  1. Confirm what services are running (Maps API? Firebase? Cloud Run?)
  2. Determine if any charges have accrued or if this is a $0 free-tier account
  3. Add a payment method if the project is still active
- **FinanceOS Status:** Cannot enter — amount unknown. Add as action item.

#### Mailchimp — Standard Plan Trial (sent to info@castironcharlie.com)
- **Date:** 2026-04-08 (trial end: 2026-04-10)
- **Plan:** Standard, 500 contacts — $20.00/month if converted
- **Status:** Trial as of Apr 8; no subsequent receipt or charge confirmation found in Gmail
- **Likely outcome:** Either downgraded to free plan OR charges going to the castironcharlie.com email inbox (not sorensencc@gmail.com)
- **Action:** Log into mailchimp.com → Account & Billing to check current plan status
- **FinanceOS Status:** Pending verification. If active at $20/mo since Apr 11, that's $60.00 not captured.

---

### 💰 Owner Activity (Non-Expense)

| Date | Type | Amount | From | To | FinanceOS Status |
|---|---|---|---|---|---|
| 2026-05-13 | Owner Contribution | $100.00 | Citizens Bank ••9032 | Cast Iron Productions LLC Mercury ••2444 | ⚠️ Verify Mercury ingest captured this |

---

## Items Found That Are NOT CIC

- **2026-05-10 — Spaceship — `rewritelabs.io` domain — $14.98** → Rewrite Labs expense only.
- **2026-04-01 — LegalZoom — "Take a moment to upgrade your will"** → Personal estate planning, not CIC.
- **Multiple Adobe emails (Jan–May)** → Marketing/promotional emails only; no active CIC Adobe subscription receipt found.
- **Dropbox sign-in notification (2026-03-23)** → Security alert, not a charge.
- **X (Twitter) — @castironcharlie handle offer (2026-04-09)** → Offer email only; no purchase confirmed. (Handle claim at no extra cost with Premium Business subscription — verify if subscribed.)

---

## FinanceOS Manual Entries

> All entries below belong on the **Transactions** sheet of `cast-iron-llc-ledger-2026.xlsx`.  
> TxnIDs CIC-MANUAL-001 through CIC-MANUAL-007 are unchanged from v1.0.0. New entry starts at 008.

```
TxnID          | Date       | Description                                         | Merchant                     | Amount  | Direction | Category              | Subcategory       | Project | Tags
CIC-MANUAL-001 | 2026-03-19 | castironcharlie.com 1yr domain (Order#197514019)    | Namecheap                    | -10.18  | OUT       | Technology            | Domains & Hosting | CIC     | domain,web,preprod
CIC-MANUAL-002 | 2026-04-22 | API usage #2232-5682-7684                           | Anthropic, PBC               | -10.00  | OUT       | Technology            | AI / API Costs    | CIC     | api,pipeline,shared
CIC-MANUAL-003 | 2026-04-22 | API usage #2751-2990-5073                           | Anthropic, PBC               | -10.00  | OUT       | Technology            | AI / API Costs    | CIC     | api,pipeline,shared
CIC-MANUAL-004 | 2026-05-16 | API usage #2837-3085-8525                           | Anthropic, PBC               | -10.00  | OUT       | Technology            | AI / API Costs    | CIC     | api,pipeline,shared
CIC-MANUAL-005 | 2026-05-16 | API usage #2508-9614-3025                           | Anthropic, PBC               | -10.00  | OUT       | Technology            | AI / API Costs    | CIC     | api,pipeline,shared
CIC-MANUAL-006 | 2026-05-17 | API usage #2480-0985-2063                           | Anthropic, PBC               | -10.00  | OUT       | Technology            | AI / API Costs    | CIC     | api,pipeline,shared
CIC-MANUAL-007 | 2026-05-17 | API usage #2478-2293-9203                           | Anthropic, PBC               | -10.00  | OUT       | Technology            | AI / API Costs    | CIC     | api,pipeline,shared
CIC-MANUAL-008 | 2026-03-23 | FL LLC formation + reg agent bundle (Inv#3ZD45W4G)  | Northwest Registered Agent   | -164.00 | OUT       | Legal & Professional  | Filing Fees       | CIC     | formation,legal,llc,preprod
```

**Also check Mercury ingest for the $100 owner contribution** (2026-05-13). It should appear as:
- Category: `Transfer / Owner Contribution`, Direction: IN, Amount: +100.00

---

## Action Items

1. **[CRITICAL — v2 NEW] Enter CIC-MANUAL-008** — $164.00 Northwest Registered Agent LLC formation fee into `cast-iron-llc-ledger-2026.xlsx`. This was missing from v1.0.0 and is the largest single CIC expense to date.
2. **[CRITICAL] Verify Google Cloud billing** — Log into [console.cloud.google.com](https://console.cloud.google.com/billing/018232-0A3ECB-F9128F/manage?project=cast-iron-productions-llc). Determine what's running, whether charges have accrued, and add a payment method if the project is active. If the project is unused, delete it to avoid future charges.
3. **[HIGH] Verify Mailchimp status** — Log into mailchimp.com with info@castironcharlie.com. If on a paid plan ($20/mo), add to ledger as CIC-MANUAL-009 through present. If downgraded to free, no action needed.
4. **[HIGH] Verify Anthropic amounts** — Confirm each of the 6 receipts is $10.00 at [console.anthropic.com](https://console.anthropic.com) → Billing → Invoices.
5. **[MEDIUM] Decide Anthropic cost allocation** — Split CIC vs Rewrite Labs (suggested: 60/40, or set up project-specific API keys going forward).
6. **[MEDIUM] Run Mercury ingest** — Capture the $100 owner contribution: `cd C:\Users\soren\OneDrive\FinanceOS\pipeline\ledger-ingest && python3 ingest_mercury_api.py`
7. **[MEDIUM] Enter CIC-MANUAL-001 through CIC-MANUAL-007** from v1.0.0 if not yet done.
8. **[LOW] Confirm Northwest Registered Agent renewal schedule** — The RA service is annual. Note the renewal date and amount to budget for it.

---

## Notes

- `castironcharlie.com` renews **2027-03-19**. Set a calendar reminder.
- Northwest Registered Agent renewal (registered agent service) — confirm annual date and cost.
- Slack (Cast Iron Productions LLC workspace) — free tier, $0.
- LinkedIn Company Page — free.
- Mercury checking ••2444 — no monthly fee.
- Mercury IO credit card — no annual fee.
- Instagram @castironcharlie — restored 2026-04-30, free.
- GCP project `cast-iron-productions-llc` billing account **018232-0A3ECB-F9128F** — billing lapsed as of 2026-04-22. Status unknown.
- Mailchimp trial (info@castironcharlie.com) — ended Apr 10. Status: unknown.

---

*Next review: run `/cic-cost-review` to regenerate this report with updated Gmail data.*
