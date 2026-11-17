import { z } from "zod";
import { body, handle } from "@/lib/http";
import { requireStaff } from "@/lib/auth";
import { repo } from "@/lib/repo";

/** Changement d'offre (en attendant le paiement en ligne Stripe). */
export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/admin/orgs/[id]">) => {
  await requireStaff();
  const { id } = await ctx.params;
  const { plan } = z.object({ plan: z.enum(["trial", "pro", "enterprise"]) }).parse(await body(req));
  await repo().update("organizations", id, { plan });
  return { ok: true };
});
