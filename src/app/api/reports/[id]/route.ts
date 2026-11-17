import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { loadReport, reportBundle } from "@/lib/reports";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/reports/[id]">) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return reportBundle(await loadReport(id, user));
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/reports/[id]">) => {
  const user = await requireUser("admin");
  const { id } = await ctx.params;
  const report = await loadReport(id, user);
  const db = repo();
  // Supabase supprime en cascade ; en mode démo on nettoie à la main.
  for (const i of await db.select<{ id: string }>("report_items", { eq: { report_id: report.id } })) await db.remove("report_items", i.id);
  for (const c of await db.select<{ id: string }>("client_products", { eq: { report_id: report.id } })) await db.remove("client_products", c.id);
  await db.remove("reports", report.id);
  return { ok: true };
});
