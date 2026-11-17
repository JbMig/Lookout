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

export const MAX_IMPORT_ROWS = 2000;

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
];

export const CATALOG_FIELDS: FieldDef[] = [
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

/** Une ligne par produit et par zone ; les périodes multiples sont regroupées dans `history`. */
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
    }))
    .filter((r) => r.brand && r.product);

  const groups = new Map<string, CircanaRow[]>();
  for (const r of flat) {
    const key = `${r.brand.toLowerCase()}|${r.product.toLowerCase()}|${r.zone}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()].map((list) => {
    const sorted = [...list].sort((a, b) => (a.period ?? "").localeCompare(b.period ?? ""));
    const latest = sorted[sorted.length - 1];
    return sorted.length > 1 && sorted.some((x) => x.period)
      ? { ...latest, history: sorted.map((x) => ({ period: x.period ?? "", salesValue: x.salesValue, units: x.units })) }
      : latest;
  });
}

export function toClientProducts(rows: RawRow[], m: Mapping): ClientProduct[] {
  return rows
    .map((r) => ({
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
