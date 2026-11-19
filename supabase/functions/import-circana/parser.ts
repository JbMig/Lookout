// LOOKOUT — Agent 1 : lecture d'un fichier Circana (.xlsx « Benchmark » ou .csv à plat)
// Même logique que agent1_circana.py, traduite en TypeScript pour l'Edge Function.
// Sortie : les lignes prêtes pour la table circana_sales (niveau SKU = produit x teinte, une ligne par année).

// deno-lint-ignore-file no-explicit-any
export type LigneVente = {
  period: string; country: string | null; region: string | null; brand: string; product_name: string;
  segment: string; subsegment: string | null; revenue: number; currency: string | null;
  product_key: string; raw: Record<string, unknown>;
};

type Sku = {
  zone: string | null; format: string | null; rang: number; produit: string; marque: string;
  teinte: string | null; cle_produit: string; ca_n1: number | null; ca_n: number | null;
  est_nouveaute: boolean; devise: string | null;
};

const ZONES: [string, string][] = [["ETATS-UNIS", "US"], ["USA", "US"], ["US", "US"], ["FRANCE", "FR"],
  ["FR", "FR"], ["CHINE", "CN"], ["CHINA", "CN"], ["CN", "CN"], ["EUROPE", "EU"], ["EU", "EU"]];
const FORMATS: [string, string][] = [["liquid", "liquide"], ["liquide", "liquide"], ["compact", "compact"],
  ["powder", "compact"], ["poudre", "compact"], ["creme", "creme"], ["cream", "creme"], ["stick", "stick"]];
const DEVISE_ZONE: Record<string, string> = { US: "USD", FR: "EUR", EU: "EUR", CN: "CNY" };
const REGIONS: Record<string, string> = { US: "NA", FR: "EU", EU: "EU", CN: "APAC" };

export const sansAccents = (t: unknown) => String(t ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "");
const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const motPresent = (texte: string, mot: string) => new RegExp(`(^|[^A-Za-z0-9_])${echapper(mot)}([^A-Za-z0-9_]|$)`).test(texte);

