# CIC Conflict Graph Specification v1.0.0
**Project:** Cast Iron Charlie
**Scope:** GAP-001 to GAP-030
**Purpose:** Machine-readable modeling of power dynamics and systemic tensions.

---

## 1. DATA SCHEMA (JSON)

The graph is modeled as a directed multi-graph where nodes represent entities and edges represent relationships (conflicts or alliances).

### **Node Object**
```json
{
  "id": "string (unique)",
  "label": "string (display name)",
  "type": "PERSON | DEPARTMENT | ORGANIZATION | PROGRAM",
  "era_origin": "string (GAP ID)",
  "tags": ["string"]
}
```

### **Edge Object**
```json
{
  "id": "string (unique)",
  "source": "node_id",
  "target": "node_id",
  "type": "CONFLICT | ALLIANCE | HIERARCHY",
  "subtype": "EXECUTIVE | INDUSTRIAL | LABOR | MARKET | CULTURAL",
  "intensity": 0.0 to 1.0,
  "status": "ACTIVE | RESOLVED | LATENT",
  "gap_context": ["GAP-XXX"],
  "description": "string",
  "outcome": "string (optional)"
}
```

---

## 2. TOPOLOGY MAP (001–030)

### **A. Core Nodes**
- **People**: Henry Ford, Edsel Ford, Charles Sorensen, Harry Bennett, Henry Ford II, Robert McNamara, William Knudsen.
- **Departments**: Ford Service Dept, Sociological Dept, Finance/Accounting, Edsel Division.
- **Organizations**: Ford Motor Company, UAW, General Motors.
- **Programs**: Model T, B-24 (Willow Run), Edsel, Falcon.

### **B. Strategic Edges (Sample)**
| Source | Target | Type | Subtype | Gap Context |
|---|---|---|---|---|
| Henry Ford | Edsel Ford | CONFLICT | EXECUTIVE | 010, 011 |
| Henry Ford | Sorensen | CONFLICT | INDUSTRIAL | 007, 013, 014 |
| Sorensen | Bennett | CONFLICT | EXECUTIVE | 010, 011 |
| HFII | Bennett | CONFLICT | EXECUTIVE | 015, 016 |
| HFII | McNamara | CONFLICT | CULTURAL | 024, 028 |
| Sorensen | Knudsen | CONFLICT | INDUSTRIAL | 006 |
| Service Dept | UAW | CONFLICT | LABOR | 009, 019 |
| Edsel Div | Ford Div | CONFLICT | MARKET | 022, 023 |

---

## 3. ERA-BASED ANALYSIS

- **The Paternalistic Era (001-014)**: High intensity Executive/Industrial conflict. Centralized in Henry Ford.
- **The Transition Era (015-021)**: High intensity Executive conflict (Purge of Old Guard).
- **The Systems Era (022-030)**: High intensity Cultural/Market conflict. Rise of quantitative management.

---

## 4. USAGE INSTRUCTIONS
1. **Extraction**: Use `run_synthesis.js --extract-conflicts` to populate from research blocks.
2. **Analysis**: Run `compute-conflict-weight.js` to identify primary narrative bottlenecks.
3. **Visualization**: Feed JSON to D3.js or similar for interactive power mapping.
