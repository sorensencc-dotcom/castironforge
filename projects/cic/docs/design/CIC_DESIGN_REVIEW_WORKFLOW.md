# CIC DESIGN REVIEW WORKFLOW
# Document ID: CIC-DESIGN-REVIEW-WORKFLOW-v1.0
# Owner: CIC Design Authority
# Status: Active

---

## 0. Overview
The CIC Design Review Workflow is the operational pipeline for ensuring every CIC asset (UI, Doc, Slide, Social) complies with the **CIC Design System v1.0** and the **CIC Design Policy v1.0**.

This process is mandatory for all publication-ready assets.

---

## 1. Submission Phase

### 1.1 Trigger
A submission is triggered when an operator or system proposes a new or updated CIC asset.

### 1.2 Required Metadata
Every submission must include:
- **Asset ID**: Unique identifier for the asset.
- **Asset Type**: (UI | DOC | SLIDE | SOCIAL | MEMO | API).
- **Source Path**: Path to the source file (e.g., `.md`, `.tsx`, `.pptx`).
- **Owner**: The operator responsible for the asset.

---

## 2. Phase 1: Automated Validation (L1)
Automated checks are performed by the CIC Intelligence Layer.

### 2.1 Semantic Check
- **Tool**: `cic-glossary-linker.js`
- **Action**: Verify all glossary terms are correctly identified and ready for auto-linking.
- **Success Criteria**: 0 unlinked known terms.

### 2.2 API Drift Check (API Assets Only)
- **Tool**: `cic-api-change-detector.js`
- **Action**: Compare proposed API spec against current canonical index.
- **Success Criteria**: All changes (Add/Remove/Modify) are documented and versioned.

### 2.3 Structural Check
- **Tool**: `cic-docsify-theme.css` / Custom Linting
- **Action**: Verify adherence to spacing, grid, and typography constants.
- **Success Criteria**: 0 style violations.

### 2.4 Outcome
- **Pass**: Proceed to Phase 2.
- **Fail**: Automatic rejection with a generated "L1 Failure Report".

---

## 3. Phase 2: Manual Review (L2)
Performed by the **CIC Design Review Council**.

### 3.1 Visual Adherence Audit
- **Palette**: Verify use of Forge, Iron, Ember, Brass, Ash, and Bone.
- **Corners**: Verify zero rounded corners on all UI/Layout elements.
- **Typography**: Verify use of Playfair Display, Libre Baskerville, and Barlow Condensed.

### 3.2 Component & Icon Audit
- **Components**: Verify use of `cic-*` primitives.
- **Icons**: Verify all icons are from the `cic-icon-*` set.
- **Industrial Aesthetic**: Ensure the asset maintains the "Operator-Grade" industrial look.

### 3.3 Documentation Audit (DOC Assets Only)
- **Structure**: Verify adherence to the specific `CIC-DOC-*` template.
- **Clarity**: Ensure technical precision and lack of "fluff".

### 3.4 Outcome
- **Approve**: Proceed to Phase 3.
- **Reject**: Return to Owner with a "Reviewer Note" (Location, Problem, Fix).

---

## 3. Phase 3: Final Approval & Publication (L3)
Performed by the **CIC Design Authority Lead**.

### 3.1 Integrity Check
- Final verification that L1 and L2 steps were completed.
- Check for cross-surface consistency (does this doc match the UI it describes?).

### 3.2 Publication
- Asset is moved to "Active" status.
- Asset is indexed by the CIC Documentation Console.
- Release Intelligence Layer is updated with the new asset version.

---

## 4. Exception Workflow
In rare cases where a design requirement cannot be met:
1. **Request**: Owner submits an "Exception Request".
2. **Review**: Design Authority Lead evaluates the impact on brand/system integrity.
3. **Outcome**: Approved (temporary or permanent) or Denied.

---

## 5. Audit & Maintenance
- **Quarterly Audit**: The Design Authority conducts a sweep of all active assets to ensure no "drift" has occurred.
- **System Update**: If the Design System is updated (e.g., to v1.1), all assets must be re-validated within 14 days.

---

## 6. Versioning
- **v1.0** — Initial Workflow definition.
- **v1.1** — Integration with CIC MAS Audit Agent.
