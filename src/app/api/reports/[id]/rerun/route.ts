import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { checkQuota } from "@/lib/quota";
import { loadReport, reportBundle } from "@/lib/reports";
import type { ClientProductRow, ReportItemRow, ReportRow } from "@/lib/types";

/** Relance la même analyse (mêmes données et mêmes critères) pour suivre l'évolution. */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/reports/[id]/rerun">) => {
  const user = await requireUser("analyst");
  const { id } = await ctx.params;
  const source = await reportBundle(await loadReport(id, user));
  const max = await checkQuota(user);
  const db = repo();
  const date = new Date().toLocaleDateString("fr-FR");
  const [report] = await db.insert<ReportRow>("reports", [
    {
      org_id: user.orgId, created_by: user.userId, name: `${source.report.name} (relance du ${date})`,
      category: source.report.category, params: source.report.params, status: "collecting",
    },
  ]);
  await db.insert<ReportItemRow>(
    "report_items",
    source.items.slice(0, max).map((i, position) => ({ report_id: report.id, org_id: user.orgId, position, circana: i.circana, status: "pending" as const })),
  );
  if (source.clientProducts.length) {
    await db.insert<ClientProductRow>("client_products", source.clientProducts.map((c) => ({ report_id: report.id, org_id: user.orgId, data: c.data })));
  }
  return { id: report.id };
});
