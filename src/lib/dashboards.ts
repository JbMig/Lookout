import "server-only";
import { HttpError } from "./auth";

type Raw = Record<string, unknown>;

export interface DashboardMeta { id: string; title: string; createdAt: string; shareSlug: string | null; config: Record<string, unknown> }

export const isAgentDashboard = (r: Raw) => (r.config as Raw | null)?.kind === "agents";

/** Dashboard (Agent 4) : la ligne reports porte le titre et le lien de partage ; les chiffres sont lus en direct (radar.ts). */
export function dashboardMeta(report: Raw, opts: { publicView?: boolean } = {}): DashboardMeta {
  if (!isAgentDashboard(report)) throw new HttpError(404, "Ce dashboard n'existe pas");
  return {
    id: String(report.id),
    title: String(report.title),
    createdAt: String(report.created_at),
    shareSlug: opts.publicView ? null : ((report.share_slug as string) ?? null),
    config: (report.config as Record<string, unknown>) ?? {},
  };
}
