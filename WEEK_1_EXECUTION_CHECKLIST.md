# Week-1 Execution Checklist: Phase-5 Outreach Automation

**Duration:** 5 business days (Monday–Friday)  
**Goal:** Unified Outreach API operational with 3 core endpoints + frontend scaffolding  
**Success Criteria:** E2E test (send → backend → database) passing

---

## PHASE: Project Setup & Database (Mon–Tue Morning)

### Backend Team — Database & Environment

- [ ] **Clone/create chat-agent package**
  - Create `chat-agent/` directory (or extend existing `projects/cic/ingestion`)
  - Initialize with `npm init`
  - Add TypeScript config (`tsconfig.json`)
  - Install dependencies: `express`, `pg`, `dotenv`, `@castironforge/shared-types`

- [ ] **Setup environment**
  - Create `.env.local` from `.env.example`
  - Configure `DATABASE_URL=postgresql://...`
  - Set `ANTHROPIC_API_KEY`, JWT credentials
  - Test database connection: `node -e "require('pg').Pool({connectionString: process.env.DATABASE_URL}).connect().then(() => console.log('OK'))"`

- [ ] **Run database migrations**
  - Connect to database with `psql`
  - Run `001_create_outreach_core_tables.sql`
  - Verify tables created: `\dt outreach_*`
  - Check indexes: `\di outreach_*`
  - Run `002_create_analytics_tables.sql`
  - Run `003_create_maintenance_functions.sql`
  - Test migrations: `SELECT * FROM outreach_leads LIMIT 1;` (should be empty)

- [ ] **Setup Express app skeleton**
  - Create `src/index.ts` with basic Express app
  - Add middleware (parsing, logging, auth)
  - Test: `npm run dev` → listen on port 3001 ✅

### Frontend Team — Project Setup

- [ ] **Create chat-frontend package**
  - `npm create vite@latest chat-frontend -- --template react-ts`
  - Install dependencies: `react-router-dom`, `zustand`, `@castironforge/shared-types`

- [ ] **Project structure**
  - Create folder structure (see FRONTEND_SETUP.md)
  - Create `src/services/api/client.ts` (HTTP client)
  - Create `src/services/automation/engineSelector.ts` (stub)
  - Test: `npm run dev` → runs on http://localhost:5173 ✅

### QA / Ops Team — CI/CD & Monitoring Setup

- [ ] **Setup CI pipeline** (GitHub Actions or similar)
  - Create `.github/workflows/test.yml`
  - Test workflow: TypeScript compile + unit tests
  - Lint workflow: eslint + prettier

- [ ] **Setup monitoring**
  - Ensure logging infrastructure ready
  - Test error tracking integration (if applicable)

---

## PHASE: Backend API — 3 Core Endpoints (Tue Afternoon–Wed)

### Backend Team — Implement Services

- [ ] **Create OutreachService**
  - File: `src/services/outreach.service.ts`
  - Implement `sendMessage(request)` stub
  - Implement `batchSubmit(name, templateId, leads)` stub
  - Implement `getMessageStatus(messageId)` stub
  - Return mocked responses for now

- [ ] **Create TemplateService**
  - File: `src/services/template.service.ts`
  - Implement `getTemplate(id)` → query DB
  - Implement `createTemplate(request)` → insert to DB
  - Implement `listTemplates()` → query DB
  - Test: Manually insert template via psql, query via service

- [ ] **Create LeadService**
  - File: `src/services/lead.service.ts`
  - Implement `getLead(email)`
  - Implement `createLead(data)` → insert to DB
  - Implement `upsertLead(data)` → insert or update

- [ ] **Create Middleware Suite**
  - `src/middleware/auth.middleware.ts` — Accept any Bearer token for now
  - `src/middleware/validation.middleware.ts` — Stub (log requests)
  - `src/middleware/errorHandler.middleware.ts` — Global error handling
  - `src/middleware/rateLimit.middleware.ts` — Stub (pass through)
  - `src/middleware/requestLogger.middleware.ts` — Log all requests

### Backend Team — Implement 3 Core Routes

**Endpoint 1: POST /api/v1/outreach/send**

