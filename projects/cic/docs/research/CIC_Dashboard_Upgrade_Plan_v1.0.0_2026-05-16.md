# Cast Iron Charlie — Executive Dashboard
## Architecture Review & Upgrade Plan
### v1.0.0 · 2026-05-16 · Cast Iron Productions

---

## STATUS: Bugs Fixed (this session)

The following blocking bugs were patched before writing this plan.

| # | File | Bug | Fix Applied |
|---|------|-----|-------------|
| 1 | `views/today.py` | `strftime('%-I%p')` — GNU/Linux-only, crashes on Windows | `%I%p` + `.lstrip('0')` |
| 2 | `views/weather_view.py` | Same `%-I` crash on Windows | Same fix |
| 3 | `services/google_auth.py` | `token.json` / `credentials.json` resolved from shell CWD, not project root | `pathlib.Path(__file__).parent.parent` anchoring |
| 4 | `services/rules.py` | `triage_rules.json` CWD-relative | Same anchoring fix |
| 5 | `services/usage.py` | `claude_usage.db` CWD-relative | Same anchoring fix |
| 6 | (new) `requirements.txt` | Missing — reproducibility broken | Generated from venv dist-info |

**The app should now boot. Run:**
```
cd C:\Users\soren\projects\executive-dashboard
.venv\Scripts\streamlit run app.py
```
OAuth will open a browser window on first run. `token.json` will be written to the project root.

---

## OBSERVED ISSUES (not yet fixed — roadmap below)

### Performance
- **No caching** — `fetch_messages()` fires 80 Gmail API calls on every Streamlit rerun (every button click). On the Triage tab with a full inbox, clicking "File" re-fetches all 80 messages before re-rendering. Latency: 4–12 seconds.
- **`st.cache_data.clear()`** is called everywhere but none of the data functions use `@st.cache_data`, so it's a no-op. Replacing with session-state TTL caching is the fix.

### Auth
- **`flow.run_local_server(port=0)`** opens a local browser window. In WSL2 → Windows this can fail silently or produce a redirect to `localhost` that Windows Chrome rejects. Workaround: set a fixed port and open manually if needed.
- **Expired token refresh** swallows the exception silently. After the fix, the error is at least printed; a Streamlit `st.warning` surface would be better.

