import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { isAgentDashboard, isHoloDashboard } from "@/lib/dashboards";
import { isAgent4Data } from "@/lib/agent4";

type Raw = Record<string, unknown>;

/** Dashboards générés (Agent 4) et anciens rapports d'analyse. */
export const GET = handle(async () => {
  await requireUser();
  const rows = await repo().select<Raw>("reports", { eq: { type: "dashboard" }, order: ["created_at", "desc"], limit: 200 });
  return {
    dashboards: rows.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.created_at,
      status: isHoloDashboard(r) && !isAgent4Data(r.data) ? "pending" : r.status,
      shared: Boolean(r.share_slug),
      kind: isAgentDashboard(r) ? "agents" : "legacy",
    })),
  };
});
