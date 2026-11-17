import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { config, isDemo } from "./config";

/**
 * Couche de données générique, identique pour Supabase et pour le stockage local
 * du mode démo. Le serveur utilise la clé service_role : l'isolation entre
 * organisations est appliquée dans le code (chaque requête filtre par org_id),
 * et doublée par les règles RLS côté Supabase (voir supabase/schema.sql).
 */

export type Table =
  | "organizations"
  | "profiles"
  | "memberships"
  | "invitations"
  | "sites"
  | "reports"
  | "report_items"
  | "client_products"
  | "agent_runs";

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

const DEFAULTS: Partial<Record<Table, Record<string, unknown>>> = {
  organizations: { plan: "trial" },
  memberships: { role: "analyst" },
  invitations: { role: "analyst", accepted_at: null },
  sites: { status: "untested", categories: [], cu_instructions: null, notes: null, requested_by_org: null, last_success_at: null, country: "", type: "revendeur" },
  reports: { status: "collecting", stats: null, analysis: null, trends: null, catalog: null, share_token: null, error: null, category: "" },
  report_items: { status: "pending", method: null, site_domain: null, session_id: null, product: null, error: null },
  client_products: { match_item_id: null, match_score: null },
  agent_runs: { ok: true, org_id: null, report_id: null },
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
            updated_at: now,
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
}

let instance: Repo | null = null;
export function repo(): Repo {
  if (!instance) instance = isDemo.db ? new LocalRepo() : new SupabaseRepo();
  return instance;
}
