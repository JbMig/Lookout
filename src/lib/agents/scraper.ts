import * as cheerio from "cheerio";
import type { ProductSheet } from "../types";

/**
 * Étape 2 : scraping direct de la page produit.
 * 1. Données structurées schema.org (JSON-LD), présentes sur beaucoup de sites marchands.
 * 2. Heuristiques HTML pour la composition INCI et les contenances.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 LookoutBot/1.0";

type Json = Record<string, unknown>;

function asArray<T>(v: T | T[] | undefined | null): T[] {
  return v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];
}

function findProducts(node: unknown, out: Json[] = []): Json[] {
  if (Array.isArray(node)) node.forEach((n) => findProducts(n, out));
  else if (node && typeof node === "object") {
    const o = node as Json;
    const type = asArray(o["@type"] as string | string[]).map((t) => String(t).toLowerCase());
    if (type.includes("product") || type.includes("productgroup")) out.push(o);
    if (o["@graph"]) findProducts(o["@graph"], out);
  }
  return out;
}

const SIZE_RE = /\b(\d+(?:[.,]\d+)?)\s?(ml|g|gr|oz|fl\.?\s?oz)\b/gi;

export function parseProductHtml(html: string, url: string): ProductSheet | null {
  const $ = cheerio.load(html);
  const products: Json[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      findProducts(JSON.parse($(el).contents().text()), products);
    } catch {
      /* JSON-LD invalide : ignoré */
    }
  });
  const p = products[0];

  const name = (p?.name as string) || $('meta[property="og:title"]').attr("content") || $("h1").first().text().trim() || "";
  const brandRaw = p?.brand as string | Json | undefined;
  const brand = typeof brandRaw === "string" ? brandRaw : ((brandRaw?.name as string) ?? "");

  const variants = asArray(p?.hasVariant as Json | Json[]);
  const offers = [...asArray(p?.offers as Json | Json[]), ...variants.flatMap((v) => asArray(v.offers as Json | Json[]))];
  const flatOffers = offers.flatMap((o) => (o["@type"] === "AggregateOffer" ? [{ price: o.lowPrice, priceCurrency: o.priceCurrency }, ...asArray(o.offers as Json[])] : [o]));
  const priced = flatOffers.find((o) => o.price !== undefined && o.price !== "");
  const price = priced ? Number(String(priced.price).replace(",", ".")) : null;
  const currency = (priced?.priceCurrency as string) ?? $('meta[property="product:price:currency"]').attr("content") ?? null;

  const imageRaw = asArray(p?.image as string | Json | (string | Json)[])[0];
  const imageUrl =
    (typeof imageRaw === "string" ? imageRaw : (imageRaw?.url as string)) || $('meta[property="og:image"]').attr("content") || null;

  // Teintes : variantes (couleur ou nom) puis sélecteurs fréquents.
  const shades = new Map<string, string | undefined>();
  for (const v of variants) {
    const n = (v.color as string) || (v.name as string);
    if (n && n !== name) shades.set(n.replace(name, "").replace(/^[\s\-–|]+/, "").trim() || n, undefined);
  }
  $("[data-shade-name], [data-color-name], [aria-label*='shade' i], [aria-label*='teinte' i]").each((_, el) => {
    const n = $(el).attr("data-shade-name") || $(el).attr("data-color-name") || $(el).attr("aria-label");
    const style = $(el).attr("style") ?? "";
    const hex = style.match(/#[0-9a-f]{6}\b/i)?.[0];
    if (n && n.length < 60) shades.set(n.trim(), hex);
  });

  // Composition : bloc qui suit un titre « Ingrédients / Ingredients / INCI ».
  let ingredients: string | null = null;
  $("h2, h3, h4, button, summary, dt, strong, span, div").each((_, el) => {
    if (ingredients) return;
    const t = $(el).clone().children().remove().end().text().trim();
    if (/^(ingr[ée]dients?|inci|composition|full ingredients)\s*:?$/i.test(t)) {
      const candidate = ($(el).next().text() || $(el).parent().next().text() || $(el).parent().text().replace(t, "")).trim();
      if (candidate.split(",").length >= 5) ingredients = candidate.replace(/\s+/g, " ").slice(0, 3000);
    }
  });
  if (!ingredients) {
    const text = $("body").text().replace(/\s+/g, " ");
    const m = text.match(/(?:ingr[ée]dients?|inci)\s*:?\s*((?:aqua|water|dimethicone|talc|mica|isododecane|glycerin|squalane)[^.]{40,2500})/i);
    if (m) ingredients = m[1].trim();
  }

  const description = `${name} ${(p?.description as string) ?? ""} ${variants.map((v) => v.name ?? "").join(" ")}`;
  const sizes = [...new Set([...description.matchAll(SIZE_RE)].map((m) => `${m[1].replace(",", ".")} ${m[2].toLowerCase().replace(/\s/g, " ")}`))];

  if (!name && price === null) return null;
  return {
    name,
    brand,
    price: Number.isFinite(price as number) ? price : null,
    currency: currency ? currency.toUpperCase() : null,
    priceEur: null,
    ingredients,
    formats: sizes.map((size) => ({ size, price: price ?? undefined, currency: currency ?? undefined })),
    shades: [...shades.entries()].slice(0, 80).map(([n, hex]) => ({ name: n, hex })),
    packaging: null,
    imageUrl,
    sourceUrl: url,
  };
}

export async function scrape(url: string): Promise<ProductSheet | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("html")) throw new Error(`Contenu inattendu (${type})`);
  return parseProductHtml(await res.text(), url);
}
