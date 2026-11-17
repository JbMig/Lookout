import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { loadReport, reportBundle } from "@/lib/reports";
import { step } from "@/lib/pipeline";

export const maxDuration = 300;

export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/reports/[id]/step">) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await loadReport(id, user);
  return reportBundle(await step(id));
});