### Code Quality
- **Timezone correctness** — `calendar.py` strips `tzinfo` after parsing, then compares with naive `datetime.now()`. Works in practice but will produce wrong sort order for events from non-local timezones (e.g., a calendar shared with someone in EST while you're in CST).
- **`usage.py` SQLite connections** — opened via `_conn()` and used as context manager, which handles commit/rollback but does NOT close the connection. Under high-frequency reloads this leaks file handles.
- **Google API calls not batched** — `fetch_messages()` sends one `.get()` per message. Gmail batch API (`users().messages().batchGet()`) would reduce this to 1–2 HTTP round trips for 80 messages.
- **No `.streamlit/config.toml`** — Missing theme config means Streamlit applies its default light theme base before your CSS override, causing a flash of unstyled content on load.
- **`services/__init__.py`** is empty — fine, but explicit `__all__` in service modules would prevent accidental wildcard imports.

### UX
- The Triage tab collapse/expand toggle state is stored in `session_state['triage_collapsed']` but reset on `st.rerun()` depending on the order of state reads — minor but noticeable.
- Weather hourly strip has no scroll indicator on narrow viewports.
- No loading skeleton for Today tab — raw `st.spinner` blocks the entire page during auth + data fetch on cold load.

---

## UPGRADE ROADMAP

---

### Phase 0 — Stability (This Week)

> Goal: eliminate remaining silent failure modes.

**0.1 — Add `.streamlit/config.toml`**

Create `C:\Users\soren\projects\executive-dashboard\.streamlit\config.toml`:
```toml
[theme]
base = "dark"
backgroundColor = "#0a0806"
secondaryBackgroundColor = "#1a1410"
textColor = "#e8e0d4"
font = "serif"

[server]
headless = true
port = 8501

[runner]
fastReruns = true
```
This eliminates the flash of unstyled content and enables fast reruns (prevents full re-render on minor state changes).

**0.2 — Session-state cache for Gmail/Calendar with TTL**

In `services/gmail.py`, wrap `fetch_messages()` to use Streamlit session state:
```python
# In triage.py render():
cache_key = '_email_cache'
cache_ts_key = '_email_cache_ts'
TTL = 120  # seconds

now = time.time()
if (
    cache_key not in st.session_state
    or now - st.session_state.get(cache_ts_key, 0) > TTL
):
    st.session_state[cache_key] = gmail_svc.fetch_messages(gmail, query='is:unread', max_results=80)
    st.session_state[cache_ts_key] = now

emails = st.session_state[cache_key]
```
After any mutating action (File, Trash, Snooze), invalidate by deleting `st.session_state[cache_key]`.

**0.3 — Fix SQLite connection leak in `usage.py`**

Change `_conn()` to yield a properly closed connection:
```python
from contextlib import contextmanager

@contextmanager
def _conn():
    c = sqlite3.connect(DB_PATH)
    c.execute('''CREATE TABLE IF NOT EXISTS calls(...)''')
    try:
        yield c
        c.commit()
    except Exception:
        c.rollback()
        raise
    finally:
        c.close()
```

---

### Phase 1 — UX Elevation (Next Sprint)

> Goal: make the dashboard feel premium and fast.

**1.1 — Loading skeletons**

Replace the blocking `st.spinner('Connecting to Google services…')` at startup with a non-blocking auth check pattern. Cache the `(gmail, calendar)` pair in `st.session_state` on first successful auth and don't re-auth on every page load.

**1.2 — Gmail batch fetch**

Replace the N-call loop in `fetch_messages()` with Gmail batch API:
```python
# Instead of:
for m in messages:
    msg = gmail.users().messages().get(...).execute()

# Use:
batch = gmail.new_batch_http_request()
results = {}
def callback(request_id, response, exception):
    if not exception:
        results[request_id] = response

for m in messages:
    batch.add(
        gmail.users().messages().get(userId='me', id=m['id'], format='metadata', ...),
        callback=callback,
        request_id=m['id']
    )
batch.execute()
```
Expected speedup: 80 API calls → 1–2 HTTP round trips. Triage load time: 4–12s → ~0.8s.

**1.3 — Timezone-aware calendar**

Replace the `tzinfo` strip with proper local-time conversion:
```python
import zoneinfo
LOCAL_TZ = zoneinfo.ZoneInfo('America/New_York')  # Tampa

def _parse_start(event):
    val = event.get('start', {}).get('dateTime') or event.get('start', {}).get('date')
    if not val:
        return None
    if 'T' not in val:
        return datetime.datetime.fromisoformat(val).replace(tzinfo=LOCAL_TZ)
    dt = datetime.datetime.fromisoformat(val.replace('Z', '+00:00'))
    return dt.astimezone(LOCAL_TZ)
```
Then compare with `datetime.datetime.now(LOCAL_TZ)`.

**1.4 — Persistent sidebar summary**

Add a fixed sidebar (currently collapsed and unused) with:
- Unread count badge
- Next event countdown (live clock via `st.empty()` + `time.sleep(30)`)
- Current temp
- Claude budget bar

This gives at-a-glance status without navigating to Today tab.

**1.5 — Keyboard shortcuts**

Streamlit supports `st.components.v1.html()` for JS injection. Wire:
- `R` → Refresh triage
- `A` → Auto-file
- `T` → Switch to Today tab
- `Escape` → Collapse all expanders

---

### Phase 2 — LLC Finance Integration (Roadmap)

> Goal: surface Cast Iron Productions LLC financial health alongside operational data.

**Architecture Decision: Read-only aggregation layer, not a general-purpose accounting tool.**

The dashboard should show *executive signals*, not replace QuickBooks/Xero. The integration model:

```
LLC Financial Data Sources
  ├── QuickBooks Online (preferred) → API via intuit-oauth2-client
  ├── Stripe (if used for invoicing) → stripe-python SDK
  ├── CSV export (fallback) → pandas parse on upload
  └── Manual entry (MVP) → session_state form
               ↓
services/finance.py
  ├── fetch_pl_summary(period) → {revenue, expenses, net}
  ├── fetch_ar_aging() → list of open invoices
  ├── fetch_cashflow(weeks=4) → weekly cash position
  └── fetch_ytd_summary() → YTD vs prior year
               ↓
views/finance_view.py (new tab)
```

**Phase 2.1 — MVP: Manual + CSV**
- New `Finance` tab (add to `app.py` tabs)
- 4 stat blocks: Revenue MTD, Expenses MTD, Net MTD, Cash on Hand
- Upload CSV → parse with pandas → persist to SQLite (new table `finance_entries`)
- Schema: `date, category, amount, memo, source`

**Phase 2.2 — QuickBooks Online Integration**
- Register app in Intuit Developer portal → get `client_id`, `client_secret`
- Store tokens in `qb_token.json` (same pattern as `token.json`)
- Service: `services/quickbooks.py`
  - `get_profit_loss(from_date, to_date)` → P&L report
  - `get_invoice_list()` → open AR
  - `get_account_balance(account_name)` → checking balance
- Display: Finance tab → 3 sub-tabs: Summary, AR Aging, Cash Flow

**Phase 2.3 — Today Tab Finance Strip**
- Add 5th hero stat block: **Net MTD** (green if positive, ember if negative)
- Add to `cic-hour-strip` equivalent for weekly cash flow: 4-week bar chart using pure CSS `::before` pseudo-elements (no charting library, keeps the design system clean)

**Phase 2.4 — Budget vs Actual Alerts**
- Store annual budget by category in `triage_rules.json` → add `finance.budgets` key
- Alert logic: if any category > 80% of monthly budget by mid-month → surface in Today tab conflicts section
- Same `cic-tag cic-tag-conflict` visual treatment

**Finance tab wireframe:**
```
Finance · Cast Iron Productions LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Revenue MTD]  [Expenses MTD]  [Net MTD]  [Cash on Hand]
   $12,400         $4,200       $8,200       $31,000

P&L · May 2026                   [Last 6 months ▾]
──────────────────────────────────────────────────
  Consulting Revenue    $12,400    ████████████ 100%
  Project Expenses       $2,100    ███ 17%
  Software & Tools         $900    █ 7%
  Other                  $1,200    ██ 10%

Open Invoices                                [Send Reminder]
──────────────────────────────────────────
  Client A · INV-0042 · Due May 20 · $3,500   ● 8 days
  Client B · INV-0038 · Due May 31 · $2,100   ○ 19 days
```

---

## FILE INVENTORY (post-fix state)

```
executive-dashboard/
├── app.py                        # entry · tabs · header · footer
├── styles.py                     # full CSS design system
├── requirements.txt              # ← NEW
├── .streamlit/
│   └── config.toml              # ← RECOMMENDED (Phase 0)
├── services/
│   ├── __init__.py
│   ├── google_auth.py           # ← FIXED (absolute paths + error msgs)
│   ├── gmail.py                 # Gmail API operations
│   ├── calendar.py              # Calendar fetch + conflict detection
│   ├── weather.py               # Open-Meteo free API
│   ├── rules.py                 # ← FIXED (absolute path)
│   ├── classifier.py            # Rules-first → LLM → keyword gate
│   └── usage.py                 # ← FIXED (absolute path)
├── views/
│   ├── __init__.py
│   ├── today.py                 # ← FIXED (%-I Windows crash)
│   ├── triage.py                # Inbox triage queue
│   ├── calendar_view.py         # 7-day calendar
│   ├── weather_view.py          # ← FIXED (%-I Windows crash)
│   └── settings.py              # Labels, rules, usage detail
└── [runtime data — git-ignored]
    ├── token.json               # OAuth token (auto-created)
    ├── triage_rules.json        # Learned sender rules
    └── claude_usage.db          # API usage SQLite
```

**Add to `.gitignore`:**
```
token.json
triage_rules.json
claude_usage.db
credentials.json
.venv/
__pycache__/
*.pyc
```

---

## DESIGN SYSTEM NOTES

The CSS design language is solid and should be preserved:
- Tokens: `--black`, `--forge`, `--iron`, `--ember`, `--brass` — good naming, maintain this.
- Typography: Playfair Display / Libre Baskerville / Barlow Condensed — cinematic and appropriate for CIC brand.
- The `.cic-stat-block` / `.cic-hour-strip` / `.cic-row` component system is clean and extensible.

Finance tab should use the same components. No new CSS classes needed except:
- `.cic-bar-chart` — pure CSS horizontal bar for budget breakdown (simple `width: X%` fill)
- `.cic-invoice-row` — extends `.cic-row` with a status dot (`.dot-due`, `.dot-overdue`)

---

*Cast Iron Productions · Tampa, FL · Chris Sorensen*
*Executive Dashboard — Architecture Review · v1.0.0 · 2026-05-16*
