import { handle } from "@/lib/http";
import { HttpError } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { reportBundle } from "@/lib/reports";
import type { ReportRow } from "@/lib/types";

/** Lecture publique d'un rapport partagé (sans les données internes). */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/share/[token]">) => {
  const { token } = await ctx.params;
  if (!token || token.length < 16) throw new HttpError(404, "Lien invalide");
  const [report] = await repo().select<ReportRow>("reports", { eq: { share_token: token } });
  if (!report) throw new HttpError(404, "Ce lien de partage n'existe plus");
  const bundle = await reportBundle(report);
  return {
    ...bundle,
    report: { ...bundle.report, org_id: "", created_by: "", share_token: null },
    items: bundle.items.map((i) => ({ ...i, session_id: null, error: null })),
  };
});
