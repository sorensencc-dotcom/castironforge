// familysearch-throttle.js — 2026-06-22 — v1.0.0

export async function familySearchFetch(url, options, retries = 3) {
  let attempt = 0;

  while (attempt < retries) {
    const res = await fetch(url, options);

    // 200–299 → success
    if (res.ok) return res;

    // 429 → rate limited
    if (res.status === 429) {
      const wait = 500 * Math.pow(2, attempt); // 500ms, 1s, 2s
      await new Promise(r => setTimeout(r, wait));
      attempt++;
      continue;
    }

    // 5xx → transient server error
    if (res.status >= 500 && res.status < 600) {
      const wait = 300 * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, wait));
      attempt++;
      continue;
    }

    // Other errors → fail immediately
    const text = await res.text();
    throw new Error(`FamilySearch request failed: ${text}`);
  }

  throw new Error("FamilySearch request failed after retries");
}
