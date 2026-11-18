import "server-only";
import { repo } from "./repo";
import type { Site, SiteMethod } from "./site-types";
import type { Zone } from "./types";

export type { Site, SiteMethod } from "./site-types";

/** Ligne de la table sites. */
interface SiteRow {
  id: string;
  domain: string;
  name: string;
  zone: Zone;
  country: string | null;
  type: Site["type"];
  categories: string[];
  method: SiteMethod;
  cu_instructions: string | null;
  source: "catalog" | "discovered";
  last_success_at: string | null;
  created_at: string;
}

/** Sites de départ : insérés par la migration en production, et ici pour le mode démo. */
const DEFAULT_SITES: Omit<SiteRow, "id" | "created_at" | "method" | "cu_instructions" | "source" | "last_success_at">[] = [
  { domain: "sephora.com", name: "Sephora US", zone: "US", country: "États-Unis", type: "revendeur", categories: ["maquillage", "soin", "parfum"] },
  { domain: "ulta.com", name: "Ulta Beauty", zone: "US", country: "États-Unis", type: "revendeur", categories: ["maquillage", "soin"] },
  { domain: "nordstrom.com", name: "Nordstrom", zone: "US", country: "États-Unis", type: "revendeur", categories: ["maquillage", "soin", "parfum"] },
  { domain: "sephora.fr", name: "Sephora France", zone: "EU", country: "France", type: "revendeur", categories: ["maquillage", "soin", "parfum"] },
  { domain: "douglas.de", name: "Douglas", zone: "EU", country: "Allemagne", type: "revendeur", categories: ["maquillage", "soin", "parfum"] },
  { domain: "notino.fr", name: "Notino", zone: "EU", country: "France", type: "revendeur", categories: ["maquillage", "soin", "parfum"] },
  { domain: "lookfantastic.fr", name: "Lookfantastic", zone: "EU", country: "France", type: "revendeur", categories: ["maquillage", "soin"] },
  { domain: "boots.com", name: "Boots", zone: "EU", country: "Royaume-Uni", type: "revendeur", categories: ["maquillage", "soin"] },
];

function toSite(r: SiteRow): Site {
  return {
    id: r.id,
    domain: r.domain,
    name: r.name,
    zone: r.zone,
    country: r.country ?? "",
    type: r.type,
    categories: r.categories ?? [],
    method: r.method,
    cuInstructions: r.cu_instructions ?? undefined,
    source: r.source,
    lastSuccessAt: r.last_success_at,
  };
}

export async function listSites(): Promise<Site[]> {
  const db = repo();
  let rows = await db.select<SiteRow>("sites", { order: ["created_at", "asc"], limit: 1000 });
  if (!rows.length) {
    // Mode démo, ou table vide : on part des sites de départ.
    rows = await db.insert<SiteRow>("sites", DEFAULT_SITES);
  }
  return rows.map(toSite);
}

function sameSite(domain: string, siteDomain: string) {
  return domain === siteDomain || domain.endsWith(`.${siteDomain}`);
}

export async function siteByDomain(domain: string | null | undefined): Promise<Site | null> {
  if (!domain) return null;
  return (await listSites()).find((s) => sameSite(domain, s.domain)) ?? null;
}

/** Sites utilisables pour une zone, filtrés par la sélection de l'utilisateur (domaines). */
export async function sitesFor(zone: Zone, selected: string[]): Promise<Site[]> {
  const usable = (await listSites()).filter((s) => s.zone === zone && s.method !== "blocked");
  const chosen = selected.length ? usable.filter((s) => selected.includes(s.domain)) : usable;
  return chosen.length ? chosen : usable;
}

const COUNTRY_BY_TLD: Record<string, string> = {
  fr: "France", de: "Allemagne", it: "Italie", es: "Espagne", uk: "Royaume-Uni", nl: "Pays-Bas", be: "Belgique", com: "",
};

/**
 * Site rencontré pendant une analyse : ajouté à la liste s'il n'y est pas (source « discovered »).
 * Méthode « untested » jusqu'à une première collecte réussie.
 */
export async function ensureSite(domain: string | null | undefined, zone: Zone): Promise<Site | null> {
  if (!domain || domain === "inconnu") return null;
  const known = await siteByDomain(domain);
  if (known) return known;
  const clean = domain.replace(/^www\./, "");
  const tld = clean.split(".").pop() ?? "";
  try {
    const [row] = await repo().insert<SiteRow>("sites", [
      {
        domain: clean,
        name: clean,
        zone,
        country: COUNTRY_BY_TLD[tld] || (zone === "US" ? "États-Unis" : null),
        type: "revendeur",
        categories: [],
        source: "discovered",
      },
    ]);
    return toSite(row);
  } catch {
    // Ajouté en parallèle par une autre étape (contrainte unique sur domain).
    return siteByDomain(clean);
  }
}

/** Collecte réussie sur un site : date du dernier succès, et méthode apprise si le site n'était pas testé. */
export async function recordSuccess(domain: string | null | undefined, method: string | null) {
  const site = await siteByDomain(domain);
  if (!site) return;
  const patch: Record<string, unknown> = { last_success_at: new Date().toISOString() };
  if (site.method === "untested" && (method === "scraping" || method === "linkup")) patch.method = method;
  await repo().update("sites", site.id, patch);
}

export async function updateSite(id: string, patch: Partial<Pick<SiteRow, "name" | "zone" | "country" | "type" | "categories" | "method" | "cu_instructions">>) {
  await repo().update("sites", id, patch);
}

export async function addSite(input: Pick<SiteRow, "domain" | "name" | "zone" | "country" | "type" | "categories">) {
  const [row] = await repo().insert<SiteRow>("sites", [{ ...input, source: "catalog" }]);
  return toSite(row);
}
