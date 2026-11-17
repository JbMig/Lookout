import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { loadReport, newShareToken } from "@/lib/reports";

/** Crée (ou renvoie) le lien de partage en lecture seule (colonne share_slug). */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/reports/[id]/share">) => {
  await requireUser();
  const { id } = await ctx.params;
  const report = await loadReport(id);
  const token = report.share_slug ?? newShareToken();
  if (!report.share_slug) await repo().update("reports", report.id, { share_slug: token });
  return { token };
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/reports/[id]/share">) => {
  await requireUser();
  const { id } = await ctx.params;
  const report = await loadReport(id);
  await repo().update("reports", report.id, { share_slug: null });
  return { ok: true };
});
