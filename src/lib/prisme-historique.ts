import "server-only";
import { db } from "./social";
import { HttpError } from "./auth";
import type { DashboardPrisme, Kpi } from "./prisme-dashboard";

/** Historique des recherches Prisme (table prisme_analyses), affiché dans « Social listening ». */

export interface AnalyseResume {
  id: string;
  sujet: string;
  question: string | null;
  pays: string | null;
  titre: string | null;
  accroche: string | null;
  created_at: string;
  created_by_email: string | null;
  kpis: Kpi[];
  videos: number;
  commentaires: number;
}

export interface AnalyseComplete extends AnalyseResume {
  resultat: DashboardPrisme;
}

export async function enregistrerAnalyse(d: DashboardPrisme, opts: { question?: string; pays: string; userId?: string | null; email?: string | null }): Promise<string> {
  const { data, error } = await db()
    .from("prisme_analyses")
    .insert({
      sujet: d.sujet,
      question: opts.question?.trim() || null,
      pays: d.veille?.pays ?? opts.pays,
      veille_id: d.veille?.id ?? null,
      titre: d.titre,
      accroche: d.accroche,
      resultat: d,
      created_by: opts.userId && /^[0-9a-f-]{36}$/i.test(opts.userId) ? opts.userId : null,
      created_by_email: opts.email ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`prisme_analyses : ${error.message}`);
  return String(data.id);
}

const COLONNES = "id, sujet, question, pays, titre, accroche, created_at, created_by_email";

export async function listerAnalyses(): Promise<AnalyseResume[]> {
  const { data, error } = await db()
    .from("prisme_analyses")
    .select(`${COLONNES}, kpis:resultat->kpis, veille:resultat->veille`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new HttpError(500, `Historique indisponible : ${error.message}`);
  return (data ?? []).map((r) => {
    const v = (r.veille ?? {}) as { videos?: number; commentaires?: number };
    return { ...r, kpis: (r.kpis as Kpi[] | null) ?? [], videos: Number(v.videos ?? 0), commentaires: Number(v.commentaires ?? 0) } as AnalyseResume;
  });
}

export async function lireAnalyse(id: string): Promise<AnalyseComplete> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Cette analyse n'existe pas");
  const { data, error } = await db().from("prisme_analyses").select(`${COLONNES}, resultat`).eq("id", id).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Cette analyse n'existe pas (ou a été supprimée)");
  const d = data.resultat as DashboardPrisme;
  return { ...data, resultat: d, kpis: d.kpis ?? [], videos: d.veille?.videos ?? 0, commentaires: d.veille?.commentaires ?? 0 } as AnalyseComplete;
}

export async function supprimerAnalyse(id: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Cette analyse n'existe pas");
  const { error } = await db().from("prisme_analyses").delete().eq("id", id);
  if (error) throw new HttpError(500, error.message);
}
