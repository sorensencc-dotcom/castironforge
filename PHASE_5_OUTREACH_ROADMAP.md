# PHASE-5 OUTREACH AUTOMATION ROADMAP

**Version:** 1.0.0  
**Owner:** RewriteLabs / CIC Planning  
**Updated:** 2026-06-20

---

## 0. Overview

Phase-5 unifies the two outreach surfaces into a single system with two execution modes:

- **Interactive:** Page-Agent (human-in-the-loop, real-time)
- **Batch:** Backend engine (scheduled, scalable, bulk)

Both modes feed into shared infrastructure: template store, lead store, audit log, and delivery analytics.

---

## 1. Objectives

- Build a unified outreach pipeline with both interactive and batch execution modes
- Add template intelligence (LLM-generated variants, tone matching)
- Add delivery analytics (open rate, click rate, bounce rate)
- Add operator-grade audit logs for compliance
- Integrate with CIC Planning Engine for automated follow-ups

---

## 2. Architecture (Phase-5)

### 2.1 Two Execution Modes

| Mode | Engine | Use Case |
|------|--------|----------|
| **Interactive** | Page-Agent | "Send to Client" CTA, 1:1 messages |
| **Batch** | Backend Outreach Engine | CSV imports, campaigns, scheduled sends |

Both feed into the same shared resources:
- Template store
- Lead store
- Audit log
- Delivery analytics

---

## 3. Phase-5 Workstreams

### WS-1: Unified Outreach API (Backend)

Create a single API surface that both Page-Agent and batch engine call:

```
POST   /outreach/send          (interactive)
POST   /outreach/batch         (bulk)
POST   /outreach/preview       (template preview)
GET    /outreach/{id}/status   (delivery status)
```

**Owners:** Backend  
**Duration:** Week 1-2

---

### WS-2: Template Intelligence

- LLM-generated variants for A/B testing
- Tone matching (formal, casual, sales, follow-up)
- Personalization tokens ({{lead.name}}, {{company}}, etc.)
- A/B testing support with variant tracking

**Owners:** Backend + Planning Engine  
**Duration:** Week 3-4

---

### WS-3: Delivery Analytics

Collect metrics across all sends:

- `delivery_success_rate`
- `open_rate`
- `click_rate`
- `bounce_rate`
- `time_to_open`

Dashboard panel: "Outreach Performance"

**Owners:** Backend + Frontend  
**Duration:** Week 5-6

---

### WS-4: Audit Log

Every send (interactive or batch) emits events:

```
outreach.send.start
outreach.send.success
outreach.send.error
outreach.send.clicked
outreach.send.opened
```

Stored in unified audit table with full context (lead, template, engine, user).

**Owners:** Backend  
**Duration:** Week 5-6

---

### WS-5: CIC Planning Engine Integration

Planning Engine gains capability to:

- Trigger follow-ups based on engagement
- Suggest next outreach steps
- Auto-generate message drafts
- Detect stalled leads
- Recommend cadence

**Owners:** Planning Engine + Backend  
**Duration:** Week 7-8

---

## 4. Timeline

| Week | Deliverables | Owner |
|------|--------------|-------|
| 1-2 | Unified Outreach API, Page-Agent abstraction layer | Backend + Frontend |
| 3-4 | Batch engine integration, template intelligence | Backend + Planning |
| 5-6 | Delivery analytics, audit log | Backend + Frontend |
| 7-8 | Planning Engine integration, UX polish | All |

---

## 5. Success Criteria

- ✅ One outreach API surface for both interactive and batch modes
- ✅ Page-Agent fully optional (swappable via abstraction layer)
- ✅ Batch engine handles 10k+ leads per campaign
- ✅ Delivery analytics visible in dashboard
- ✅ Planning Engine can orchestrate follow-ups
- ✅ Audit trail meets compliance requirements
- ✅ No UI rewrites required when swapping engines

---

## 6. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Page-Agent unavailable | Fallback to manual send; abstraction layer enables engine swap |
| Template variants multiply LLM calls | Cache templates; batch template generation |
| Delivery analytics latency | Async event collection; real-time dashboard with 5m lag |
| Audit log bloat | Partition by date; archive old entries quarterly |
| Planning Engine feedback loops | Rate limit auto-follow-ups; human approval for campaigns |

---

## 7. Metrics & Monitoring

### KPIs

- **Engagement rate:** (opens + clicks) / sends
- **Delivery rate:** successful_sends / total_sends
- **Time-to-send:** median latency from CTA to delivery
- **Operator satisfaction:** usability survey score
- **Compliance:** 100% audit trail coverage

### Dashboards

1. **Outreach Performance** (frontend): success rate, engagement rate
2. **Delivery Health** (backend): send latency, error distribution
3. **Planning Insights** (Planning Engine): follow-up effectiveness, lead cadence
4. **Audit Trail** (ops): compliance view with filters by date, user, outcome

---

## 8. Dependencies

- Page-Agent abstraction layer (must be in place before week 1)
- Unified Outreach API spec (must be finalized before week 1)
- Planning Engine API stability (must support callbacks by week 7)
- Email/SMS/CRM delivery backends (must have status webhooks by week 5)

---

## 9. Out of Scope (Phase-5)

- Custom workflow builders (Phase-6)
- Advanced segmentation engine (Phase-6)
- Multi-channel campaigns (Phase-6)
- Lead scoring refinement (Phase-6)
- Export/reporting (Phase-6)

---

## 10. Next Steps

1. **Finalize Unified Outreach API spec** (this week)
2. **Implement Page-Agent abstraction layer** (Week 1)
3. **Wire backend → abstraction layer** (Week 1)
4. **Set up delivery webhook infrastructure** (Week 2)
5. **Begin template intelligence prototyping** (Week 3)
