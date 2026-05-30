# File: projects/cic/docs/CIC_OPERATOR_GUIDE.md
# Path: projects/cic/docs/CIC_OPERATOR_GUIDE.md
# Version: 1.1.0
# Date: 2026-05-28
# Purpose: Operator-facing guide for running and managing the Goal-Driven CIC system

# ============================================================
# CAST IRON CHARLIE — OPERATOR GUIDE (v1.1.0)
# ============================================================

## 1. OPERATING PHILOSOPHY
In CIC v3.1.0, the operator doesn't just "run scripts." The operator **manages goals**. Every research task starts as a declarative contract that the system must satisfy within specific constraints.

---

## 2. THE GOAL-DRIVEN LOOP

1. **Identify Gap**: Check `CIC_NARRATIVE_GAP_REGISTER.md` for `PENDING` gaps.
2. **Materialize Goal**: Use the `/goal` DSL to define the research task.
3. **Monitor Execution**: Watch the **Control Plane** for real-time cost, security, and host health metrics.
4. **Audit Results**: Review the `AuditAgent` confidence scores and `rights_status`.

---

## 3. HOW TO TRIGGER A GOAL

### 3.1 Via Narrative Gap Register
The system can be configured to auto-materialize goals from high-priority gaps:
```bash
# Example command to scan register and fire goals
cic-architect --scan-gaps --priority P0
```

### 3.2 Manual DSL Injection
For targeted research, use the `/goal` syntax:
```hcl
goal "custom_research_001" {
    intent { description = "Find Sorensen's 1943 itinerary" }
    constraints { max_cost = "$1.00", model_tier = "pro" }
    success { audit.confidence >= 0.90 }
}
```

### 3.3 Batch Operations (GAP Manager)
For multi-gap initialization and token efficiency, use the GAP Manager:
```bash
# Execute batch initialization, registration, and verification
node scripts/gap-manager.js <batch.json>
```
*Note: This reduces conversational turns and context usage by consolidating artifact generation.*

### 3.4 SkillOpt Management
The SkillOpt subsystem provides capabilities for managing and optimizing skill performance.

- **`node src/cli.mjs skillopt:validate <itemPath> <outputPath>`**: Validates a single SkillOpt item and outputs the result.
- **`node src/cli.mjs skillopt:train`**: Initiates the training process for SkillOpt models.
- **`node src/cli.mjs skillopt:deploy`**: Deploys the best performing SkillOpt model to production.
- **`node src/cli.mjs skillopt:metrics`**: Aggregates and displays current SkillOpt system metrics.

---

### 3.5 Dashboard Access
To monitor the SkillOpt system and view performance metrics, start the dashboard server:
```bash
npm run skillopt:dashboard
```
The dashboard UI will typically be accessible via a web browser at `http://localhost:3000` (or the configured `DASHBOARD_PORT`).

---

## 4. INTERPRETING GOVERNANCE SIGNALS

### 4.1 Economy (TokenEconomyAgent)
- **Cost**: Real-time USD spend. If approaching `max_cost`, the system will attempt model-downgrade or halt.
- **ROI**: Ratio of high-confidence evidence found per dollar spent.

### 4.2 Security (SecuritySentinelAgent)
- **Status: CLEAN**: Asset passed all security probes.
- **Status: QUARANTINED**: Asset blocked due to PII (SSN, emails) or malicious detection.

### 4.3 Audit (AuditAgent)
- **Confidence Score**: 0.0 to 1.0. 
    - **> 0.90**: Factual gold standard.
    - **0.70 - 0.90**: Needs manual verification.
    - **< 0.70**: Insufficient evidence / Hallucination risk.

---

## 5. ENVIRONMENT HEALTH (WSL2/LINUX)
The operator dashboard surfaces "Host Health." 
- **DISK**: Red alerts at < 5GB remaining. Clean `cic_test_root/CIC_Processed` if pressure is high.
- **LOAD**: If load > 10.0, MAS will throttle parallel harvester tasks.

---

## 6. RIGHTS & LEGAL CLEARANCE
Every asset now carries a `rights_status`:
- **CLEAN**: Public domain or pre-cleared for broadcast.
- **RESTRICTED**: Usage limited (e.g., Festival only).
- **UNKNOWN**: Requires manual legal review.

---

## 7. SUMMARY
Operator success is measured by **Goal Completion Rate** and **Audit Confidence**. Always prioritize P0 gaps and keep the `max_cost` aligned with the current production budget.

# END OF DOCUMENT
