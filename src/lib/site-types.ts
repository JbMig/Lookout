import type { Zone } from "./types";

/** Types des sites surveillés, partagés entre le serveur et les pages. */
export type SiteMethod =
  | "untested" // jamais testé : la collecte essaie scraping puis Linkup
  | "scraping" // scraping direct fiable
  | "linkup" // Linkup suffit
  | "computer_use" // parcours H Company enregistré : lancé automatiquement
  | "blocked"; // inexploitable, ignoré

export interface Site {
  id: string;
  domain: string;
  name: string;
  zone: Zone;
  country: string;
  type: "revendeur" | "marque" | "marketplace";
  categories: string[];
  method: SiteMethod;
  /** Étapes de navigation pour H Company (en anglais), utilisées si method = "computer_use". */
  cuInstructions?: string;
  /** « catalog » : ajouté par l'équipe ; « discovered » : rencontré pendant une analyse. */
  source: "catalog" | "discovered";
  lastSuccessAt: string | null;
}