- [ ] **Create route file: `src/routes/outreach/send.routes.ts`**
  - Define endpoint
  - Accept request body (SendMessageRequest type from shared-types)
  - Call `outreachService.sendMessage()`
  - Return response envelope with success/error
  - Test with curl:
    ```bash
    curl -X POST http://localhost:3001/api/v1/outreach/send \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer test" \
      -d '{
        "lead": {"email": "test@example.com", "name": "Test"},
        "template_id": "tpl_123",
        "engine": "backend-batch"
      }'
    ```

- [ ] **Database interaction:**
  - Insert test template via psql: `INSERT INTO outreach_templates (name, base_content, tone, created_by) VALUES ('Test', 'Hi {{lead.name}}', 'casual', 'test');`
  - Implement `sendMessage()` to:
    1. Validate lead & template exist
    2. Insert into `outreach_messages` table
    3. Return message_id + status
  - Test: Query DB → confirm message in `outreach_messages`

**Endpoint 2: POST /api/v1/outreach/batch**

- [ ] **Create route file: `src/routes/outreach/batch.routes.ts`**
  - Define endpoint
  - Accept `BatchSendRequest` (campaigns + leads array)
  - Call `outreachService.batchSubmit()`
  - Return `BatchSendResponse` with campaign_id + status
  - Test with curl:
    ```bash
    curl -X POST http://localhost:3001/api/v1/outreach/batch \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer test" \
      -d '{
        "campaign_name": "Test Campaign",
        "template_id": "tpl_123",
        "leads": [
          {"email": "alice@example.com", "name": "Alice"},
          {"email": "bob@example.com", "name": "Bob"}
        ]
      }'
    ```

- [ ] **Database interaction:**
  - Implement `batchSubmit()` to:
    1. Create campaign in `outreach_campaigns` table
    2. Insert leads into `outreach_leads` table (upsert on email)
    3. Create messages in `outreach_messages` table (one per lead)
    4. Return campaign_id + message count
  - Test: Query DB → confirm 2 messages in table

**Endpoint 3: GET /api/v1/outreach/{id}/status**

- [ ] **Create route file: `src/routes/outreach/status.routes.ts`**
  - Define endpoint (accept message_id from URL)
  - Call `outreachService.getMessageStatus(id)`
  - Return `MessageStatusResponse` with status + events
  - Test with curl:
    ```bash
    curl -X GET http://localhost:3001/api/v1/outreach/msg_123/status \
      -H "Authorization: Bearer test"
    ```

- [ ] **Database interaction:**
  - Implement `getMessageStatus()` to:
    1. Query `outreach_messages` by id
    2. Query `outreach_delivery_events` for that message
    3. Return status + event list
  - Test: Manually update message status in DB → query via API

### Backend Team — Wiring & Testing

- [ ] **Import routes into main app** (`src/index.ts`)
  - Add: `app.use('/api/v1/outreach', sendRoutes)`
  - Add: `app.use('/api/v1/outreach', batchRoutes)`
  - Add: `app.use('/api/v1/outreach', statusRoutes)`

- [ ] **Test all 3 endpoints manually**
  - POST /send → 201 response with message_id ✅
  - POST /batch → 202 response with campaign_id ✅
  - GET /{id}/status → 200 response with status ✅

