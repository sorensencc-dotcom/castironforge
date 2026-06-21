export interface TypesenseResult {
  document: {
    id: string;
    content: string;
    title: string;
    author: string;
    path: string;
    mime: string;
    repo: string;
    phase: string;
    adapter: string;
  };
  text_match_score: number;
}

export interface QdrantResult {
  id: string;
  score: number;
  payload: {
    id: string;
    repo: string;
    path: string;
    phase: string;
    adapter: string;
    mime: string;
    title: string;
    author: string;
  };
}

export interface FusedResult {
  id: string;
  path: string;
  repo: string;
  title: string;
  author: string;
  mime: string;
  phase: string;
  adapter: string;
  keywordScore: number;
  semanticScore: number;
  hybridScore: number;
  rank: number;
}

export function hybridFuse(
  typesenseResults: TypesenseResult[],
  qdrantResults: QdrantResult[],
  alpha: number = 0.4,
  beta: number = 0.6
): FusedResult[] {
  // Normalize scores to [0, 1]
  const tsScores = new Map<string, number>();
  const maxTsScore = Math.max(...typesenseResults.map((r) => r.text_match_score), 1);
  for (const result of typesenseResults) {
    tsScores.set(result.document.id, result.text_match_score / maxTsScore);
  }

  const qdScores = new Map<string, number>();
  const maxQdScore = Math.max(...qdrantResults.map((r) => r.score), 1);
  for (const result of qdrantResults) {
    qdScores.set(result.id, result.score / maxQdScore);
  }

  // Collect all unique document IDs
  const allIds = new Set<string>([
    ...typesenseResults.map((r) => r.document.id),
    ...qdrantResults.map((r) => r.id)
  ]);

  // Fuse scores and build result objects
  const fused: Array<{ id: string; hybridScore: number; data: FusedResult }> = [];

  for (const id of allIds) {
    const tsResult = typesenseResults.find((r) => r.document.id === id);
    const qdResult = qdrantResults.find((r) => r.id === id);

    const keywordScore = tsScores.get(id) ?? 0;
    const semanticScore = qdScores.get(id) ?? 0;
    const hybridScore = alpha * keywordScore + beta * semanticScore;

    const source = tsResult ? tsResult.document : qdResult!.payload;

    fused.push({
      id,
      hybridScore,
      data: {
        id,
        path: source.path,
        repo: source.repo,
        title: source.title,
        author: source.author,
        mime: source.mime,
        phase: source.phase,
        adapter: source.adapter,
        keywordScore,
        semanticScore,
        hybridScore,
        rank: 0 // Will be set after sorting
      }
    });
  }

  // Sort by hybrid score (descending) and assign ranks
  fused.sort((a, b) => b.hybridScore - a.hybridScore);
  fused.forEach((item, index) => {
    item.data.rank = index + 1;
  });

  return fused.map((item) => item.data);
}
