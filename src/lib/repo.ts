import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { config, isDemo } from "./config";

/**
 * Couche de données générique, identique pour Supabase et pour le stockage local
 * du mode démo. Le serveur utilise la clé service_role ; aucune clé Supabase
 * n'est envoyée au navigateur.
 */

/** Tables du projet Supabase utilisées par l'application (schéma existant). */
export type Table =
  | "profiles"
  | "reports"
  | "market_products"
  | "market_shades"
  | "market_ingredients"
  | "enrichment_jobs"
  | "circana_imports"
  | "circana_sales"
  | "catalog_products"
  | "analyses"
  | "growth_opportunities"
  | "trend_posts"
  | "trend_signals"
  | "sites";

type Row = Record<string, unknown> & { id: string };

export interface Query {
  eq?: Record<string, unknown>;
  in?: [string, unknown[]];
  gte?: [string, string];
  order?: [string, "asc" | "desc"];
  limit?: number;
}

export interface Repo {
  select<T>(table: Table, q?: Query): Promise<T[]>;
  get<T>(table: Table, id: string): Promise<T | null>;
  insert<T>(table: Table, rows: Partial<T>[]): Promise<T[]>;
  update(table: Table, id: string, patch: Record<string, unknown>): Promise<void>;
  updateWhere(table: Table, eq: Record<string, unknown>, patch: Record<string, unknown>): Promise<void>;
  remove(table: Table, id: string): Promise<void>;
  removeWhere(table: Table, eq: Record<string, unknown>): Promise<void>;
}

/* ---------------- Supabase ---------------- */

class SupabaseRepo implements Repo {
  private sb: SupabaseClient;
  constructor() {
    this.sb = createClient(config.supabase.url, config.supabase.serviceKey, { auth: { persistSession: false } });
  }
  async select<T>(table: Table, q: Query = {}) {
    let req = this.sb.from(table).select("*");
    for (const [k, v] of Object.entries(q.eq ?? {})) req = v === null ? req.is(k, null) : req.eq(k, v as string);
    if (q.in) req = req.in(q.in[0], q.in[1] as string[]);
    if (q.gte) req = req.gte(q.gte[0], q.gte[1]);
    if (q.order) req = req.order(q.order[0], { ascending: q.order[1] === "asc" });
    if (q.limit) req = req.limit(q.limit);
    const { data, error } = await req;
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data ?? []) as T[];
  }
  async get<T>(table: Table, id: string) {
    const { data, error } = await this.sb.from(table).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data as T) ?? null;
  }
  async insert<T>(table: Table, rows: Partial<T>[]) {
    if (!rows.length) return [];
    const { data, error } = await this.sb.from(table).insert(rows as Record<string, unknown>[]).select("*");
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data ?? []) as T[];
  }
  async update(table: Table, id: string, patch: Record<string, unknown>) {
    const { error } = await this.sb.from(table).update(patch).eq("id", id);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  async updateWhere(table: Table, eq: Record<string, unknown>, patch: Record<string, unknown>) {
    let req = this.sb.from(table).update(patch);
    for (const [k, v] of Object.entries(eq)) req = req.eq(k, v as string);
    const { error } = await req;
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  async remove(table: Table, id: string) {
    const { error } = await this.sb.from(table).delete().eq("id", id);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  async removeWhere(table: Table, eq: Record<string, unknown>) {
    let req = this.sb.from(table).delete();
    for (const [k, v] of Object.entries(eq)) req = req.eq(k, v as string);
    const { error } = await req;
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

/* ---------------- Fichier local (mode démo) ---------------- */

const FILE = path.join(process.env.VERCEL ? "/tmp" : process.cwd(), ".data", "db.json");
type Data = Partial<Record<Table, Row[]>>;

let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function load(): Promise<Data> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Data;
  } catch {
    return {};
  }
}
async function save(d: Data) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(d));
  await fs.rename(tmp, FILE);
}

function matches(r: Row, q: Query) {
  for (const [k, v] of Object.entries(q.eq ?? {})) if ((r[k] ?? null) !== v) return false;
  if (q.in && !q.in[1].includes(r[q.in[0]])) return false;
  if (q.gte && String(r[q.gte[0]] ?? "") < q.gte[1]) return false;
  return true;
}