- [ ] **Add basic error handling**
  - Missing template → 404 with clear error message
  - Invalid email → 400 with validation error
  - Database error → 500 with generic error (don't expose DB details)

- [ ] **Create unit tests** (Jest)
  - Test `sendMessage()` with valid/invalid inputs
  - Test `batchSubmit()` with valid/invalid inputs
  - Test database queries (mocked)
  - Target: 3-5 tests per service
  - Run: `npm test` → all pass ✅

---

## PHASE: Frontend Integration (Wed Afternoon–Thu)

### Frontend Team — Setup Automation Layer

- [ ] **Create abstraction layer interface** (`src/services/automation/types.ts`)
  - Export `OutreachAutomationEngine` interface (from shared-types)
  - Export `WorkflowResult`, `EngineHealth` types

- [ ] **Create engine selector** (`src/services/automation/engineSelector.ts`)
  - Implement `getAutomationEngine()` → returns engine instance
  - Implement `switchEngine(type)` → swap engines
  - Implement `executeWorkflow(script)` → runs workflow
  - For now: Stub that logs to console

- [ ] **Create React hook wrapper** (`src/services/automation/hooks/usePageAgent.ts`)
  - Hook: `usePageAgent()` → returns engine instance
  - Handle loading, error, success states
  - Initialize engine on component mount

- [ ] **Test automation layer**
  - Create test component that calls `executeWorkflow()`
  - Verify: No errors, functions callable
  - Verify: Can switch engines without crashing

### Frontend Team — Create Send to Client UI

- [ ] **Create hook: `features/outreach/hooks/useSendToClient.ts`**
  - Accept: leadEmail, leadName, message, templateId
  - Call automation engine (Page-Agent stub for now)
  - Call backend API (`POST /api/v1/outreach/send`)
  - Return: loading, error, success state
  - Test: Mock API response, verify state updates

- [ ] **Create component: `features/outreach/components/SendToClientButton.tsx`**
  - Button component with:
    - Click handler → opens modal
    - Modal shows confirmation
    - On confirm → calls hook → shows spinner
    - On success → close modal + show toast
    - On error → show error message
  - Test: Render component, click button, verify modal appears

- [ ] **Create modal component**
  - Shows lead name
  - Shows message preview
  - Confirm/Cancel buttons
  - Error state display

- [ ] **API client setup** (`src/services/api/client.ts`)
  - Implement `fetch()` helper with:
    - Automatic `Authorization` header
    - `X-Request-ID` for tracing
    - `X-Idempotency-Key` for writes
    - Error handling (parse error response)
  - Implement `get()`, `post()`, `put()` wrappers

- [ ] **Outreach API methods** (`features/outreach/services/outreachAPI.ts`)
  - Implement `sendMessage(request)` → POST /api/v1/outreach/send
  - Implement `batchSubmit(request)` → POST /api/v1/outreach/batch
  - Implement `getMessageStatus(id)` → GET /api/v1/outreach/{id}/status
  - Implement `getCampaigns()` → GET /api/v1/outreach/campaigns (stub for week 1)

- [ ] **Integrate into main app**
  - Add SendToClientButton to chat UI (or test page)
  - Test: Click button → confirm → API call → backend response

---

## PHASE: E2E Testing & Integration (Thu Afternoon–Fri)

### QA Team — Write Integration Tests

- [ ] **Test scenario 1: Send single message**
  - Step 1: Insert test lead into DB (via psql)
  - Step 2: Insert test template into DB (via psql)
  - Step 3: POST /api/v1/outreach/send with valid data
  - Expected: 201 response with message_id
  - Expected: Message in outreach_messages table with status="pending"
  - Test file: `backend/tests/integration/send.test.ts`

- [ ] **Test scenario 2: Batch submit**
  - Step 1: POST /api/v1/outreach/batch with 3 leads
  - Expected: 202 response with campaign_id
  - Expected: Campaign in outreach_campaigns table
  - Expected: 3 messages in outreach_messages table
  - Test file: `backend/tests/integration/batch.test.ts`

- [ ] **Test scenario 3: Get message status**
  - Step 1: Create message via /send endpoint
  - Step 2: GET /api/v1/outreach/{id}/status
  - Expected: 200 response with current status
  - Expected: Empty events array (no webhooks yet)
  - Test file: `backend/tests/integration/status.test.ts`

- [ ] **Frontend E2E test** (using Cypress or Playwright)
  - Step 1: Render SendToClientButton
  - Step 2: Click button → modal appears
  - Step 3: Click confirm → API call
  - Step 4: Wait for success toast
  - Expected: No errors, clean UX
  - Test file: `frontend/e2e/send-to-client.cy.ts`

### Both Teams — Integration Testing

- [ ] **Manual E2E flow:**
  1. Frontend: Click "Send to Client" button
  2. Page-Agent (stub): Logs "Running workflow..."
  3. Frontend: Calls POST /api/v1/outreach/send
  4. Backend: Inserts into DB, returns message_id
  5. Frontend: Shows success toast with message_id
  6. Ops: Query DB → confirm message in table

- [ ] **Test error cases:**
  - Invalid email → 400 error
  - Missing template → 404 error
  - Database error → 500 error
  - Each should show appropriate error message in UI

### Backend Team — Code Quality

- [ ] **Run linter**
  - `npm run lint` → fix all errors ✅
  - `npm run format` → auto-format code

- [ ] **Type checking**
  - `npm run type-check` → no errors ✅
  - Ensure all functions have proper TypeScript types

- [ ] **Coverage**
  - `npm run test:coverage` → >70% coverage on services

### Frontend Team — Code Quality

- [ ] **Run linter**
  - `npm run lint` → fix all errors ✅

- [ ] **Type checking**
  - `npm run type-check` → no errors ✅

- [ ] **Build test**
  - `npm run build` → produces dist/ successfully ✅

### Ops Team — Deployment Readiness

- [ ] **Docker setup** (optional for week 1)
  - Create `Dockerfile` for backend
  - Create `docker-compose.yml` for local dev (backend + postgres)
  - Test: `docker-compose up` → both services running

- [ ] **CI/CD verification**
  - Push to branch → GitHub Actions runs
  - Tests pass → workflow succeeds ✅
  - Linter passes → no warnings

---

## PHASE: Documentation & Handoff (Fri Afternoon)

### Both Teams — Document Work

- [ ] **Backend team:**
  - Update `BACKEND_API_SKELETON.md` with actual implementation
  - Add examples of API requests/responses
  - Document any deviations from spec
  - Update `README.md` with setup instructions

- [ ] **Frontend team:**
  - Update `FRONTEND_SETUP.md` with actual implementation
  - Document component prop interfaces
  - Document API client usage
  - Update `README.md` with setup instructions

- [ ] **QA team:**
  - Document test setup & how to run tests
  - List all passing tests
  - Document known issues (if any) for week 2

### Project Status

- [ ] **Create Week-1 Summary**
  ```markdown
  # Week-1 Status: Phase-5 Outreach API
  
  ## Completed ✅
  - Database: 8 tables + enums created
  - Backend: 3 core endpoints operational
  - Frontend: Abstraction layer scaffolded
  - Tests: E2E flow working (send → backend → DB)
  
  ## Metrics
  - API response time: <200ms (3-core endpoints)
  - Test coverage: 75% (services)
  - Build time: <30s
  - Database queries: All indexed, <100ms
  
  ## Ready for Week-2
  - Template variants (LLM generation)
  - Batch job queue
  - Webhook receiver
  - Analytics aggregation
  ```

- [ ] **Share with team:**
  - Post summary in Slack/email
  - Schedule Week-2 kickoff meeting
  - Confirm no blockers for Week-2

---

## Success Criteria (Checklist)

- [ ] Database: All 8 tables created, migrations idempotent
- [ ] Backend: All 3 endpoints return 2xx responses
- [ ] Frontend: SendToClientButton clickable, no console errors
- [ ] E2E: Send → Backend → Database → Query confirms data
- [ ] Tests: Unit + integration tests running, >70% coverage
- [ ] CI/CD: All GitHub Actions workflows passing
- [ ] Code: No linter errors, no type errors
- [ ] Docs: Implementation documented, ready for Week-2

---

## Blockers / Escalation Path

If blocked:
1. Check related artifacts (API spec, type definitions)
2. Ask team lead (same day)
3. Ping planning/architecture (next day if needed)

Common blockers → solutions:
- "Database connection fails" → Check `DATABASE_URL` in `.env.local`
- "API returns 404" → Check route is imported in `src/index.ts`
- "Types missing" → Import from `@castironforge/shared-types`
- "Frontend can't reach backend" → Check `VITE_API_URL` in `.env.local`

---

## Time Allocation

- **Mon–Tue Morning (8h):** Database + environment + project setup
- **Tue Afternoon–Wed (16h):** Backend API (3 endpoints + services)
- **Wed Afternoon–Thu (16h):** Frontend integration + automation layer
- **Thu Afternoon–Fri (12h):** E2E testing + code quality + handoff

**Total: 52 hours** (5 days × 8–10 hours/day)

---

## Deliverables by End of Week-1

1. ✅ Operational database (8 tables, analytics, maintenance)
2. ✅ Working backend API (3 endpoints, 100+ lines of code)
3. ✅ Frontend scaffold (abstraction layer, components, hooks)
4. ✅ E2E test passing (send → backend → database)
5. ✅ Unit test suite (>70% coverage)
6. ✅ Documentation (setup guides, API examples)
7. ✅ CI/CD passing (all automated checks green)

---

**Ready to ship?** Friday EOD, all green. Start Week-2 Monday with Templates + Variants.
