import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { getVeille } from "@/lib/social";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/social/[id]">) => {
  await requireUser();
  const { id } = await ctx.params;
  return getVeille(id);
});
