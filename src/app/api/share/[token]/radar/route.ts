import { handle } from "@/lib/http";
import { HttpError, requireUser } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { isAgentDashboard } from "@/lib/dashboards";
import { htmlResponse, radarHtml } from "@/lib/radar";

/** Lien de partage du dashboard « Market Radar », réservé aux comptes Lookout. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/share/[token]/radar">) => {
  await requireUser();
  const { token } = await ctx.params;
  if (!token || token.length < 16) throw new HttpError(404, "Lien invalide");
  const [report] = await repo().select<Record<string, unknown>>("reports", { eq: { share_slug: token } });
  if (!report || !isAgentDashboard(report)) throw new HttpError(404, "Ce lien de partage n'existe plus");
  return htmlResponse(await radarHtml());
});
