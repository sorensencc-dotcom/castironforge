// confidencesynth-familysearch.js — 2026-06-22 — v1.0.0

export function synthesizeFamilySearchConfidence({ fs, others, evidence }) {
  const scores = {};

  const fsBirth = fs.person?.display?.birthDate;
  const fsDeath = fs.person?.display?.deathDate;

  // Agreement score
  let birthAgree = 0;
  let deathAgree = 0;
  let total = 0;

  for (const provider of Object.keys(others)) {
    const o = others[provider];
    if (!o?.person) continue;

    total++;

    if (o.person.display?.birthDate === fsBirth) birthAgree++;
    if (o.person.display?.deathDate === fsDeath) deathAgree++;
  }

  const birthAgreementScore = total > 0 ? birthAgree / total : 0.5;
  const deathAgreementScore = total > 0 ? deathAgree / total : 0.5;

  // Evidence weight score
  const evidenceWeight =
    evidence.reduce((acc, e) => acc + (e.weight ?? 0), 0) /
    Math.max(1, evidence.length);

  scores.birthDate = (birthAgreementScore * 0.6) + (evidenceWeight * 0.4);
  scores.deathDate = (deathAgreementScore * 0.6) + (evidenceWeight * 0.4);

  return scores;
}
