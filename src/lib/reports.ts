import "server-only";
import { randomBytes } from "crypto";
import { repo } from "./repo";
import { HttpError } from "./auth";
import { loadSheets } from "./market";
import type { ItemView, ReportBundle, ReportDbRow, ReportStatus, ReportView } from "./types";

/** Statut affiché, à partir du statut Supabase (draft/generating/ready/failed) et de la phase. */
export function viewStatus(r: ReportDbRow): ReportStatus {
  if (r.status === "ready") return "done";
  if (r.status === "failed") return "failed";
  return r.data?.phase === "analyzing" ? "analyzing" : "collecting";
}

export function toView(r: ReportDbRow): ReportView {
  return {
    id: r.id,
    name: r.title,
    category: r.config?.category ?? "",
    status: viewStatus(r),
    params: r.config?.params ?? { zones: [], siteIds: [], excludedBrands: [], focus: "", focusOnly: false },
    stats: r.data?.stats ?? null,
    analysis: r.data?.analysis ?? null,
    trends: r.data?.trends ?? null,
    catalog: r.data?.catalog ?? null,
    share_token: r.share_slug,
    error: r.error_message,
    created_by: r.created_by,
    created_at: r.created_at,
  };
}

/** Espace unique : tout utilisateur connecté accède aux rapports. */
export async function loadReport(id: string) {
  const report = await repo().get<ReportDbRow>("reports", id);
  if (!report || report.type !== "dashboard") throw new HttpError(404, "Rapport introuvable");
  return report;
}

export async function itemViews(r: ReportDbRow): Promise<ItemView[]> {
  const items = r.data?.items ?? [];
  const sheets = await loadSheets(items.map((i) => i.marketProductId ?? ""));
  return items
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((i) => ({
      id: i.id,
      position: i.position,
      circana: i.circana,
      status: i.status,
      method: i.method,
      site_domain: i.siteDomain,
      product: i.marketProductId ? (sheets.get(i.marketProductId)?.sheet ?? null) : null,
      error: i.error,
      updated_at: i.updatedAt,
    }));
}

export async function reportBundle(r: ReportDbRow): Promise<ReportBundle> {
  return { report: toView(r), items: await itemViews(r) };
}

export function newShareToken() {
  return randomBytes(18).toString("base64url");
}
