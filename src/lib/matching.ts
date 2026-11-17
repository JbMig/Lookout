import { config, isDemo } from "./config";

/**
 * Rapprochement de produits (catalogue client ↔ produits collectés).
 * Embeddings multilingues Hugging Face si disponibles, sinon similarité de mots.
 */

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenSimilarity(a: string, b: string) {
  const A = new Set(normalize(a).split(" ").filter((w) => w.length > 1));
  const B = new Set(normalize(b).split(" ").filter((w) => w.length > 1));
  if (!A.size || !B.size) return 0;
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / new Set([...A, ...B]).size;
}

async function embed(texts: string[]): Promise<number[][] | null> {
  if (isDemo.hf || !texts.length) return null;
  try {
    const res = await fetch(
      `https://router.huggingface.co/hf-inference/models/${config.hf.embeddingModel}/pipeline/feature-extraction`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${config.hf.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: texts }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!res.ok) return null;
    const out = (await res.json()) as number[][];
    return Array.isArray(out) && Array.isArray(out[0]) ? out : null;
  } catch {
    return null;
  }
}

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** Pour chaque requête, renvoie l'indice du meilleur candidat et son score (0-1). */
export async function bestMatches(queries: string[], candidates: string[]) {
  if (!candidates.length) return queries.map(() => ({ index: -1, score: 0 }));
  const vectors = await embed([...queries, ...candidates]);
  return queries.map((q, qi) => {
    let best = { index: -1, score: 0 };
    candidates.forEach((c, ci) => {
      const score = vectors ? cosine(vectors[qi], vectors[queries.length + ci]) : tokenSimilarity(q, c);
      if (score > best.score) best = { index: ci, score };
    });
    return best;
  });
}

export const MATCH_THRESHOLD = isDemo.hf ? 0.34 : 0.72;
