import { handle } from "@/lib/http";
import { HttpError, requireUser } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { isAgentDashboard } from "@/lib/dashboards";
import { htmlResponse, radarHtml } from "@/lib/radar";

/** Page « Market Radar » du dashboard (affichée dans un cadre, ou téléchargée avec ?download=1). */
export const GET = handle(async (req: Request, ctx: RouteContext<"/api/dashboards/[id]/radar">) => {
  await requireUser();
  const { id } = await ctx.params;
  const report = await repo().get<Record<string, unknown>>("reports", id);
  if (!report || !isAgentDashboard(report)) throw new HttpError(404, "Ce dashboard n'existe pas");
  const download = new URL(req.url).searchParams.get("download") ? "market-radar.html" : null;
  return htmlResponse(await radarHtml(), download);
});
