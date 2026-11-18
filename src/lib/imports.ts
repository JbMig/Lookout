import "server-only";
import { repo } from "./repo";
import { normalize } from "./matching";
import type { CatalogProductRow, CircanaImportRow, CircanaRow, CircanaSaleRow, ClientProduct } from "./types";
import type { RawRow } from "./tabular";

/* =======================================================================
   Enregistrement des fichiers importés dans les tables existantes :
   circana_imports / circana_sales et catalog_products.
   ======================================================================= */

/** Convertit une période Circana (2026-Q3, 2026-07, 07/2026, date ISO…) en date. */
export function periodToDate(label: string | undefined, fallback = new Date()): string {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (!label) return iso(fallback);
  const s = label.trim();
  let m = s.match(/^(\d{4})\s*[-/ ]?\s*Q([1-4])$/i) ?? s.match(/^Q([1-4])\s*[-/ ]?\s*(\d{4})$/i);
  if (m) {
    const [year, q] = /^\d{4}/.test(s) ? [Number(m[1]), Number(m[2])] : [Number(m[2]), Number(m[1])];
    return `${year}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`;
  }
  m = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-01`;
  m = s.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{4})$/);
  if (m) return `${m[1]}-01-01`;
  // Années fiscales ou cumuls : « FY 2025 », « CY2024 », « YTD 2025 », « MAT 2025 »
  m = s.match(/^(?:FY|CY|YTD|MAT)\s*(\d{4})$/i);
  if (m) return `${m[1]}-01-01`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? iso(fallback) : iso(d);
}

/** Enregistre l'import Circana (lignes d'origine, une par période) et renvoie son identifiant. */
export async function saveCircanaImport(fileName: string, rows: CircanaRow[], userId: string, storagePath: string | null) {
  const db = repo();
  const flat = rows.flatMap((r) =>
    r.history?.length
      ? r.history.map((h) => ({ ...r, period: h.period, salesValue: h.salesValue, units: h.units }))
      : [r],
  );
  const dates = flat.map((r) => periodToDate(r.period));
  const [imp] = await db.insert<CircanaImportRow>("circana_imports", [
    {
      filename: fileName,
      storage_path: storagePath,
      status: "processing",
      period_start: dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null,
      period_end: dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null,
      row_count: flat.length,
      created_by: userId,
    },
  ]);
  try {
    const sales = flat.map((r, i) => ({
      import_id: imp.id,
      period: dates[i],
      region: r.zone,
      brand: r.brand,
      product_name: r.product,
      units: r.units ?? null,
      revenue: r.salesValue ?? null,
      avg_price: r.avgPrice ?? null,
      currency: r.currency ?? "USD",
      product_key: normalize(`${r.brand} ${r.product} ${r.zone}`),
      segment: r.segment ?? null,
      raw: { period_label: r.period ?? null, shades: r.shades ?? undefined },
    }));
    for (let i = 0; i < sales.length; i += 500) await db.insert<CircanaSaleRow>("circana_sales", sales.slice(i, i + 500));
    await db.update("circana_imports", imp.id, { status: "completed" });
  } catch (e) {
    await db.update("circana_imports", imp.id, { status: "failed", error_message: (e as Error).message });
    throw e;
  }
  return imp.id;
}

const STATUS: [RegExp, CatalogProductRow["status"]][] = [
  [/arr[eê]t|discontinu|stop|fin de vie|retir/i, "discontinued"],
  [/lancement|launch|coming|bient[oô]t|nouveau|new/i, "coming_soon"],
];

/** Met à jour le catalogue du client (catalog_products) et renvoie les identifiants concernés. */
export async function upsertCatalog(products: ClientProduct[], category: string): Promise<string[]> {
  const db = repo();
  const existing = await db.select<CatalogProductRow>("catalog_products", { limit: 5000 });
  const ids: string[] = [];
  for (const p of products) {
    const match =
      (p.sku && existing.find((e) => e.sku === p.sku)) ||
      existing.find((e) => normalize(`${e.brand ?? ""} ${e.name}`) === normalize(`${p.brand} ${p.name}`));
    const fields = {
      sku: p.sku ?? match?.sku ?? null,
      name: p.name,
      brand: p.brand,
      category: category || match?.category || null,
      format: p.format ?? null,
      status: STATUS.find(([re]) => p.status && re.test(p.status))?.[1] ?? "active",
      price: p.price ?? null,
      currency: p.currency ?? (p.zone === "US" ? "USD" : "EUR"),
      attributes: { ...(match?.attributes ?? {}), zone: p.zone, shadesCount: p.shadesCount, salesValue: p.salesValue, statusLabel: p.status },
    };
    if (match) {
      await db.update("catalog_products", match.id, fields);
      ids.push(match.id);
    } else {
      const [row] = await db.insert<CatalogProductRow>("catalog_products", [fields]);
      existing.push(row);
      ids.push(row.id);
    }
  }
  return [...new Set(ids)];
}

export function toClientProduct(r: CatalogProductRow): ClientProduct {
  return {
    sku: r.sku ?? undefined,
    name: r.name,
    brand: r.brand ?? "",
    zone: r.attributes?.zone,
    price: r.price ?? undefined,
    currency: r.currency,
    shadesCount: r.attributes?.shadesCount,
    format: r.format ?? undefined,
    status: r.attributes?.statusLabel ?? { active: "Actif", discontinued: "Arrêté", coming_soon: "Lancement" }[r.status],
    salesValue: r.attributes?.salesValue,
  };
}

export type { RawRow };
