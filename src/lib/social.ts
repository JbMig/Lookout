import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { config, isDemo } from "./config";
import { HttpError } from "./auth";

/**
 * Social listening (partie Romane) : veilles par sujet sur TikTok, Instagram, YouTube et Google.
 * La collecte et l'analyse tournent hors de l'application (n8n → job Hugging Face) et écrivent dans
 * les tables sl_* de Supabase. Ici : lancer une veille (webhook n8n) et lire ses résultats.
 * Variables d'environnement (serveur uniquement) : N8N_VEILLE_URL, N8N_VEILLE_KEY.
 */

export interface Veille {
  id: string;
  sujet: string;
  pays: string;
  statut: "en_cours" | "termine" | "partiel" | "echec";
  etape: string | null;
  demande_par: string | null;
  started_at: string;
  finished_at: string | null;
  stats: { videos?: number; fiches?: number; commentaires?: number; tendances?: number; duree_s?: number } | null;
  cout_usd: number | null;
  erreur: string | null;
  resume: string | null;
  etapes: { etape: string; ok: boolean; latence_s: number; erreur?: string }[] | null;
}

export interface Graphique {
  id: string;
  type: "barres" | "barres_empilees" | "lignes" | "donut";
  titre: string;
  axe_x: string;
  series: { cle: string; nom: string }[];
  donnees: Record<string, string | number | boolean | null>[];
  lecture?: string;
}

export interface Analyse {
  resume: string | null;
  graphiques: Graphique[];
  recommandations: string[] | null;
  limites: string[] | null;
  verbatims: { marque: string; sentiment: string; text: string; likes: number; platform: string }[];
}

export interface Insight {
  rang: number;
  type: string;
  titre: string;
  constat: string;
  preuve: string;
  recommandation: string;
  marques: string[] | null;
  sources: string[] | null;
  confiance: "élevée" | "moyenne" | "faible";
}

export interface ScoreMarque {
  marque: string;
  est_loreal: boolean;
  videos: number;
  vues: number;
  part_de_voix_pct: number;
  sentiment_pondere: number | null;
  commentaires: number;
  wilson_pos: number | null;
  confiance: string;
  plateformes: string[];
}

let client: SupabaseClient | null = null;
export function db() {
  if (isDemo.db) throw new HttpError(503, "Social listening indisponible en mode démo (Supabase non configuré)");
  client ??= createClient(config.supabase.url, config.supabase.serviceKey, { auth: { persistSession: false } });
  return client;
}

export async function listVeilles(): Promise<Veille[]> {
  const { data, error } = await db().from("sl_veilles").select("*").order("started_at", { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as Veille[];
}

export async function getVeille(id: string) {
  const sb = db();
  const [v, a, i, s] = await Promise.all([
    sb.from("sl_veilles").select("*").eq("id", id).maybeSingle(),
    sb.from("sl_analyses").select("contenu, modele, created_at").eq("veille_id", id).maybeSingle(),
    sb.from("sl_insights").select("*").eq("veille_id", id).order("rang"),
    sb.from("sl_brand_scores").select("*").eq("veille_id", id).order("vues", { ascending: false }).limit(30),
  ]);
  if (v.error) throw new Error(v.error.message);
  if (!v.data) throw new HttpError(404, "Veille introuvable");
  return {
    veille: v.data as Veille,
    analyse: (a.data?.contenu ?? null) as Analyse | null,
    insights: (i.data ?? []) as Insight[],
    scores: (s.data ?? []) as ScoreMarque[],
  };
}

export type Mode = "complet" | "economique" | "secours";

/** Lance une veille en arrière-plan via le webhook n8n ; renvoie l'identifiant à suivre dans sl_veilles. */
export async function lancerVeille(input: { sujet: string; pays: string; mode: Mode; demandePar: string }) {
  const url = process.env.N8N_VEILLE_URL;
  const key = process.env.N8N_VEILLE_KEY;
  if (!url || !key) throw new HttpError(503, "Lancement indisponible : N8N_VEILLE_URL / N8N_VEILLE_KEY non configurés");
  const veilleId = `${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}-${randomUUID().slice(0, 4)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Lookout-Key": key },
    body: JSON.stringify({ sujet: input.sujet, pays: input.pays, mode: input.mode, demande_par: input.demandePar, veille_id: veilleId }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new HttpError(502, `n8n a refusé le lancement (${res.status})`);
  // Ligne provisoire : la veille apparaît tout de suite ; le job la met à jour dès son démarrage.
  await db().from("sl_veilles").upsert({ id: veilleId, sujet: input.sujet, pays: input.pays, statut: "en_cours", etape: "lancement", demande_par: input.demandePar });
  return { id: veilleId };
}
