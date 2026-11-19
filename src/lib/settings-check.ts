/** Réglages indispensables avant de lancer un agent qui s'en sert (tous sauf l'import Circana). */
export interface SettingsLike { brand: string; zone: string; category: string; formats: string[]; startUrl: string }

export function missingSettings(c: SettingsLike | null | undefined): string[] {
  if (!c) return ["la marque", "la zone", "la catégorie", "les formats connus", "l'URL de départ"];
  return [
    !c.brand?.trim() && "la marque",
    !c.zone && "la zone",
    !c.category?.trim() && "la catégorie",
    !c.formats?.length && "les formats connus",
    !c.startUrl?.trim() && "l'URL de départ",
  ].filter(Boolean) as string[];
}

/** Agents qui ont besoin des réglages. */
export const NEEDS_SETTINGS = ["0", "2", "2.5", "3", "4"];
