import { config, isDemo } from "../config";
import type { CircanaRow } from "../types";

/**
 * Étape 1 : découverte. Linkup cherche l'URL de la page produit,
 * uniquement sur les domaines du catalogue retenus pour la zone.
 */
export async function discoverUrl(row: CircanaRow, domains: string[]): Promise<string | null> {
  if (!domains.length) return null;
  if (isDemo.linkup) {
    const d = domains[0];
    return `https://www.${d}/search?q=${encodeURIComponent(`${row.brand} ${row.product}`)}`;
  }
  const res = await fetch("https://api.linkup.so/v1/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.linkup.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      q: `${row.brand} ${row.product} product page`,
      depth: "standard",
      outputType: "searchResults",
      includeDomains: domains,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Linkup ${res.status} : ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const json = (await res.json()) as { results?: { url?: string; name?: string }[] };
  const words = `${row.brand} ${row.product}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const candidates = (json.results ?? [])
    .map((r) => r.url ?? "")
    .filter((u) => /^https?:\/\//.test(u))
    .filter((u) => domains.some((d) => new URL(u).hostname.endsWith(d)))
    .filter((u) => !/search|recherche|suche|\/c\/|category|categor/i.test(new URL(u).pathname));
  // On privilégie l'URL qui contient le plus de mots du nom du produit.
  const score = (u: string) => words.filter((w) => u.toLowerCase().includes(w)).length;
  return candidates.sort((a, b) => score(b) - score(a))[0] ?? null;
}

export function domainOf(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
