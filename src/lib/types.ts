/* =========================================================================
   Types du domaine.
   Les « Row » correspondent exactement aux tables du projet Supabase
   (schéma existant, non modifié par l'application).
   ========================================================================= */

export type Zone = "US" | "EU";

/* ---------- Fiches produits ---------- */

export interface ProductFormat {
  size: string;
  price?: number;
  currency?: string;
}

export type ShadeFamily = "Rose" | "Pêche / corail" | "Rouge" | "Baie / prune" | "Mauve" | "Nude / brun" | "Autre";

export interface ProductShade {
  name: string;
  hex?: string;
  family?: ShadeFamily;
}

export interface ProductSheet {
  name: string;
  brand: string;
  price: number | null;
  currency: string | null;
  priceEur: number | null;
  ingredients: string | null;
  formats: ProductFormat[];
  shades: ProductShade[];
  packaging: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
}

/** Ligne Circana normalisée (une par produit et par zone, périodes regroupées). */
export interface CircanaRow {
  brand: string;
  product: string;
  zone: Zone;
  period?: string;
  salesValue?: number;
  units?: number;
  avgPrice?: number;
  /** Devise des ventes (USD, EUR…), si le fichier la précise. */
  currency?: string;
  /** Segment Circana (ex. Liquid Blush). */
  segment?: string;
  /** Teintes listées par Circana pour ce produit (lignes SKU). */
  shades?: string[];
  history?: { period: string; salesValue?: number; units?: number }[];
}

/** Produit du catalogue du client, normalisé. */
export interface ClientProduct {
  sku?: string;
  name: string;
  brand: string;
  zone?: Zone;
  price?: number;
  currency?: string;
  shadesCount?: number;
  format?: string;
  status?: string;
  salesValue?: number;
}

/* ---------- Tables Supabase ---------- */

export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export type ReportDbStatus = "draft" | "generating" | "ready" | "failed";

