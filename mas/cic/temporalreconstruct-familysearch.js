// temporalreconstruct-familysearch.js — 2026-06-22 — v1.0.0

export function reconstructFamilySearchTemporal({ person }) {
  const out = {};

  const birth = person.birth;
  const death = person.death;

  // Birth inference
  if (birth) {
    out.birth = birth;
  } else if (death) {
    const d = parseInt(death);
    out.birth = `${d - 60}`; // deterministic heuristic
  } else {
    out.birth = "1850"; // fallback deterministic anchor
  }

  // Death inference
  if (death) {
    out.death = death;
  } else if (birth) {
    const b = parseInt(birth);
    out.death = `${b + 70}`;
  } else {
    out.death = "1920";
  }

  // Marriage inference
  out.marriage =
    birth && death
      ? `${parseInt(birth) + 25}`
      : null;

  return out;
}
