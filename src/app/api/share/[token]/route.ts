import { handle } from "@/lib/http";
import { HttpError, requireUser } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { reportBundle } from "@/lib/reports";
import { dashboardMeta, isAgentDashboard } from "@/lib/dashboards";
import type { ReportDbRow } from "@/lib/types";

/** Lecture d'un rapport partagé, réservée aux comptes Lookout (données Circana sous licence). */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/share/[token]">) => {
  await requireUser();
  const { token } = await ctx.params;
  if (!token || token.length < 16) throw new HttpError(404, "Lien invalide");
  const [report] = await repo().select<ReportDbRow>("reports", { eq: { share_slug: token } });
  if (!report || report.type !== "dashboard") throw new HttpError(404, "Ce lien de partage n'existe plus");
  if (isAgentDashboard(report as unknown as Record<string, unknown>)) {
    return { kind: "agents", ...dashboardMeta(report as unknown as Record<string, unknown>, { publicView: true }) };
  }
  const bundle = await reportBundle(report);
  return {
    report: { ...bundle.report, share_token: null, error: null, created_by: null },
    items: bundle.items.map((i) => ({ ...i, error: null })),
  };
});
