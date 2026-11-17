import { handle } from "@/lib/http";
import { requireStaff, requireUser, HttpError } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { loadReport, reportBundle } from "@/lib/reports";
import type { AnalysisRow } from "@/lib/types";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/reports/[id]">) => {
  await requireUser();
  const { id } = await ctx.params;
  return reportBundle(await loadReport(id));
});

/** Suppression : l'auteur du rapport ou l'équipe. Les fiches produits (partagées) sont conservées. */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/reports/[id]">) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const report = await loadReport(id);
  if (report.created_by !== user.userId) await requireStaff().catch(() => { throw new HttpError(403, "Seul l'auteur peut supprimer ce rapport"); });
  const db = repo();
  for (const a of report.analysis_ids ?? []) {
    await db.removeWhere("growth_opportunities", { analysis_id: a });
    if (await db.get<AnalysisRow>("analyses", a)) await db.remove("analyses", a);
  }
  await db.remove("reports", report.id);
  return { ok: true };
});
