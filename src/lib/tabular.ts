import Papa from "papaparse";
import type { CircanaRow, ClientProduct, Zone } from "./types";

/* =======================================================================
   Lecture des fichiers importés (CSV, Excel, JSON) et correspondance
   des colonnes vers les champs attendus.
   ======================================================================= */

export type RawRow = Record<string, string>;
export interface ParsedTable {
  headers: string[];
  rows: RawRow[];
}

export const MAX_IMPORT_ROWS = 5000;

export function parseCsv(text: string): ParsedTable {
  const p = Papa.parse<RawRow>(text.replace(/^﻿/, "").trim(), { header: true, skipEmptyLines: true });
  return { headers: (p.meta.fields ?? []).filter(Boolean), rows: p.data.slice(0, MAX_IMPORT_ROWS) };
}

export function parseJson(text: string): ParsedTable {
  const data = JSON.parse(text) as unknown;
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? (Object.values(data as Record<string, unknown>).find(Array.isArray) as unknown[] | undefined) ?? []
      : [];
  const rows = (list as Record<string, unknown>[])
    .filter((r) => r && typeof r === "object")
    .slice(0, MAX_IMPORT_ROWS)
    .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)])));
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return { headers, rows };
}

/* ---------- Champs attendus ---------- */

export interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

export const CIRCANA_FIELDS: FieldDef[] = [
  { key: "brand", label: "Marque", required: true, aliases: ["brand", "marque", "manufacturer brand", "brand name"] },
  { key: "product", label: "Produit", required: true, aliases: ["product", "produit", "item", "item description", "sku", "description", "product name"] },
  { key: "zone", label: "Zone / marché", aliases: ["market", "zone", "region", "région", "geography", "country", "pays"] },
  { key: "period", label: "Période", aliases: ["period", "période", "periode", "time period", "date", "quarter"] },
  { key: "salesValue", label: "Ventes (valeur)", aliases: ["dollar sales", "sales", "ventes", "sales value", "value sales", "ca", "chiffre d'affaires"] },
  { key: "units", label: "Unités", aliases: ["units", "unités", "unites", "unit sales", "volume"] },
  { key: "avgPrice", label: "Prix moyen", aliases: ["avg price", "average price", "prix moyen", "avg unit price", "price", "prix"] },
  { key: "currency", label: "Devise", aliases: ["currency", "devise"] },
  { key: "segment", label: "Segment / format", aliases: ["segment", "format", "sous-catégorie", "subcategory", "category", "catégorie"] },
  { key: "shade", label: "Teinte", aliases: ["teinte", "shade", "nuance", "colour", "color"] },
];

export const CATALOG_FIELDS: FieldDef[] = [
  { key: "sku", label: "Référence (SKU)", aliases: ["sku", "ref", "référence", "reference", "ean", "code", "code article"] },
  { key: "name", label: "Nom du produit", required: true, aliases: ["name", "nom", "product", "produit", "product name", "nom du produit", "item"] },
  { key: "brand", label: "Marque", required: true, aliases: ["brand", "marque"] },
  { key: "zone", label: "Zone", aliases: ["zone", "market", "region", "région", "pays", "country"] },
  { key: "price", label: "Prix", aliases: ["price", "prix", "prix public", "rrp", "msrp", "pvc"] },
  { key: "currency", label: "Devise", aliases: ["currency", "devise"] },
  { key: "shadesCount", label: "Nombre de teintes", aliases: ["shades", "teintes", "nb teintes", "shade count", "nombre de teintes"] },
  { key: "format", label: "Format", aliases: ["format", "size", "contenance", "taille"] },
  { key: "status", label: "Statut", aliases: ["status", "statut", "lifecycle", "cycle de vie"] },
  { key: "salesValue", label: "Ventes", aliases: ["sales", "ventes", "ca", "revenue", "chiffre d'affaires"] },
];

export type Mapping = Record<string, string | null>; // champ -> nom de colonne

export function suggestMapping(headers: string[], fields: FieldDef[]): Mapping {
  const norm = (s: string) => s.trim().toLowerCase();
  return Object.fromEntries(
    fields.map((f) => [f.key, headers.find((h) => f.aliases.includes(norm(h))) ?? headers.find((h) => f.aliases.some((a) => norm(h).includes(a))) ?? null]),
  );
}

export function missingRequired(mapping: Mapping, fields: FieldDef[]) {
  return fields.filter((f) => f.required && !mapping[f.key]).map((f) => f.label);
}

/* ---------- Conversion ---------- */

const US = ["us", "usa", "united states", "états-unis", "etats-unis", "north america", "amérique du nord"];
export function toZone(v: string | undefined): Zone {
  return v && US.includes(v.trim().toLowerCase()) ? "US" : v ? "EU" : "US";
}

export function toNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  let s = String(v).replace(/[^\d.,-]/g, "");
  const commas = (s.match(/,/g) ?? []).length;
  if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, ""); // 1,234.56
  else if (commas > 1 || /^-?\d{1,3},\d{3}$/.test(s)) s = s.replace(/,/g, ""); // 2,460,000 ou 1,500
  else s = s.replace(",", "."); // 29,50
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

