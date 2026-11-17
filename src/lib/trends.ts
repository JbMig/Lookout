import { config, isDemo } from "./config";
import { repo } from "./repo";
import { chat } from "./hf";
import type { TrendItem, TrendPostRow, Trends } from "./types";
import demoPosts from "../../data/demo-social-posts.json";

/**
 * Tendances sociales.
 * 1. Source : la table trend_posts (TikTok / Instagram) si elle contient des publications,
 *    sinon un dataset Hugging Face (HF_TRENDS_DATASET), sinon un échantillon fictif.
 * 2. Comptage des mentions dans le code (actifs, formats, teintes, finitions).
 * 3. Synthèse rédigée par un LLM Hugging Face.
 */

const VOCAB: { label: string; type: TrendItem["type"]; terms: string[] }[] = [
  { label: "Niacinamide", type: "actif", terms: ["niacinamide"] },
  { label: "Acide hyaluronique", type: "actif", terms: ["hyaluronic", "hyaluronique"] },
  { label: "Squalane", type: "actif", terms: ["squalane"] },
  { label: "Peptides", type: "actif", terms: ["peptide"] },
  { label: "Céramides", type: "actif", terms: ["ceramide"] },
  { label: "Vitamine C", type: "actif", terms: ["vitamin c", "vitamine c"] },
  { label: "SPF", type: "actif", terms: ["spf"] },
  { label: "Liquide", type: "format", terms: ["liquid", "liquide"] },
  { label: "Crème", type: "format", terms: ["cream", "crème", "creme"] },
  { label: "Stick", type: "format", terms: ["stick"] },
  { label: "Poudre", type: "format", terms: ["powder", "poudre"] },
  { label: "Baume", type: "format", terms: ["balm", "baume"] },
  { label: "Jelly / tint", type: "format", terms: ["jelly", "tint"] },
  { label: "Huile", type: "format", terms: [" oil", "huile"] },
  { label: "Mini format", type: "format", terms: ["mini"] },
  { label: "Rose", type: "teinte", terms: ["pink", "rose ", "strawberry"] },
  { label: "Pêche", type: "teinte", terms: ["peach", "pêche"] },
  { label: "Corail", type: "teinte", terms: ["coral", "corail"] },
  { label: "Baie", type: "teinte", terms: ["berry", "baie"] },
  { label: "Prune", type: "teinte", terms: ["plum", "prune"] },
  { label: "Mauve", type: "teinte", terms: ["mauve"] },
  { label: "Terracotta", type: "teinte", terms: ["terracotta"] },
  { label: "Rouge", type: "teinte", terms: [" red", "rouge"] },
  { label: "Nude", type: "teinte", terms: ["nude"] },
  { label: "Dewy / glow", type: "finition", terms: ["dewy", "glow", "glass skin"] },
  { label: "Mat", type: "finition", terms: ["matte", " mat "] },
  { label: "Satiné", type: "finition", terms: ["satin"] },
  { label: "Gloss", type: "finition", terms: ["glossy", "gloss"] },
  { label: "Nacré", type: "finition", terms: ["shimmer", "nacré"] },
];

async function loadPosts(category: string): Promise<{ posts: string[]; source: string; fromTable: boolean }> {
  const fallback = { posts: demoPosts.posts, source: "Échantillon de démonstration (publications fictives)", fromTable: false };

  // 1. Publications déjà collectées dans Supabase
  try {
    const rows = await repo().select<TrendPostRow>("trend_posts", { order: ["posted_at", "desc"], limit: 1000 });
    const texts = rows.map((r) => `${r.caption ?? ""} ${(r.hashtags ?? []).map((h) => `#${h}`).join(" ")}`.trim()).filter(Boolean);
    const term = category.trim().toLowerCase();
    const focused = term ? texts.filter((t) => t.toLowerCase().includes(term)) : texts;
    const posts = focused.length >= 10 ? focused : texts;
    if (posts.length) return { posts, source: `Publications TikTok / Instagram enregistrées (${posts.length})`, fromTable: true };
  } catch (e) {
    console.error("trend_posts", e);
  }

  if (isDemo.hf || !config.hf.trendsDataset) return fallback;

  const params = new URLSearchParams({
    dataset: config.hf.trendsDataset,
    config: config.hf.trendsConfig,
    split: config.hf.trendsSplit,
    query: category || "blush",
    offset: "0",
    length: "100",
  });
  try {
    const res = await fetch(`https://datasets-server.huggingface.co/search?${params}`, {
      headers: { Authorization: `Bearer ${config.hf.token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as { rows?: { row: Record<string, unknown> }[] };
    // On concatène les colonnes textuelles (caption, description, hashtags…).
    const posts = (json.rows ?? [])
      .map(({ row }) =>
        Object.entries(row)
          .filter(([k, v]) => typeof v === "string" && /caption|desc|text|title|hashtag|content/i.test(k))
          .map(([, v]) => v as string)
          .join(" "),
      )
      .filter((t) => t.length > 0);
    if (!posts.length) return fallback;
    return { posts, source: `Dataset Hugging Face : ${config.hf.trendsDataset}`, fromTable: false };
  } catch (e) {
    console.error("Dataset tendances", e);
    return fallback;
  }
}

export async function computeTrends(category: string): Promise<Trends & { fromTable: boolean }> {
  const { posts, source, fromTable } = await loadPosts(category);
  const lower = posts.map((p) => ` ${p.toLowerCase()} `);

  const items: TrendItem[] = VOCAB.map((v) => {
    const mentions = lower.filter((p) => v.terms.some((t) => p.includes(t))).length;
    return { label: v.label, type: v.type, mentions, share: posts.length ? mentions / posts.length : 0 };
  })
    .filter((i) => i.mentions > 0)
    .sort((a, b) => b.mentions - a.mentions);

  const summary =
    (await chat(
      "Tu es analyste tendances beauté. Écris en français, 3 phrases maximum, factuel, sans inventer de chiffres.",
      `Catégorie : ${category}. Publications analysées : ${posts.length}. Mentions par thème (JSON) :\n` +
        JSON.stringify(items.slice(0, 12).map((i) => ({ theme: i.label, type: i.type, posts: i.mentions }))),
      250,
    )) ??
    (items.length
      ? `Sur ${posts.length} publications, les thèmes les plus cités sont ${items
          .slice(0, 3)
          .map((i) => `${i.label.toLowerCase()} (${Math.round(i.share * 100)} %)`)
          .join(", ")}.`
      : "Aucun thème récurrent détecté.");

  return { source, postsAnalyzed: posts.length, items, summary, fromTable };
}
