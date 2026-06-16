export interface SearchResult {
  id: string;
  text: string;
  score: number;
  source: string;
}

export const rag = {
  async search(query: string, topK: number): Promise<SearchResult[]> {
    // TODO: implement TorqueQuery or vector DB search
    void query;
    void topK;
    return [];
  }
};
