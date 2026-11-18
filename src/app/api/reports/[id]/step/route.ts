import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { loadReport, reportBundle } from "@/lib/reports";
import { step } from "@/lib/pipeline";

export const maxDuration = 300;

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/reports/[id]/step">) => {
  await requireUser();
  const { id } = await ctx.params;
  const retry = new URL(req.url).searchParams.get("retry") === "1";
  return reportBundle(await step(await loadReport(id), { retry }));
});
