import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { lireAnalyse, supprimerAnalyse } from "@/lib/prisme-historique";

/** Une analyse Prisme de l'historique, avec son dashboard complet. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/social/[id]">) => {
  await requireUser();
  const { id } = await ctx.params;
  return lireAnalyse(id);
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/social/[id]">) => {
  await requireUser();
  const { id } = await ctx.params;
  await supprimerAnalyse(id);
  return { ok: true };
});
