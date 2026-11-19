import "server-only";
import { repo, selectAll } from "./repo";
import { getAgentConfig } from "./settings";
import { RADAR_TEMPLATE } from "./radar-template";
import { loadSkuSales } from "./circana";

/**
 * Dashboard « Market Radar » : le gabarit HTML fourni, rempli avec les données Lookout lues dans Supabase
 * au moment de l'affichage (ventes Circana de l'Agent 1, fiches, teintes et INCI des Agents 2 et 2.5).
 */

type Raw = Record<string, unknown>;

const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

export async function radarHtml(): Promise<string> {
  const cfg = await getAgentConfig();
  const [skuTables, imports, salesAll, products, shades, ingredients, synthesis] = await Promise.all([
    loadSkuSales(cfg.category || "blush"),
    repo().select<Raw>("circana_imports", { eq: { status: "completed" }, order: ["created_at", "desc"], limit: 50 }),
    selectAll<Raw>("circana_sales", { order: ["id", "asc"] }),
    selectAll<Raw>("market_products", { order: ["id", "asc"] }),
    selectAll<Raw>("market_shades", { order: ["id", "asc"] }),
    selectAll<Raw>("market_ingredients", { order: ["id", "asc"] }),
    repo().select<Raw>("analyses", { eq: { type: "dashboard_synthesis" }, order: ["completed_at", "desc"], limit: 5 }),
  ]);

  // Le gabarit lit les Top 50 SKU (lignes « sku » de l'Agent 1) : on prend l'import le plus récent qui en contient.
  const sku = salesAll.filter((s) => ((s.raw ?? {}) as Raw).niveau === "sku");
  const importId = imports.map((i) => i.id).find((id) => sku.some((s) => s.import_id === id)) ?? sku[0]?.import_id;
  // Source principale : les tables Top 50 SKU de l'Agent 1 ; à défaut, les lignes « sku » de circana_sales.
  const sales = skuTables.length
    ? skuTables.map((s) => ({ period: s.period, country: s.country, brand: s.brand, product_name: s.product_name, segment: s.segment, subsegment: s.subsegment, revenue: s.revenue, raw: s.raw }))
    : sku
        .filter((s) => s.import_id === importId)
        .map((s) => ({ period: s.period, country: s.country, brand: s.brand, product_name: s.product_name, segment: s.segment, subsegment: s.subsegment, revenue: s.revenue, raw: s.raw }));

  const snapshot = {
    generated_at: new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", ""),
    sales,
    products: products.map((p) => ({ id: p.id, brand: p.brand, name: p.name, category: p.category, country: p.country, currency: p.currency, price: p.price, shade_count: p.shade_count, source_site: p.source_site, product_url: p.product_url })),
    shades: shades.map((s) => ({ product_id: s.product_id, shade_name: s.shade_name, hex_code: s.hex_code, family: s.family })),
    ingredients: ingredients.map((i) => ({ product_id: i.product_id, inci_name: i.inci_name, position: i.position, is_key_ingredient: i.is_key_ingredient })),
    synthesis: synthesis.map((a) => ({ id: a.id, type: a.type, params: a.params, result: a.result, completed_at: a.completed_at })),
  };

  const key = (cfg.category || "blush").toLowerCase();
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  const title = `${label} Market Radar`;
  return RADAR_TEMPLATE
    .replace("__LOOKOUT_SNAPSHOT__", () => json(snapshot))
    .replace("__LOOKOUT_CATS__", () => json([{ key, label }]))
    .replace("__LOOKOUT_TITLE__", () => json(title))
    .replace("__LOOKOUT_TITLE_TEXT__", () => title.replace(/[<&]/g, ""));
}

export function htmlResponse(html: string, download?: string | null) {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      ...(download ? { "Content-Disposition": `attachment; filename="${download}"` } : {}),
    },
  });
}
