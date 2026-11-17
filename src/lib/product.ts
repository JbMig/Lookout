import { z } from "zod";
import type { ProductSheet } from "./types";

/** Schéma JSON envoyé à Linkup et à H Company pour obtenir une fiche structurée. */
export const PRODUCT_JSON_SCHEMA = {
  type: "object",
  properties: {
    found: { type: "boolean", description: "true si la page produit officielle a été trouvée" },
    name: { type: "string", description: "Nom exact du produit sur la page" },
    brand: { type: "string" },
    price: { type: "number", description: "Prix affiché du format principal, sans symbole" },
    currency: { type: "string", description: "Code ISO de la devise, ex. USD, EUR, GBP" },
    ingredients: { type: "string", description: "Liste INCI complète, telle qu'affichée" },
    formats: {
      type: "array",
      items: {
        type: "object",
        properties: {
          size: { type: "string", description: "Contenance, ex. 7.5 ml, 4.5 g, mini" },
          price: { type: "number" },
        },
        required: ["size"],
      },
    },
    shades: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          hex: { type: "string", description: "Couleur hexadécimale si disponible" },
        },
        required: ["name"],
      },
    },
    packaging: { type: "string", description: "Type de packaging : stick, tube, boîtier poudre…" },
    image_url: { type: "string", description: "URL de l'image principale (packshot)" },
    source_url: { type: "string", description: "URL de la page produit" },
  },
  required: ["found"],
} as const;

const RawSchema = z.object({
  found: z.boolean().optional(),
  name: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  price: z.coerce.number().optional().nullable(),
  currency: z.string().optional().nullable(),
  ingredients: z.string().optional().nullable(),
  formats: z
    .array(z.object({ size: z.string(), price: z.coerce.number().optional().nullable() }))
    .optional()
    .nullable(),
  shades: z
    .array(z.object({ name: z.string(), hex: z.string().optional().nullable() }))
    .optional()
    .nullable(),
  packaging: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  source_url: z.string().optional().nullable(),
});

/** Transforme la réponse brute d'un agent en fiche produit typée. */
export function toProductSheet(raw: unknown, fallback: { brand: string; name: string }): ProductSheet | null {
  let value = raw;
  if (typeof value === "string") {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      value = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
  const parsed = RawSchema.safeParse(value);
  if (!parsed.success) return null;
  const r = parsed.data;
  if (r.found === false) return null;
  const currency = r.currency?.toUpperCase().slice(0, 3) ?? null;
  return {
    name: r.name || fallback.name,
    brand: r.brand || fallback.brand,
    price: r.price ?? null,
    currency,
    priceEur: null,
    ingredients: r.ingredients?.trim() || null,
    formats: (r.formats ?? []).map((f) => ({ size: f.size, price: f.price ?? undefined, currency: currency ?? undefined })),
    shades: (r.shades ?? []).map((s) => ({ name: s.name, hex: normalizeHex(s.hex) })),
    packaging: r.packaging || null,
    imageUrl: isHttpUrl(r.image_url) ? r.image_url! : null,
    sourceUrl: isHttpUrl(r.source_url) ? r.source_url! : null,
  };
}

/** Les cinq champs exigés pour qu'une fiche soit considérée complète. */
export function missingFields(p: ProductSheet | null): string[] {
  if (!p) return ["fiche"];
  const missing: string[] = [];
  if (!p.name) missing.push("nom");
  if (!p.brand) missing.push("marque");
  if (p.price === null) missing.push("prix");
  if (!p.ingredients) missing.push("composition");
  if (!p.formats.length) missing.push("formats");
  return missing;
}

/** Fusionne deux fiches : les champs vides de la première sont complétés par la seconde. */
export function mergeSheets(a: ProductSheet | null, b: ProductSheet | null): ProductSheet | null {
  if (!a) return b;
  if (!b) return a;
  return {
    name: a.name || b.name,
    brand: a.brand || b.brand,
    price: a.price ?? b.price,
    currency: a.currency ?? b.currency,
    priceEur: null,
    ingredients: a.ingredients || b.ingredients,
    formats: a.formats.length ? a.formats : b.formats,
    shades: a.shades.length >= b.shades.length ? a.shades : b.shades,
    packaging: a.packaging || b.packaging,
    imageUrl: a.imageUrl || b.imageUrl,
    sourceUrl: a.sourceUrl || b.sourceUrl,
  };
}

function isHttpUrl(v: string | null | undefined) {
  return !!v && /^https?:\/\//i.test(v);
}

function normalizeHex(v: string | null | undefined) {
  if (!v) return undefined;
  const m = v.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  return m ? `#${m[1]}` : undefined;
}
