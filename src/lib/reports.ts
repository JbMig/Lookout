import "server-only";
import { randomBytes } from "crypto";
import { repo } from "./repo";
import { HttpError } from "./auth";
import type { ClientProductRow, ReportItemRow, ReportRow, SessionUser } from "./types";

export async function loadReport(id: string, user: SessionUser) {
  const report = await repo().get<ReportRow>("reports", id);
  if (!report || report.org_id !== user.orgId) throw new HttpError(404, "Rapport introuvable");
  return report;
}

export async function reportBundle(report: ReportRow) {
  const db = repo();
  const items = await db.select<ReportItemRow>("report_items", { eq: { report_id: report.id }, order: ["position", "asc"] });
  const clientProducts = await db.select<ClientProductRow>("client_products", { eq: { report_id: report.id } });
  return { report, items, clientProducts };
}

export function newShareToken() {
  return randomBytes(18).toString("base64url");
}
