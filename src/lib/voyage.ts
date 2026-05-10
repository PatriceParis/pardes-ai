const EMBED_URL = "https://api.voyageai.com/v1/embeddings";
const RERANK_URL = "https://api.voyageai.com/v1/rerank";

type VoyageInputType = "query" | "document";

function authHeaders(): Record<string, string> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY missing");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

export async function embed(
  texts: string[],
  inputType: VoyageInputType = "query",
): Promise<number[][]> {
  const model = process.env.VOYAGE_EMBED_MODEL ?? "voyage-3-large";
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ input: texts, model, input_type: inputType }),
  });
  if (!res.ok) {
    throw new Error(`Voyage embed ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data.map((d) => d.embedding);
}

export type RerankResult = { index: number; relevance_score: number };

export async function rerank(
  query: string,
  documents: string[],
  topK: number,
): Promise<RerankResult[]> {
  const model = process.env.VOYAGE_RERANK_MODEL ?? "rerank-2.5";
  const res = await fetch(RERANK_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      query,
      documents,
      model,
      top_k: topK,
    }),
  });
  if (!res.ok) {
    throw new Error(`Voyage rerank ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    data: { index: number; relevance_score: number }[];
  };
  return data.data;
}
