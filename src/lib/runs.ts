import "server-only";
import { repo } from "./repo";
import type { AgentRunRow } from "./types";

/** Journalise chaque appel à un service externe (suivi des coûts et des taux d'échec). */
export async function logRun(
  service: AgentRunRow["service"],
  action: string,
  ok: boolean,
  ctx: { orgId?: string | null; reportId?: string | null } = {},
) {
  try {
    await repo().insert<AgentRunRow>("agent_runs", [{ service, action, ok, org_id: ctx.orgId ?? null, report_id: ctx.reportId ?? null }]);
  } catch (e) {
    console.error("logRun", e);
  }
}
