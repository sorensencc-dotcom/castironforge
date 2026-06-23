// temporaluncertainty-familysearch.js — 2026-06-22 — v1.0.0

export function modelFamilySearchTemporalUncertainty({ temporal }) {
  const ranges = {};

  const birth = temporal.events.find(e => e.type === "BIRTH");
  const death = temporal.events.find(e => e.type === "DEATH");

  // Birth uncertainty
  if (birth) {
    ranges.birth = {
      earliest: birth.date,
      latest: birth.date,
      confidence: 1.0
    };
  } else {
    ranges.birth = {
      earliest: "1800",
      latest: "1950",
      confidence: 0.2
    };
  }

  // Death uncertainty
  if (death) {
    ranges.death = {
      earliest: death.date,
      latest: death.date,
      confidence: 1.0
    };
  } else if (birth) {
    const birthYear = parseInt(birth.date);
    ranges.death = {
      earliest: `${birthYear + 40}`,
      latest: `${birthYear + 100}`,
      confidence: 0.3
    };
  } else {
    ranges.death = {
      earliest: "1850",
      latest: "2000",
      confidence: 0.1
    };
  }

  return ranges;
}
