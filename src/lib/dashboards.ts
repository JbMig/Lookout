import "server-only";
import { repo } from "./repo";
import { loadUniverse, type Universe } from "./universe";
import type { GrowthAnalysis } from "./growth";
import { HttpError } from "./auth";

type Raw = Record<string, unknown>;

export interface DashboardBundle {
  report: { id: string; title: string; createdAt: string; shareSlug: string | null; config: Record<string, unknown> };
  universe: Universe;
  analysis: (GrowthAnalysis & { id: string }) | null;
  opportunities: Raw[];
}

export const isAgentDashboard = (r: Raw) => (r.config as Raw | null)?.kind === "agents";

/** Dashboard (Agent 4) : la définition vit dans reports, les chiffres sont lus en direct dans Supabase. */
export async function dashboardBundle(report: Raw, opts: { publicView?: boolean } = {}): Promise<DashboardBundle> {
  if (!isAgentDashboard(report)) throw new HttpError(404, "Ce dashboard n'existe pas");
  const ids = (report.analysis_ids as string[] | null) ?? [];
  const [universe, analyses, opportunities] = await Promise.all([
    loadUniverse(),
    ids.length ? repo().select<Raw>("analyses", { in: ["id", ids] }) : Promise.resolve([] as Raw[]),
    ids.length ? repo().select<Raw>("growth_opportunities", { in: ["analysis_id", ids], order: ["score", "desc"], limit: 500 }) : Promise.resolve([] as Raw[]),
  ]);
  const a = analyses[0];
  return {
    report: {
      id: String(report.id),
      title: String(report.title),
      createdAt: String(report.created_at),
      shareSlug: opts.publicView ? null : ((report.share_slug as string) ?? null),
      config: (report.config as Record<string, unknown>) ?? {},
    },
    universe,
    analysis: a?.result ? { ...(a.result as GrowthAnalysis), id: String(a.id) } : null,
    opportunities: opportunities.map((o) => ({ ...o, score: Number(o.score) })),
  };
}
