/* =========================================================================
   Types du domaine. Les lignes de base de données sont en snake_case
   (identiques dans Supabase et dans le stockage local du mode démo).
   ========================================================================= */

export type Zone = "US" | "EU";
export type Role = "owner" | "admin" | "analyst" | "viewer";
export type PlanId = "trial" | "pro" | "enterprise";

/* ---------- Fiches produits (stockées en JSON) ---------- */

export interface ProductFormat {
  size: string;
  price?: number;
  currency?: string;
}

export interface ProductShade {
  name: string;
  hex?: string;
  family?: ShadeFamily;
}

export type ShadeFamily = "Rose" | "Pêche / corail" | "Rouge" | "Baie / prune" | "Mauve" | "Nude / brun" | "Autre";

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

/** Ligne Circana normalisée. */
export interface CircanaRow {
  brand: string;
  product: string;
  zone: Zone;
  period?: string;
  salesValue?: number;
  units?: number;
  avgPrice?: number;
  /** Ventes par période quand le fichier en contient plusieurs (la ligne garde la plus récente). */
  history?: { period: string; salesValue?: number; units?: number }[];
}

/** Produit du catalogue interne du client, normalisé. */
export interface ClientProduct {
  name: string;
  brand: string;
  zone?: Zone;
  price?: number;
  currency?: string;
  shadesCount?: number;
  format?: string;
  status?: string; // actif, arrêté, lancement…
  salesValue?: number;
}

/* ---------- Lignes de base ---------- */

export interface OrganizationRow {
  id: string;
  name: string;
  plan: PlanId;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface MembershipRow {
  id: string;
  org_id: string;
  user_id: string;
  role: Role;
  created_at: string;
}

export interface InvitationRow {
  id: string;
  org_id: string;
  email: string;
  role: Role;
  accepted_at: string | null;
  created_at: string;
}

export type SiteStatus =
  | "untested" // jamais testé
  | "scraping" // scraping automatique fiable
  | "linkup" // Linkup suffit
  | "computer_use" // parcours H Company enregistré
  | "needs_review" // échec signalé à l'équipe
  | "blocked" // inexploitable
  | "requested"; // demandé par un client, à ajouter

export type SiteType = "revendeur" | "marque" | "marketplace";

export interface SiteRow {
  id: string;
  domain: string;
  name: string;
  zone: Zone;
  country: string;
  type: SiteType;
  categories: string[];
  status: SiteStatus;
  cu_instructions: string | null; // parcours de computer use
  notes: string | null;
  requested_by_org: string | null;
  last_success_at: string | null;
  created_at: string;
}

export interface AnalysisParams {
  zones: Zone[];
  siteIds: string[]; // vide = tous les sites actifs des zones choisies
  excludedBrands: string[];
  focus: string; // produits ou mots-clés ciblés
  focusOnly: boolean; // ne garder que les lignes Circana qui contiennent le focus
}

export type ReportStatus = "collecting" | "analyzing" | "done" | "failed";

export interface ReportRow {
  id: string;
  org_id: string;
  created_by: string;
  name: string;
  category: string;
  params: AnalysisParams;
  status: ReportStatus;
  stats: ReportStats | null;
  analysis: string | null;
  trends: Trends | null;
  catalog: CatalogInsights | null;
  share_token: string | null;
  error: string | null;
  created_at: string;
}

export type ItemStatus =
  | "pending"
  | "collecting"
  | "navigating" // session H Company en cours
  | "awaiting_team" // signalé à l'équipe (scraping impossible)
  | "done"
  | "partial"
  | "failed";

export type CollectMethod = "scraping" | "linkup" | "hcompany" | "manual" | "demo";

export interface ReportItemRow {
  id: string;
  report_id: string;
  org_id: string;
  position: number;
  circana: CircanaRow;
  status: ItemStatus;
  method: CollectMethod | null;
  site_domain: string | null;
  session_id: string | null;
  product: ProductSheet | null;
  error: string | null;
  updated_at: string;
}

export interface ClientProductRow {
  id: string;
  report_id: string;
  org_id: string;
  data: ClientProduct;
  match_item_id: string | null;
  match_score: number | null;
}

export interface AgentRunRow {
  id: string;
  org_id: string | null;
  report_id: string | null;
  service: "linkup" | "hcompany" | "huggingface" | "scraping";
  action: string;
  ok: boolean;
  created_at: string;
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
  priceGapPct: number | null; // prix client vs moyenne du marché (même zone)
  shadesGap: number | null; // nb de teintes client - moyenne des best-sellers
  trend: "progresse" | "décline" | "stable" | "inconnu";
}

export interface CatalogInsights {
  clientBrands: string[];
  products: CatalogProductInsight[];
  summary: string;
}

/* ---------- Session ---------- */

export interface SessionUser {
  userId: string;
  email: string;
  orgId: string;
  orgName: string;
  plan: PlanId;
  role: Role;
  isStaff: boolean;
}