const pick = (r: RawRow, m: Mapping, key: string) => (m[key] ? r[m[key]!]?.trim() : undefined);

const add = (a?: number, b?: number) => (a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0));

/**
 * Une ligne par produit et par zone. Les périodes multiples sont regroupées dans `history` ;
 * plusieurs lignes d'une même période (une par teinte, par exemple) sont additionnées.
 */
export function toCircanaRows(rows: RawRow[], m: Mapping): CircanaRow[] {
  const flat = rows
    .map((r) => ({
      brand: pick(r, m, "brand") ?? "",
      product: pick(r, m, "product") ?? "",
      zone: toZone(pick(r, m, "zone")),
      period: pick(r, m, "period") || undefined,
      salesValue: toNumber(pick(r, m, "salesValue")),
      units: toNumber(pick(r, m, "units")),
      avgPrice: toNumber(pick(r, m, "avgPrice")),
      currency: pick(r, m, "currency")?.toUpperCase() || undefined,
      segment: pick(r, m, "segment") || undefined,
      shade: pick(r, m, "shade") || undefined,
    }))
    .filter((r) => r.brand && r.product);

  const groups = new Map<string, typeof flat>();
  for (const r of flat) {
    const key = `${r.brand.toLowerCase()}|${r.product.toLowerCase()}|${r.zone}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()].map((list) => {
    // Agrégation par période
    const byPeriod = new Map<string, { period: string; salesValue?: number; units?: number; avgPrice?: number }>();
    for (const x of list) {
      const p = x.period ?? "";
      const cur = byPeriod.get(p);
      byPeriod.set(p, cur ? { ...cur, salesValue: add(cur.salesValue, x.salesValue), units: add(cur.units, x.units) } : { period: p, salesValue: x.salesValue, units: x.units, avgPrice: x.avgPrice });
    }
    const periods = [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
    const latest = periods[periods.length - 1];
    const first = list[0];
    const shades = [...new Set(list.map((x) => x.shade).filter(Boolean) as string[])];
    const row: CircanaRow = {
      brand: first.brand,
      product: first.product,
      zone: first.zone,
      period: latest.period || undefined,
      salesValue: latest.salesValue,
      units: latest.units,
      avgPrice: latest.avgPrice,
      ...(first.currency ? { currency: first.currency } : {}),
      ...(first.segment ? { segment: first.segment } : {}),
      ...(shades.length ? { shades } : {}),
    };
    return periods.length > 1 && periods.some((x) => x.period)
      ? { ...row, history: periods.map((x) => ({ period: x.period, salesValue: x.salesValue, units: x.units })) }
      : row;
  });
}

/* ---------- Classeurs Circana « présentation » (titres, plusieurs feuilles, colonnes par période) ---------- */

export interface Sheet {
  name: string;
  rows: string[][];
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const BRAND_HEAD = ["marque", "brand", "brand name", "manufacturer brand"];
const PRODUCT_HEAD = ["produit", "product", "product name", "item", "item description", "description", "nom du produit"];

/** Colonne de ventes d'une période : « CA FY 2024 (K$) », « Dollar Sales 2025 », « Ventes T3 2026 (M€) »… */
function periodColumn(header: string): { period: string; factor: number; currency?: string } | null {
  const h = header.trim();
  if (!/(ca|ventes|sales|chiffre|revenue|valeur|value)/i.test(h)) return null;
  const m = h.match(/((?:FY|CY|YTD|MAT|T[1-4]|Q[1-4])\s*)?(\d{4})(\s*[-/]?\s*(?:T|Q)[1-4])?/i);
  if (!m) return null;
  const period = m[0].replace(/\s+/g, " ").trim().toUpperCase();
  const unit = h.match(/\(\s*([KkMm])?\s*([$€£])\s*\)/);
  const factor = unit?.[1]?.toUpperCase() === "K" ? 1_000 : unit?.[1]?.toUpperCase() === "M" ? 1_000_000 : 1;
  const sym = unit?.[2] ?? (h.includes("€") ? "€" : h.includes("$") ? "$" : h.includes("£") ? "£" : undefined);
  return { period, factor, currency: sym === "€" ? "EUR" : sym === "$" ? "USD" : sym === "£" ? "GBP" : undefined };
}

/** Zone lue dans le nom de la feuille ou son titre. */
function zoneFrom(text: string): string | undefined {
  const t = ` ${norm(text)} `;
  if (/[\s(|—–-](us|usa|u\.s\.|etats-unis|united states|amerique du nord)[\s)|—–-]/.test(t)) return "US";
  if (/[\s(|—–-](fr|france)[\s)|—–-]/.test(t)) return "France";
  if (/[\s(|—–-](uk|royaume-uni|united kingdom)[\s)|—–-]/.test(t)) return "Royaume-Uni";
  if (/[\s(|—–-](de|allemagne|germany)[\s)|—–-]/.test(t)) return "Allemagne";
  if (/[\s(|—–-](eu|europe)[\s)|—–-]/.test(t)) return "Europe";
  return undefined;
}

/** Segment lu dans le titre (« Top 50 SKU — Liquid Blush — ÉTATS-UNIS ») ou le nom de la feuille. */
function segmentFrom(title: string, sheetName: string): string | undefined {
  const parts = title.split(/\s[—–|]\s|\s-\s/).map((p) => p.trim()).filter(Boolean);
  const candidate = parts.find((p) => !/top\s*\d+|sku|fy\s*\d{4}|vs|donnees|ytd/i.test(norm(p)) && !zoneFrom(p));
  if (candidate) return candidate;
  const fromName = sheetName.split(/\s-\s/).pop()?.trim();
  return fromName && !zoneFrom(fromName) ? fromName : undefined;
}

/**
 * Lit un classeur Circana mis en forme : titre en haut, en-tête plus bas, une colonne de ventes par période,
 * zone et segment indiqués dans le titre ou le nom de la feuille. Renvoie un tableau « long »
 * (une ligne par produit, teinte et période), ou null si aucune feuille ne ressemble à ce format.
 */
export function normalizeCircanaSheets(sheets: Sheet[]): ParsedTable | null {
  const out: RawRow[] = [];
  for (const sheet of sheets) {
    const rows = sheet.rows;
    const headerIdx = rows.slice(0, 20).findIndex((r) => {
      const cells = r.map(norm);
      const b = cells.findIndex((c) => BRAND_HEAD.includes(c));
      const p = cells.findIndex((c, i) => i !== b && PRODUCT_HEAD.includes(c));
      return b >= 0 && p >= 0;
    });
    if (headerIdx < 0) continue;
    const head = rows[headerIdx];
    const cells = head.map(norm);
    const col = (names: string[]) => cells.findIndex((c) => names.includes(c));
    const brandCol = col(BRAND_HEAD);
    const productCol = cells.findIndex((c, i) => i !== brandCol && PRODUCT_HEAD.includes(c));
    const shadeCol = col(["teinte", "shade", "nuance", "couleur", "colour", "color"]);
    const zoneCol = col(["zone", "market", "marche", "pays", "country", "region", "geography"]);
    const segmentCol = col(["segment", "format", "sous-categorie", "subcategory"]);
    const periods = head.map((h, i) => ({ i, p: periodColumn(h) })).filter((x) => x.p) as { i: number; p: NonNullable<ReturnType<typeof periodColumn>> }[];
    if (!periods.length) continue;

    const title = rows.slice(0, headerIdx).flat().filter(Boolean).join(" — ");
    const zone = zoneFrom(sheet.name) ?? zoneFrom(title);
    const segment = segmentFrom(title, sheet.name);
    for (const r of rows.slice(headerIdx + 1)) {
      const brand = r[brandCol]?.trim();
      const product = r[productCol]?.trim();
      if (!brand || !product) continue;
      for (const { i, p } of periods) {
        const v = toNumber(r[i]);
        if (v === undefined) continue;
        out.push({
          Marque: brand,
          Produit: product,
          Teinte: shadeCol >= 0 ? (r[shadeCol]?.trim() ?? "") : "",
          Segment: segmentCol >= 0 ? (r[segmentCol]?.trim() ?? "") : (segment ?? ""),
          Zone: zoneCol >= 0 ? (r[zoneCol]?.trim() ?? "") : (zone ?? ""),
          "Période": p.period,
          Ventes: String(Math.round(v * p.factor * 100) / 100),
          Devise: p.currency ?? "",
        });
      }
    }
  }
  if (!out.length) return null;
  const headers = ["Marque", "Produit", "Teinte", "Segment", "Zone", "Période", "Ventes", "Devise"];
  return { headers, rows: out.slice(0, MAX_IMPORT_ROWS) };
}

/** CSV en matrice brute (pour les exports mis en forme). */
export function csvMatrix(text: string): string[][] {
  const p = Papa.parse<string[]>(text.replace(/^\uFEFF/, "").trim(), { header: false, skipEmptyLines: false });
  return p.data.map((r) => r.map((c) => String(c ?? "")));
}

export function toClientProducts(rows: RawRow[], m: Mapping): ClientProduct[] {
  return rows
    .map((r) => ({
      sku: pick(r, m, "sku") || undefined,
      name: pick(r, m, "name") ?? "",
      brand: pick(r, m, "brand") ?? "",
      zone: pick(r, m, "zone") ? toZone(pick(r, m, "zone")) : undefined,
      price: toNumber(pick(r, m, "price")),
      currency: pick(r, m, "currency")?.toUpperCase() || undefined,
      shadesCount: toNumber(pick(r, m, "shadesCount")),
      format: pick(r, m, "format") || undefined,
      status: pick(r, m, "status") || undefined,
      salesValue: toNumber(pick(r, m, "salesValue")),
    }))
    .filter((p) => p.name && p.brand);
}
