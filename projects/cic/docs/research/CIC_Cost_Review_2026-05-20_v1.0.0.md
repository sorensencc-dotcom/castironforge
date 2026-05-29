# Cast Iron Charlie — Cost Review YTD 2026
**Date:** 2026-05-20 | **Version:** 1.0.0 | **Period:** Jan 1 – May 20, 2026  
**Source:** Gmail receipts + Mercury account activity  
**Prepared by:** Claude (Cowork) for Cast Iron Productions LLC

---

## Summary

| Category | Confirmed ($) | Estimated ($) | Status |
|---|---|---|---|
| Domain / Web | $10.18 | — | ✅ Confirmed |
| Anthropic API (shared CIC + RL) | $10.00 | ~$50.00 additional | ⚠️ Partial |
| Owner Contribution (equity in) | $100.00 | — | ✅ Confirmed |
| **Total CIC Expenses** | **$20.18** | **~$70.18** | — |

> **Note:** Anthropic API costs are billed to a shared account used by both the CIC ingestion pipeline and Rewrite Labs. Allocation between projects requires manual review at [console.anthropic.com](https://console.anthropic.com).

---

## Detailed Transactions

### ✅ Confirmed Expenses

| Date | Vendor | Product / Service | Amount | Payment Method | FinanceOS Status |
|---|---|---|---|---|---|
| 2026-03-19 | Namecheap | `castironcharlie.com` domain — 1 yr registration (+ ICANN $0.20) | **$10.18** | PayPal | ❌ Not in Mercury ledger |
| 2026-05-17 | Anthropic, PBC | API usage — receipt #2478-2293-9203 | **$10.00** | Card on file | ❌ Not in Mercury ledger |

### ⚠️ Likely CIC / Shared (Amounts Estimated at $10 Auto-Reload)

> These Anthropic receipts hit the same personal API account used for CIC pipeline development. All are $10 auto-reload charges. Confirm exact amounts at console.anthropic.com → Billing → Invoices.

| Date | Vendor | Receipt # | Est. Amount | FinanceOS Status |
|---|---|---|---|---|
| 2026-04-22 | Anthropic, PBC | #2232-5682-7684 | ~$10.00 | ❌ Not in Mercury ledger |
| 2026-04-22 | Anthropic, PBC | #2751-2990-5073 | ~$10.00 | ❌ Not in Mercury ledger |
| 2026-05-16 | Anthropic, PBC | #2837-3085-8525 | ~$10.00 | ❌ Not in Mercury ledger |
| 2026-05-16 | Anthropic, PBC | #2508-9614-3025 | ~$10.00 | ❌ Not in Mercury ledger |
| 2026-05-17 | Anthropic, PBC | #2480-0985-2063 | ~$10.00 | ❌ Not in Mercury ledger |

**Estimated Anthropic YTD total (all receipts): ~$60.00**

### 💰 Owner Activity (Non-Expense)

| Date | Type | Amount | From | To | FinanceOS Status |
|---|---|---|---|---|---|
| 2026-05-13 | Owner Contribution | $100.00 | Citizens Bank ••9032 | Cast Iron Productions LLC Mercury ••2444 | ⚠️ Check ingest |

---

## Items Found That Are NOT CIC

- **2026-05-10 — Spaceship — rewritelabs.io domain — $14.98** → Rewrite Labs expense, not CIC.

---

## FinanceOS Update Required

The Cast Iron Productions LLC Mercury account was opened **2026-05-13**. Most CIC costs to date were paid via personal PayPal or the personal Anthropic account — they will **not appear** in the Mercury-based ledger automatically. The following entries need to be manually added to `Business/cast-iron-llc-ledger-2026.xlsx` (Transactions sheet):

```
TxnID               | Date       | Description                     | Merchant    | Amount   | Direction | Category              | Subcategory       | Project | Tags
CIC-MANUAL-001      | 2026-03-19 | castironcharlie.com 1yr domain  | Namecheap   | -10.18   | OUT       | Technology            | Domains & Hosting | CIC     | domain,web,preprod
CIC-MANUAL-002      | 2026-04-22 | API usage #2232-5682-7684       | Anthropic   | -10.00   | OUT       | Technology            | AI / API Costs    | CIC     | api,pipeline,shared
CIC-MANUAL-003      | 2026-04-22 | API usage #2751-2990-5073       | Anthropic   | -10.00   | OUT       | Technology            | AI / API Costs    | CIC     | api,pipeline,shared
CIC-MANUAL-004      | 2026-05-16 | API usage #2837-3085-8525       | Anthropic   | -10.00   | OUT       | Technology            | AI / API Costs    | CIC     | api,pipeline,shared
CIC-MANUAL-005      | 2026-05-16 | API usage #2508-9614-3025       | Anthropic   | -10.00   | OUT       | Technology            | AI / API Costs    | CIC     | api,pipeline,shared
CIC-MANUAL-006      | 2026-05-17 | API usage #2480-0985-2063       | Anthropic   | -10.00   | OUT       | Technology            | AI / API Costs    | CIC     | api,pipeline,shared
CIC-MANUAL-007      | 2026-05-17 | API usage #2478-2293-9203       | Anthropic   | -10.00   | OUT       | Technology            | AI / API Costs    | CIC     | api,pipeline,shared
```

**Also check Mercury ingest for the $100 owner contribution** (2026-05-13). If the ingest has run since account opening, it should appear as:
- Category: `Transfer / Owner Contribution`, Direction: IN, Amount: +100.00

---

## Action Items

1. **Verify Anthropic amounts** — log into [console.anthropic.com](https://console.anthropic.com) → Billing → Invoices to confirm each receipt total (expected: $10.00 each).
2. **Decide Anthropic allocation** — how much of the API cost is CIC vs Rewrite Labs? (Suggested: 60% CIC / 40% RL, or track separately once you split API keys by project.)
3. **Run Mercury ingest** to capture the $100 owner contribution if not yet done: `cd C:\Users\soren\OneDrive\FinanceOS\pipeline\ledger-ingest && python3 ingest_mercury_api.py`
4. **Manual ledger entries** — add the 7 rows above to `cast-iron-llc-ledger-2026.xlsx` Transactions sheet.
5. **Consider setting up a CIC-specific Anthropic API key** going forward, so costs can be tracked per project automatically.

---

## Notes

- `castironcharlie.com` renews 2027-03-19. Set a reminder.
- Slack (Cast Iron Productions LLC workspace, opened May 2026) — currently on free tier, $0.
- LinkedIn Company Page (Cast Iron Productions LLC) — free.
- Mercury IO card (Cast Iron Productions LLC) — no annual fee.
- Mercury checking account — no monthly fee.
- Instagram @castironcharlie restored 2026-04-30 — no cost.

---

*Next review: run `/cic-cost-review` to regenerate this report with updated Gmail data.*
