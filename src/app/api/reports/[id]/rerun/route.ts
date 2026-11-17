import { randomUUID } from "crypto";
import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { loadReport } from "@/lib/reports";
import type { ReportDbRow, StoredItem } from "@/lib/types";

/** Relance la même analyse (mêmes données et mêmes critères) pour suivre l'évolution. */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/reports/[id]/rerun">) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const source = await loadReport(id);
  const now = new Date().toISOString();
  const items: StoredItem[] = (source.data?.items ?? []).map((i) => ({
    id: randomUUID(), position: i.position, circana: i.circana, status: "pending", method: null, siteDomain: null,
    marketProductId: null, jobId: null, error: null, updatedAt: now,
  }));
  const [report] = await repo().insert<ReportDbRow>("reports", [
    {
      title: `${source.title} (relance du ${new Date().toLocaleDateString("fr-FR")})`,
      type: "dashboard",
      status: "generating",
      config: source.config,
      data: { phase: "collecting", items },
      created_by: user.userId,
    },
  ]);
  return { id: report.id };
});
