import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { repo } from "@/lib/repo";

type Raw = Record<string, unknown>;

/** Analyses (Agent 3) et opportunités de croissance associées. */
export const GET = handle(async (req: Request) => {
  await requireUser();
  const all = new URL(req.url).searchParams.get("all") === "1";
  const analyses = await repo().select<Raw>("analyses", { order: ["created_at", "desc"], limit: 30 });
  const latest = analyses.find((a) => a.status === "completed" && a.type === "growth_analysis") ?? null;
  const ids = all ? analyses.map((a) => String(a.id)) : latest ? [String(latest.id)] : [];
  const opportunities = ids.length
    ? await repo().select<Raw>("growth_opportunities", { in: ["analysis_id", ids], order: ["score", "desc"], limit: 1000 })
    : [];
  return {
    analyses: analyses.map((a) => ({
      id: a.id, type: a.type, status: a.status, params: a.params, error: a.error_message,
      createdAt: a.created_at, completedAt: a.completed_at,
      result: a.type === "growth_analysis" ? a.result : null,
    })),
    latestId: latest?.id ?? null,
    opportunities: opportunities.map((o) => ({ ...o, score: Number(o.score) })),
  };
});
