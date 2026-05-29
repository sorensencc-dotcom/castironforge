# CIC /goal DSL Specification (v0.9.2-alpha)
**Purpose:**
Define a declarative, verifiable end-state for CIC’s multi-agent execution layer.

---

# 1. Top-Level Structure
```hcl
goal "<GOAL_ID>" {
    intent { ... }
    requires { ... }
    constraints { ... }
    success { ... }
    artifacts { ... }
}
```

---

# 2. `intent` Block
Human-readable purpose and ownership.
```hcl
intent {
    description = "Description of the goal"
    owner       = "cic.operator"
}
```

---

# 3. `requires` Block
Preconditions for execution.
```hcl
requires {
    repo.clean = true
    branch = "feature/name"
    tests.available = ["unit", "integration"]
    agents.available >= 3
}
```

---

# 4. `constraints` Block
Execution boundaries and resource management.
```hcl
constraints {
    max_runtime = "4h"
    max_diff_size = "5000 lines"
    allow.deletions = true
    
    // Resource & Governance Hooks (TokenEconomyAgent)
    max_cost = "$2.00"               // Hard budget cap
    token_budget = 500000            // Explicit token ceiling
    
    // Security & Routing Hooks (SecuritySentinelAgent)
    security_level = "strict"        // no external writes, no PII leakage
    model_tier = "pro"               // Routing hint: economy | standard | pro
    
    // Execution Control
    on_failure = "rollback"          // halt | rollback | retry(n)
    max_retries = 3                  // MAS retry envelope
}
```

---

# 5. `success` Block
Verifiable end-state conditions.
```hcl
success {
    tests.pass = ["unit", "integration"]
    lint.clean = true
    typescript.esm = true
    latency.harvester < 50ms
    
    // Audit & Integrity Hooks (AuditAgent)
    audit.confidence >= 0.92         // Minimum truth threshold
    audit.max_anomalies = 0          // Zero-tolerance for drift
    pipeline.status = "clean"        // No DLQ residue
    security.clean = true            // Sentinel verification
}
```

---

# 6. `artifacts` Block
Post-success emissions.
```hcl
artifacts {
    diff = true
    verification_report = true
    changelog = "AUTO"
    rollout = "staged"               // none | staged | full
}

---

# 7. Example: Narrative Gap Fill
```hcl
goal "cic.harvester_v2.gap_fill" {
  intent {
    description = "Fill a narrative research gap for Cast Iron Charlie using CIC ingestion + MAS."
    owner       = "cic.operator"
  }

  constraints {
    max_cost        = "$2.00"
    security_level  = "strict"
    model_tier      = "pro"
    on_failure      = "rollback"
    max_retries     = 3
  }

  success {
    audit.confidence    >= 0.92
    audit.max_anomalies == 0
    pipeline.status     == "clean"
  }
}
```