/** Valeurs par défaut du schéma Supabase, reproduites pour le mode démo. */
const DEFAULTS: Partial<Record<Table, Record<string, unknown>>> = {
  profiles: { full_name: null, avatar_url: null },
  reports: { type: "dashboard", status: "draft", config: {}, data: {}, analysis_ids: [], share_slug: null, error_message: null, created_by: null },
  market_products: {
    category: null, subcategory: null, format: null, texture: null, country: null, locale: null, currency: null,
    price: null, list_price: null, shade_count: null, packshot_url: null, description: null, status: "discovered",
    raw_data: {}, enriched_at: null,
  },
  market_shades: { shade_code: null, hex_code: null, family: null, is_bestseller: false, image_url: null, position: null },
  market_ingredients: { function: null, is_key_ingredient: false, position: null },
  enrichment_jobs: { source: null, status: "queued", attempts: 0, error_message: null, started_at: null, finished_at: null },
  circana_imports: { storage_path: null, status: "pending", period_start: null, period_end: null, row_count: 0, error_message: null, created_by: null },
  circana_sales: { retailer: null, channel: null, country: null, region: null, brand: null, segment: null, subsegment: null, currency: "USD", product_key: null, raw: {} },
  catalog_products: { sku: null, brand: null, category: null, subcategory: null, range_name: null, format: null, status: "active", launch_date: null, price: null, currency: "EUR", description: null, image_url: null, attributes: {} },
  analyses: { status: "queued", params: {}, result: {}, error_message: null, started_at: null, completed_at: null },
  growth_opportunities: { description: null, score: null, estimated_impact: {}, refs: {} },
  sites: { country: null, type: "revendeur", categories: [], method: "untested", cu_instructions: null, source: "catalog", last_success_at: null },
};

class LocalRepo implements Repo {
  select<T>(table: Table, q: Query = {}) {
    return locked(async () => {
      let rows = ((await load())[table] ?? []).filter((r) => matches(r, q));
      if (q.order) {
        const [k, dir] = q.order;
        rows = rows.sort((a, b) => {
          const x = a[k] as string | number, y = b[k] as string | number;
          return (x < y ? -1 : x > y ? 1 : 0) * (dir === "asc" ? 1 : -1);
        });
      }
      if (q.limit) rows = rows.slice(0, q.limit);
      return rows as unknown as T[];
    });
  }
  get<T>(table: Table, id: string) {
    return locked(async () => (((await load())[table] ?? []).find((r) => r.id === id) as unknown as T) ?? null);
  }
  insert<T>(table: Table, rows: Partial<T>[]) {
    return locked(async () => {
      const d = await load();
      const now = new Date().toISOString();
      const created = rows.map(
        (r) =>
          ({
            ...DEFAULTS[table],
            created_at: now,
            ...(["reports", "market_products", "catalog_products", "circana_imports", "profiles", "sites"].includes(table) ? { updated_at: now } : {}),
            ...(r as Record<string, unknown>),
            id: ((r as Record<string, unknown>).id as string) ?? randomUUID(),
          }) as Row,
      );
      d[table] = [...(d[table] ?? []), ...created];
      await save(d);
      return created as unknown as T[];
    });
  }
  update(table: Table, id: string, patch: Record<string, unknown>) {
    return locked(async () => {
      const d = await load();
      const r = (d[table] ?? []).find((x) => x.id === id);
      if (r) Object.assign(r, patch);
      await save(d);
    });
  }
  updateWhere(table: Table, eq: Record<string, unknown>, patch: Record<string, unknown>) {
    return locked(async () => {
      const d = await load();
      for (const r of d[table] ?? []) if (matches(r, { eq })) Object.assign(r, patch);
      await save(d);
    });
  }
  remove(table: Table, id: string) {
    return locked(async () => {
      const d = await load();
      d[table] = (d[table] ?? []).filter((x) => x.id !== id);
      await save(d);
    });
  }
  removeWhere(table: Table, eq: Record<string, unknown>) {
    return locked(async () => {
      const d = await load();
      d[table] = (d[table] ?? []).filter((x) => !matches(x, { eq }));
      await save(d);
    });
  }
}

let instance: Repo | null = null;
export function repo(): Repo {
  if (!instance) instance = isDemo.db ? new LocalRepo() : new SupabaseRepo();
  return instance;
}
