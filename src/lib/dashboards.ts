import "server-only";
import { HttpError } from "./auth";
import { isAgent4Data } from "./agent4";

type Raw = Record<string, unknown>;

/**
 * radar : dashboard Market Radar calculé par le site (chiffres lus en direct, radar.ts).
 * agent4 : rapport JSON écrit par l'agent Holo « bench-dashboard-creation » dans reports.data.
 */
export type DashboardFormat = "radar" | "agent4";

export interface DashboardMeta {
  id: string;
  title: string;
  createdAt: string;
  status: string;
  shareSlug: string | null;
  config: Record<string, unknown>;
  format: DashboardFormat;
  data: Record<string, unknown> | null;
  error: string | null;
}

const cfg = (r: Raw) => (r.config as Raw | null) ?? {};

/** Rapport de l'Agent 4 Holo : ligne préparée par le site (kind « holo ») ou JSON reconnu dans data. */
export const isHoloDashboard = (r: Raw) => cfg(r).kind === "holo" || isAgent4Data(r.data);

export const isAgentDashboard = (r: Raw) => cfg(r).kind === "agents" || isHoloDashboard(r);

export function dashboardMeta(report: Raw, opts: { publicView?: boolean } = {}): DashboardMeta {
  if (!isAgentDashboard(report)) throw new HttpError(404, "Ce dashboard n'existe pas");
  const holo = isHoloDashboard(report);
  return {
    id: String(report.id),
    title: String(report.title),
    createdAt: String(report.created_at),
    status: String(report.status ?? "ready"),
    shareSlug: opts.publicView ? null : ((report.share_slug as string) ?? null),
    config: cfg(report),
    format: holo ? "agent4" : "radar",
    data: holo ? ((report.data as Raw) ?? {}) : null,
    error: (report.error_message as string) ?? null,
  };
}
