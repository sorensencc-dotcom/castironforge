const TORQUE_URL = process.env.TORQUE_URL ?? 'http://localhost:9000';

export interface SearchResult {
  id: string;
  text: string;
  score: number;
  source: string;
}

interface TorqueResponse {
  results?: SearchResult[];
}

export const rag = {
  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    const res = await fetch(`${TORQUE_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, topK })
    });

    if (!res.ok) throw new Error(`TorqueQuery error: ${res.status}`);
    const data = (await res.json()) as TorqueResponse;
    return data.results ?? [];
  }
};
