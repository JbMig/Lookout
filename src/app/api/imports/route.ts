import { handle } from "@/lib/http";
import { HttpError, requireUser } from "@/lib/auth";
import { repo, selectAll } from "@/lib/repo";
import { uploadToBucket } from "@/lib/storage";
import { isDemo } from "@/lib/config";
import { strip } from "@/lib/normalize";

export const maxDuration = 60;

type Raw = Record<string, unknown>;

export interface ImportView {
  id: string;
  filename: string;
  storagePath: string | null;
  status: string;
  rowCount: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  error: string | null;
  alerts: string[];
  quality: { missingCurrency: number; missingZone: number; missingFormat: number; duplicates: number; overlap: number };
}

/** Imports Circana (Agent 1) avec contrôles qualité calculés sur les lignes en base. */
export const GET = handle(async () => {
  await requireUser();
  const [imports, sales] = await Promise.all([
    repo().select<Raw>("circana_imports", { order: ["created_at", "desc"], limit: 100 }),
    selectAll<Raw>("circana_sales", { order: ["created_at", "desc"] }),
  ]);
  const order = new Map(imports.map((i, n) => [String(i.id), n]));
  const firstOwner = new Map<string, string>();
  const views: ImportView[] = imports.map((i) => ({
    id: String(i.id),
    filename: String(i.filename ?? ""),
    storagePath: (i.storage_path as string) ?? null,
    status: String(i.status ?? "pending"),
    rowCount: (i.row_count as number) ?? null,
    periodStart: (i.period_start as string) ?? null,
    periodEnd: (i.period_end as string) ?? null,
    createdAt: String(i.created_at),
    error: i.status === "failed" ? ((i.error_message as string) ?? null) : null,
    alerts: typeof i.error_message === "string" && i.status !== "failed"
      ? i.error_message.replace(/^Alertes\s*:\s*/i, "").split("|").map((a) => a.trim()).filter(Boolean)
      : [],
    quality: { missingCurrency: 0, missingZone: 0, missingFormat: 0, duplicates: 0, overlap: 0 },
  }));
  const byId = new Map(views.map((v) => [v.id, v]));
  const seen = new Set<string>();
  const sorted = [...sales].sort((a, b) => (order.get(String(a.import_id)) ?? 999) - (order.get(String(b.import_id)) ?? 999));
  for (const s of sorted) {
    const v = byId.get(String(s.import_id));
    if (!v) continue;
    if (!s.currency) v.quality.missingCurrency++;
    if (!s.country && !s.region) v.quality.missingZone++;
    if (!s.subsegment && !/liquid|compact|cream|creme|stick|powder/i.test(String(s.segment ?? ""))) v.quality.missingFormat++;
    const raw = (s.raw ?? {}) as Raw;
    const own = [s.import_id, strip(String(s.brand)), strip(String(s.product_name)), s.period, s.country ?? s.region, raw.teinte ?? ""].join("|");
    if (seen.has(own)) v.quality.duplicates++;
    seen.add(own);
    const shared = [strip(String(s.brand)), strip(String(s.product_name)), s.period].join("|");
    const owner = firstOwner.get(shared);
    if (!owner) firstOwner.set(shared, v.id);
    else if (owner !== v.id) v.quality.overlap++;
  }
  return { imports: views };
});

/** Dépose un fichier Circana dans le bucket circana-uploads (à la racine, comme l'attend l'Agent 1). */
export const POST = handle(async (req: Request) => {
  await requireUser();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Aucun fichier reçu");
  if (!/\.(csv|txt|xlsx|xls)$/i.test(file.name)) throw new HttpError(400, "Formats acceptés : .csv, .xlsx, .xls");
  if (file.size > 20 * 1024 * 1024) throw new HttpError(400, "Fichier trop lourd (20 Mo maximum)");
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const safe = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_");
  const name = `${stamp}_${safe}`;
  if (isDemo.db) return { file: name, demo: true };
  const path = await uploadToBucket("circana-uploads", name, await file.arrayBuffer(), file.type || "application/octet-stream");
  if (!path) throw new HttpError(500, "Le dépôt dans circana-uploads a échoué");
  return { file: name };
});
