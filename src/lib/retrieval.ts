import { Index } from "@upstash/vector";
import { embed, rerank } from "./voyage";

export type Source = {
  id: string;
  corpus: string;
  livre: string;
  chapitre: string | null;
  page: number | null;
  text: string;
  score: number;
};

type ChunkMetadata = {
  corpus?: string;
  livre?: string;
  chapitre?: string;
  page?: number;
  source_path?: string;
  text?: string;
};

const RETRIEVE_K = 30;
const RERANK_K = 8;

let cached: Index<ChunkMetadata> | null = null;

function getIndex(): Index<ChunkMetadata> | null {
  if (cached) return cached;
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  if (!url || !token) return null;
  cached = new Index<ChunkMetadata>({ url, token });
  return cached;
}

export async function retrieve(query: string, k = RERANK_K): Promise<Source[]> {
  const index = getIndex();
  if (!index) return [];

  const [vector] = await embed([query], "query");
  const results = await index.query({
    vector,
    topK: RETRIEVE_K,
    includeMetadata: true,
  });

  const candidates = results.map((r) => {
    const m = r.metadata ?? {};
    return {
      id: String(r.id),
      score: typeof r.score === "number" ? r.score : 0,
      corpus: m.corpus ?? "",
      livre: m.livre ?? "",
      chapitre: m.chapitre && m.chapitre.length > 0 ? m.chapitre : null,
      page: typeof m.page === "number" && m.page > 0 ? m.page : null,
      text: m.text ?? "",
    };
  });

  if (candidates.length === 0) return [];

  // Voyage rerank-2.5 over the top-30 candidates -> keep top-k.
  try {
    const reranked = await rerank(
      query,
      candidates.map((c) => c.text || "[empty]"),
      k,
    );
    return reranked.map((r) => ({
      ...candidates[r.index],
      score: r.relevance_score,
    }));
  } catch (e) {
    console.error("rerank failed, falling back to raw cosine top-k", e);
    return candidates.slice(0, k);
  }
}

export function formatSourcesBlock(sources: Source[]): string {
  if (!sources.length) return "";
  const items = sources
    .map((s, i) => {
      const ref = [s.corpus, s.livre, s.chapitre, s.page ? `p.${s.page}` : null]
        .filter(Boolean)
        .join(" — ");
      return `[${i + 1}] ${ref}\n${s.text}`;
    })
    .join("\n\n---\n\n");
  return `<sources>\n${items}\n</sources>`;
}
