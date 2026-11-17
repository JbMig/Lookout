import type { Zone } from "./types";

/**
 * Catalogue des sites surveillés.
 * Le schéma Supabase n'a pas de table de sites : le catalogue est versionné ici,
 * dans le code. Pour ajouter un site ou enregistrer un parcours de computer use,
 * modifiez ce fichier et ouvrez une pull request.
 */
export type SiteMethod =
  | "untested" // jamais testé : la collecte essaie scraping puis Linkup
  | "scraping" // scraping direct fiable
  | "linkup" // Linkup suffit
  | "computer_use" // parcours H Company enregistré : lancé automatiquement
  | "blocked"; // inexploitable, ignoré

export interface Site {
  domain: string;
  name: string;
  zone: Zone;
  country: string;
  type: "revendeur" | "marque" | "marketplace";
  categories: string[];
  method: SiteMethod;
  /** Étapes de navigation pour H Company (en anglais), utilisées si method = "computer_use". */
  cuInstructions?: string;
}

export const SITES: Site[] = [
  { domain: "sephora.com", name: "Sephora US", zone: "US", country: "États-Unis", type: "revendeur", categories: ["maquillage", "soin", "parfum"], method: "untested" },
  { domain: "ulta.com", name: "Ulta Beauty", zone: "US", country: "États-Unis", type: "revendeur", categories: ["maquillage", "soin"], method: "untested" },
  { domain: "nordstrom.com", name: "Nordstrom", zone: "US", country: "États-Unis", type: "revendeur", categories: ["maquillage", "soin", "parfum"], method: "untested" },
  { domain: "sephora.fr", name: "Sephora France", zone: "EU", country: "France", type: "revendeur", categories: ["maquillage", "soin", "parfum"], method: "untested" },
  { domain: "douglas.de", name: "Douglas", zone: "EU", country: "Allemagne", type: "revendeur", categories: ["maquillage", "soin", "parfum"], method: "untested" },
  { domain: "notino.fr", name: "Notino", zone: "EU", country: "France", type: "revendeur", categories: ["maquillage", "soin", "parfum"], method: "untested" },
  { domain: "lookfantastic.fr", name: "Lookfantastic", zone: "EU", country: "France", type: "revendeur", categories: ["maquillage", "soin"], method: "untested" },
  { domain: "boots.com", name: "Boots", zone: "EU", country: "Royaume-Uni", type: "revendeur", categories: ["maquillage", "soin"], method: "untested" },
];

export function siteByDomain(domain: string | null | undefined): Site | null {
  if (!domain) return null;
  return SITES.find((s) => domain === s.domain || domain.endsWith(`.${s.domain}`)) ?? null;
}

/** Sites utilisables pour une zone, filtrés par la sélection de l'utilisateur (domaines). */
export function sitesFor(zone: Zone, selected: string[]): Site[] {
  const usable = SITES.filter((s) => s.zone === zone && s.method !== "blocked");
  const chosen = selected.length ? usable.filter((s) => selected.includes(s.domain)) : usable;
  return chosen.length ? chosen : usable;
}