export function cleProduit(marque: string, produit: string): string {
  const slug = (t: string) => sansAccents(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug(marque)}__${slug(produit)}`;
}
export function zoneDepuis(texte: unknown): string | null {
  const t = sansAccents(texte).toUpperCase();
  for (const [mot, code] of ZONES) if (motPresent(t, mot)) return code;
  return null;
}
export function formatDepuis(texte: unknown): string | null {
  const t = sansAccents(texte).toLowerCase();
  for (const [mot, code] of FORMATS) if (motPresent(t, mot)) return code;
  return null;
}
export function nombre(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[\s  ]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
const nouveaute = (n1: number | null, n: number | null) => (n1 === null || n1 === 0) ? Boolean(n) : false;

// ---------------------------------------------------------------------------- Excel « Benchmark »
export function lireClasseur(XLSX: any, donnees: Uint8Array) {
  const classeur = XLSX.read(donnees, { type: "array" });
  const skus: Sku[] = [];
  const meta = { categorie: null as string | null, periode_n1: null as string | null, periode_n: null as string | null };
  for (const nom of classeur.SheetNames) {
    const feuille = classeur.Sheets[nom];
    if (!feuille["!ref"]) continue;
    const plage = XLSX.utils.decode_range(feuille["!ref"]);
    plage.s = { r: 0, c: 0 };                        // toujours partir de A1 (comme openpyxl)
    const lignes: any[][] = XLSX.utils.sheet_to_json(feuille, { header: 1, raw: true, defval: null, range: plage, blankrows: true });
    const titre = String(lignes.slice(0, 3).flat().find((v) => v !== null && v !== "") ?? "");
    const periodes = titre.match(/FY\s*\d{4}/g) ?? [];
    if (periodes.length >= 2) { meta.periode_n = periodes[0] ?? null; meta.periode_n1 = periodes[1] ?? null; }
    if (!meta.categorie && /blush/i.test(titre)) meta.categorie = "blush";
    if (/top\s*50\s*sku/i.test(titre)) lireFeuilleSkus(lignes, titre, skus);
  }
  return { skus, meta };
}

function lireFeuilleSkus(lignes: any[][], titre: string, skus: Sku[]) {
  const zone = zoneDepuis(titre), fmt = formatDepuis(titre);
  const iEntete = lignes.findIndex((r) => r && String(r[0] ?? "").trim().toLowerCase() === "rang");
  if (iEntete < 0) return;
  const entete = lignes[iEntete].map((v) => String(v ?? ""));
  const col = (nom: string, defaut: number) => { const i = entete.indexOf(nom); return i >= 0 ? i : defaut; };
  const colonnesCa = entete.map((n, i) => [n, i] as [string, number]).filter(([n]) => /CA/.test(n) && /\d{4}/.test(n))
    .sort((a, b) => Number(a[0].match(/\d{4}/)![0]) - Number(b[0].match(/\d{4}/)![0]));
  const iN1 = colonnesCa[0]?.[1] ?? 4, iN = colonnesCa[colonnesCa.length - 1]?.[1] ?? 5;
  const iProduit = col("Produit", 1), iMarque = col("Marque", 2), iTeinte = entete.indexOf("Teinte");
  const devise = entete[iN].includes("$") ? "USD" : entete[iN].includes("€") ? "EUR" : (DEVISE_ZONE[zone ?? ""] ?? null);
  for (const r of lignes.slice(iEntete + 1)) {
    if (!r || typeof r[0] !== "number") continue;
    const produit = String(r[iProduit]).trim(), marque = String(r[iMarque]).trim();
    const ca_n1 = nombre(r[iN1]), ca_n = nombre(r[iN]);
    skus.push({ zone, format: fmt, rang: Math.trunc(r[0]), produit, marque,
      teinte: iTeinte >= 0 && r[iTeinte] ? String(r[iTeinte]).trim() : null,
      cle_produit: cleProduit(marque, produit), ca_n1, ca_n, est_nouveaute: nouveaute(ca_n1, ca_n), devise });
  }
}

// ---------------------------------------------------------------------------- CSV à plat (une ligne par SKU)
const COLONNES_CSV: Record<string, string[]> = {
  zone: ["zone", "pays", "marche", "market", "country"], format: ["format", "segment", "sous_categorie", "subcategory"],
  rang: ["rang", "rank", "position"], produit: ["produit", "product", "item", "nom_produit"], marque: ["marque", "brand"],
  teinte: ["teinte", "shade", "nuance", "couleur"],
  ca_n1: ["ca_n1", "ca_fy_2024", "ventes_n1", "sales_ly", "ca_annee_precedente"],
  ca_n: ["ca_n", "ca_fy_2025", "ventes_n", "sales_ty", "ca_annee_courante"], devise: ["devise", "currency"],
};

function decouperCsv(texte: string): string[][] {
  const premiere = texte.split(/\r?\n/)[0] ?? "";
  const sep = [";", "\t", ","].sort((a, b) => premiere.split(b).length - premiere.split(a).length)[0];
  const lignes: string[][] = []; let champ = "", ligne: string[] = [], guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) { if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; } else if (c === '"') guillemets = false; else champ += c; }
    else if (c === '"') guillemets = true;
    else if (c === sep) { ligne.push(champ); champ = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && texte[i + 1] === "\n") i++; ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; }
    else champ += c;
  }
  if (champ !== "" || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return lignes.filter((l) => l.some((v) => v.trim() !== ""));
}

export function lireCsv(texte: string) {
  const [entete, ...corps] = decouperCsv(texte.replace(/^﻿/, ""));
  const norm = entete.map((h) => sansAccents(h).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""));
  const idx: Record<string, number> = {};
  for (const [cible, syn] of Object.entries(COLONNES_CSV)) { const i = norm.findIndex((h) => syn.includes(h)); if (i >= 0) idx[cible] = i; }
  const manquantes = ["produit", "marque", "ca_n"].filter((c) => !(c in idx));
  if (manquantes.length) throw new Error(`Colonnes introuvables dans le CSV : ${manquantes.join(", ")}. Colonnes lues : ${entete.join(", ")}`);
  const get = (r: string[], c: string) => (c in idx ? (r[idx[c]] ?? "").trim() : "");
  const skus: Sku[] = corps.map((r, i) => {
    const zone = zoneDepuis(get(r, "zone")) ?? (get(r, "zone").toUpperCase() || null);
    const produit = get(r, "produit"), marque = get(r, "marque");
    const ca_n1 = nombre(get(r, "ca_n1")), ca_n = nombre(get(r, "ca_n"));
    return { zone, format: formatDepuis(get(r, "format")) ?? (get(r, "format") || null), rang: Math.trunc(nombre(get(r, "rang")) ?? i + 1),
      produit, marque, teinte: get(r, "teinte") || null, cle_produit: cleProduit(marque, produit), ca_n1, ca_n,
      est_nouveaute: nouveaute(ca_n1, ca_n), devise: get(r, "devise") || DEVISE_ZONE[zone ?? ""] || null };
  });
  return { skus, meta: { categorie: null as string | null, periode_n1: null as string | null, periode_n: null as string | null } };
}

// ---------------------------------------------------------------------------- contrôles et transformation
export function controler(skus: Sku[]): string[] {
  const alertes: string[] = [];
  for (const l of skus) {
    if (!l.zone || !l.format) alertes.push(`zone ou format non reconnu : ${l.marque} ${l.produit}`);
    if ((l.ca_n1 ?? 0) < 0 || (l.ca_n ?? 0) < 0) alertes.push(`CA négatif : ${l.marque} ${l.produit}`);
  }
  const groupes = new Map<string, number[]>();
  for (const l of skus) { const k = `${l.zone}/${l.format}`; groupes.set(k, [...(groupes.get(k) ?? []), l.rang]); }
  for (const [k, rangs] of groupes) {
    const tries = [...rangs].sort((a, b) => a - b);
    if (tries.some((r, i) => r !== i + 1)) alertes.push(`rangs incomplets ou en double : ${k}`);
  }
  return alertes;
}

export const annee = (p: string | null) => Number((p ?? "").match(/\d{4}/)?.[0] ?? NaN);

export function lignesVentes(skus: Sku[], meta: { categorie: string | null; periode_n1: string | null; periode_n: string | null }): LigneVente[] {
  const a1 = annee(meta.periode_n1), a2 = annee(meta.periode_n);
  if (!Number.isFinite(a1) || !Number.isFinite(a2)) throw new Error("Périodes inconnues (ajoute periode_n1 et periode_n, ex. FY 2024 et FY 2025)");
  const lignes: LigneVente[] = [];
  for (const l of skus) {
    for (const [an, ca] of [[a1, l.ca_n1], [a2, l.ca_n]] as [number, number | null][]) {
      if (ca === null) continue;
      lignes.push({
        period: `${an}-01-01`, country: l.zone, region: REGIONS[l.zone ?? ""] ?? null, brand: l.marque,
        product_name: l.produit, segment: meta.categorie ?? "inconnue", subsegment: l.format,
        revenue: Math.round(ca * 1000 * 100) / 100, currency: l.devise, product_key: l.cle_produit,
        raw: { niveau: "sku", rang: l.rang, teinte: l.teinte, valeur_fichier: ca, unite_fichier: "K",
          periode_fichier: an === a1 ? meta.periode_n1 : meta.periode_n, est_nouveaute: l.est_nouveaute, niveau_marche: null },
      });
    }
  }
  return lignes;
}
