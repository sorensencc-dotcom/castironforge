# File: projects/cic/docs/CIC_SIGNAL_REFERENCE.md
# Path: projects/cic/docs/CIC_SIGNAL_REFERENCE.md
# Purpose: Reference guide for all CIC cross-source signals

# ============================================================
# CAST IRON CHARLIE — SIGNAL REFERENCE (v3.0)
# ============================================================

## 1. OVERVIEW

Signals are computed during cross‑source compression and drive:
- orchestration decisions
- narrative confidence
- audit requirements

Signals quantify evidence quality and consistency.

---

## 2. SIGNAL: agreement_density

### Definition
Proportion of canonical claims that appear consistently across sources.

### Range
`0.0 → 1.0`

### Interpretation
- **> 0.6** → strong alignment  
- **0.3–0.6** → mixed evidence  
- **< 0.3** → conflicting sources  

### Used for
- audit trigger  
- narrative confidence  

---

## 3. SIGNAL: contradiction_density

### Definition
Proportion of canonical claims that conflict across sources.

### Range
`0.0 → 1.0`

### Interpretation
- **> 0.05** → audit required  
- **< 0.05** → safe to synthesize  

### Used for
- audit trigger  

---

## 4. SIGNAL: coverage

### Definition
Proportion of enriched artifacts that produced meaningful compressed evidence.

### Range
`0.0 → 1.0`

### Interpretation
- **> 0.5** → strong evidence  
- **0.2–0.5** → moderate evidence  
- **< 0.2** → insufficient evidence  

### Used for
- synthesis trigger  

---

## 5. SIGNAL INTERACTION MATRIX

```
coverage > 0.2 → enable synthesis
contradiction_density > 0.05 → enable audit
agreement_density < 0.3 → enable audit
```

---

## 6. OPERATOR CHECKLIST

- Low coverage → add more sources  
- High contradiction → inspect canonical claims  
- Low agreement → narrative may be unstable  
- High agreement + low contradiction → strong narrative  

---

## 7. SUMMARY

Signals are the backbone of CIC’s decision graph.  
They determine:
- whether synthesis runs  
- whether audit runs  
- how confident the narrative is  

# END OF DOCUMENT