export interface ReportDbRow {
  id: string;
  title: string;
  type: "dashboard" | "weekly_digest" | "market_comparison";
  status: ReportDbStatus;
  config: ReportConfig;
  data: ReportData;
  analysis_ids: string[];
  share_slug: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type MarketStatus = "discovered" | "enriching" | "enriched" | "verified" | "failed";

export interface MarketProductRow {
  id: string;
  brand: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  format: string | null;
  texture: string | null;
  product_url: string;
  source_site: string;
  country: string | null;
  locale: string | null;
  currency: string | null;
  price: number | null;
  list_price: number | null;
  shade_count: number | null;
  packshot_url: string | null;
  description: string | null;
  status: MarketStatus;
  raw_data: { sheet?: ProductSheet; method?: CollectMethod; zone?: Zone };
  discovered_at: string;
  enriched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketShadeRow {
  id: string;
  product_id: string;
  shade_name: string | null;
  shade_code: string | null;
  hex_code: string | null;
  family: string | null;
  is_bestseller: boolean;
  image_url: string | null;
  position: number | null;
}

export interface MarketIngredientRow {
  id: string;
  product_id: string;
  inci_name: string;
  function: string | null;
  is_key_ingredient: boolean;
  position: number | null;
}

export type JobStatus = "queued" | "running" | "completed" | "failed";

/**
 * File de l'équipe. `source` indique l'état du traitement :
 * "team" (à traiter), "hcompany:<session>" (computer use en cours), "manual", "dismissed".
 */
export interface EnrichmentJobRow {
  id: string;
  target_type: "market_product" | "catalog_product";
  target_id: string;
  source: string | null;
  status: JobStatus;
  attempts: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface CircanaImportRow {
  id: string;
  filename: string;
  storage_path: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  period_start: string | null;
  period_end: string | null;
  row_count: number;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CircanaSaleRow {
  id: number;
  import_id: string;
  period: string;
  retailer: string | null;
  channel: string | null;
  country: string | null;
  region: string | null;
  brand: string | null;
  product_name: string;
  segment: string | null;
  subsegment: string | null;
  units: number | null;
  revenue: number | null;
  avg_price: number | null;
  currency: string;
  product_key: string | null;
  raw: Record<string, unknown>;
}

export interface CatalogProductRow {
  id: string;
  sku: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  range_name: string | null;
  format: string | null;
  status: "active" | "discontinued" | "coming_soon";
  launch_date: string | null;
  price: number | null;
  currency: string;
  description: string | null;
  image_url: string | null;
  attributes: { zone?: Zone; shadesCount?: number; salesValue?: number; statusLabel?: string };
  created_at: string;
  updated_at: string;
}

export interface AnalysisRow {
  id: string;
  type: "catalog_audit" | "market_comparison" | "growth_potential";
  status: "queued" | "running" | "completed" | "failed";
  params: Record<string, unknown>;
  result: Record<string, unknown>;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface GrowthOpportunityRow {
  id: string;
  analysis_id: string;
  kind: "price_gap" | "shade_gap" | "format_gap" | "segment_gap" | "winner_to_benchmark";
  title: string;
  description: string | null;
  score: number | null;
  estimated_impact: Record<string, unknown>;
  refs: Record<string, unknown>;
}

export interface TrendPostRow {
  id: string;
  platform: "tiktok" | "instagram";
  post_url: string;
  caption: string | null;
  hashtags: string[];
  views: number | null;
  posted_at: string | null;
}

/* ---------- Contenu d'un rapport (reports.config / reports.data) ---------- */

export interface AnalysisParams {
  zones: Zone[];
  siteIds: string[]; // domaines des sites retenus ; vide = tous les sites actifs des zones
  excludedBrands: string[];
  focus: string;
  focusOnly: boolean;
}

export interface ReportConfig {
  category: string;
  params: AnalysisParams;
  circanaImportId: string | null;
  catalogProductIds: string[];
}

export type ItemStatus = "pending" | "collecting" | "navigating" | "awaiting_team" | "done" | "partial" | "failed";
export type CollectMethod = "scraping" | "linkup" | "hcompany" | "manual" | "demo";

/** Une ligne Circana à enrichir, stockée dans reports.data.items. */
export interface StoredItem {
  id: string;
  position: number;
  circana: CircanaRow;
  status: ItemStatus;
  method: CollectMethod | null;
  siteDomain: string | null;
  marketProductId: string | null;
  jobId: string | null;
  error: string | null;
  updatedAt: string;
}

export interface ReportData {
  phase?: "collecting" | "analyzing";
  items?: StoredItem[];
  stats?: ReportStats | null;
  analysis?: string | null;
  trends?: Trends | null;
  catalog?: CatalogInsights | null;
}

/* ---------- Résultats d'analyse ---------- */

export interface TrendItem {
  label: string;
  type: "actif" | "format" | "teinte" | "finition";
  mentions: number;
  share: number;
}

export interface Trends {
  source: string;
  postsAnalyzed: number;
  items: TrendItem[];
  summary: string;
}

export interface ReportStats {
  productCount: number;
  completeCount: number;
  awaitingTeam: number;
  avgPriceEur: Partial<Record<Zone, number>>;
  shadeCountAvg: number;
  formats: { format: string; count: number }[];
  shadeFamilies: { brand: string; families: Partial<Record<ShadeFamily, number>> }[];
  methods: Partial<Record<CollectMethod, number>>;
}

export interface CatalogProductInsight {
  client: ClientProduct;
  matchName: string | null;
  matchScore: number | null;
  priceGapPct: number | null;
  shadesGap: number | null;
  trend: "progresse" | "décline" | "stable" | "inconnu";
}

export interface CatalogInsights {
  clientBrands: string[];
  products: CatalogProductInsight[];
  summary: string;
}

/* ---------- Vues renvoyées à l'interface ---------- */

export type ReportStatus = "collecting" | "analyzing" | "done" | "failed";

export interface ReportView {
  id: string;
  name: string;
  category: string;
  status: ReportStatus;
  params: AnalysisParams;
  stats: ReportStats | null;
  analysis: string | null;
  trends: Trends | null;
  catalog: CatalogInsights | null;
  share_token: string | null;
  error: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ItemView {
  id: string;
  position: number;
  circana: CircanaRow;
  status: ItemStatus;
  method: CollectMethod | null;
  site_domain: string | null;
  product: ProductSheet | null;
  error: string | null;
  updated_at: string;
}

export interface ReportBundle {
  report: ReportView;
  items: ItemView[];
}

/* ---------- Session ---------- */

export interface SessionUser {
  userId: string;
  email: string;
  fullName: string | null;
  isStaff: boolean;
}
