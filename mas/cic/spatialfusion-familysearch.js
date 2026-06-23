// spatialfusion-familysearch.js — 2026-06-22 — v1.0.0

export function fuseFamilySearchSpatial({ fsPlaces, otherPlaces }) {
  const unified = {};

  // Collect all place references
  for (const p of fsPlaces) {
    const key = p.name ?? p.location;
    if (!unified[key]) {
      unified[key] = {
        name: p.name,
        location: p.location,
        type: p.type,
        providers: new Set(),
        count: 0
      };
    }
    unified[key].providers.add("familysearch");
    unified[key].count++;
  }

  // Merge other providers
  for (const provider of Object.keys(otherPlaces)) {
    for (const p of otherPlaces[provider]) {
      const key = p.name ?? p.location;
      if (!unified[key]) {
        unified[key] = {
          name: p.name,
          location: p.location,
          type: p.type,
          providers: new Set(),
          count: 0
        };
      }
      unified[key].providers.add(provider);
      unified[key].count++;
    }
  }

  // Convert sets → arrays and sort by frequency
  const result = Object.values(unified).map(p => ({
    name: p.name,
    location: p.location,
    type: p.type,
    providers: [...p.providers],
    count: p.count
  }));

  result.sort((a, b) => b.count - a.count);

  return result;
}
