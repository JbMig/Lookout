import "server-only";
import { db } from "./social";
import { HttpError } from "./auth";
import type { DashboardPrisme, Kpi } from "./prisme-dashboard";
import type { Alertes } from "./alertes";
import type { Reseaux } from "./reseaux";

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

/** Une analyse de l'historique : un dashboard Prisme, ou un relevé des onglets Alertes / Réseaux des marques. */
export type Instantane = { _type: "alertes"; kpis: Kpi[]; veille: { videos: number; commentaires: number }; donnees: Alertes }
  | { _type: "reseaux"; kpis: Kpi[]; veille: { videos: number; commentaires: number }; donnees: Reseaux };
export interface AnalyseComplete extends AnalyseResume {
  resultat: DashboardPrisme | Instantane;
}

const SUJET = { alertes: "Alertes de crise", reseaux: "Réseaux des marques" } as const;

/**
 * Enregistre un relevé des onglets Alertes ou Réseaux des marques dans l'historique (même table que les analyses Prisme),
 * au plus un toutes les 3 heures par onglet pour ne pas remplir l'historique à chaque ouverture.
 */
export async function enregistrerInstantane(type: "alertes" | "reseaux", donnees: Alertes | Reseaux, user: { userId?: string | null; email?: string | null }) {
  const depuis = new Date(Date.now() - 3 * 3600_000).toISOString();
  const { data: recent } = await db().from("prisme_analyses").select("id").eq("sujet", SUJET[type]).gte("created_at", depuis).limit(1);
  if (recent?.length) return null;
  let kpis: Kpi[], titre: string, veille: { videos: number; commentaires: number };
  if (type === "alertes") {
    const a = donnees as Alertes, n = (g: string) => a.alertes.filter((x) => x.gravite === g).length;
    kpis = [
      { id: "crit", label: "alertes critiques", valeur: n("critique") },
      { id: "elev", label: "alertes élevées", valeur: n("élevée") },
      { id: "surv", label: "à surveiller", valeur: n("à surveiller") },
      { id: "marq", label: "marques concernées", valeur: new Set(a.alertes.map((x) => x.marque)).size },
    ];
    titre = a.alertes.length ? `${a.alertes.length} alerte${a.alertes.length > 1 ? "s" : ""} sur les marques du groupe L'Oréal` : "Aucune alerte sur les marques du groupe L'Oréal";
    veille = { videos: a.analyse.videos, commentaires: a.analyse.commentaires };
  } else {
    const r = donnees as Reseaux, top = [...r.marques].sort((x, y) => (y.engagement_moy ?? 0) - (x.engagement_moy ?? 0))[0];
    kpis = [
      { id: "marq", label: "marques analysées", valeur: r.marques.length },
      { id: "pubs", label: "publications", valeur: r.publications },
      { id: "coms", label: "commentaires lus", valeur: r.commentaires },
      ...(top ? [{ id: "eng", label: "meilleur engagement", valeur: top.marque }] : []),
    ];
    titre = `Comptes officiels de ${r.marques.length} marques : ${r.publications} publications analysées`;
    veille = { videos: r.publications, commentaires: r.commentaires };
  }
  const resultat = { _type: type, kpis, veille, donnees } as Instantane;
  const { data, error } = await db().from("prisme_analyses").insert({
    sujet: SUJET[type], pays: null, titre, accroche: null, resultat,
    created_by: user.userId && /^[0-9a-f-]{36}$/i.test(user.userId) ? user.userId : null, created_by_email: user.email ?? null,
  }).select("id").single();
  if (error) throw new Error(`prisme_analyses : ${error.message}`);
  return String(data.id);
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
  const d = data.resultat as DashboardPrisme | Instantane;
  return { ...data, resultat: d, kpis: d.kpis ?? [], videos: d.veille?.videos ?? 0, commentaires: d.veille?.commentaires ?? 0 } as AnalyseComplete;
}

export async function supprimerAnalyse(id: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Cette analyse n'existe pas");
  const { error } = await db().from("prisme_analyses").delete().eq("id", id);
  if (error) throw new HttpError(500, error.message);
}
