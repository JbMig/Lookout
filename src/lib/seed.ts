import "server-only";
import { isDemo } from "./config";
import { repo } from "./repo";
import type { SiteRow } from "./types";

/** Catalogue de départ (le même que dans supabase/schema.sql). */
export const SEED_SITES: Partial<SiteRow>[] = [
  { domain: "sephora.com", name: "Sephora US", zone: "US", country: "États-Unis", type: "revendeur", categories: ["maquillage", "soin", "parfum"] },
  { domain: "ulta.com", name: "Ulta Beauty", zone: "US", country: "États-Unis", type: "revendeur", categories: ["maquillage", "soin"] },
  { domain: "nordstrom.com", name: "Nordstrom", zone: "US", country: "États-Unis", type: "revendeur", categories: ["maquillage", "soin", "parfum"] },
  { domain: "sephora.fr", name: "Sephora France", zone: "EU", country: "France", type: "revendeur", categories: ["maquillage", "soin", "parfum"] },
  { domain: "douglas.de", name: "Douglas", zone: "EU", country: "Allemagne", type: "revendeur", categories: ["maquillage", "soin", "parfum"] },
  { domain: "notino.fr", name: "Notino", zone: "EU", country: "France", type: "revendeur", categories: ["maquillage", "soin", "parfum"] },
  { domain: "lookfantastic.fr", name: "Lookfantastic", zone: "EU", country: "France", type: "revendeur", categories: ["maquillage", "soin"] },
  { domain: "boots.com", name: "Boots", zone: "EU", country: "Royaume-Uni", type: "revendeur", categories: ["maquillage", "soin"] },
];

let seeded = false;
/** En mode démo, remplit le catalogue au premier accès (Supabase : fait par schema.sql). */
export async function ensureSeed() {
  if (seeded || !isDemo.db) return;
  const sites = await repo().select<SiteRow>("sites", { limit: 1 });
  if (!sites.length) await repo().insert<SiteRow>("sites", SEED_SITES.map((s) => ({ ...s, status: "untested" as const })));
  seeded = true;
}
