"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { Sparkles } from "lucide-react";
import { Card, CardHead, ErrorText, Pill, btnAccent, inputCls } from "@/components/ui";
import { SocialChart } from "./SocialChart";
import type { ReponsePrisme } from "@/lib/prisme";

const EXEMPLES = [
  "Que devrait lancer L'Oréal sur ce sujet ? Qu'est-ce qui marche, et que disent les gens des marques ?",
  "Que disent les clientes du packaging et du prix ?",
  "Comment se situent les concurrents face aux marques L'Oréal ?",
  "Quels hashtags et quels formats faut-il viser pour un lancement ?",
];

const LIBELLES: Record<string, string> = {
  scores_marques: "Scores par marque", top_hashtags: "Hashtags", top_produits: "Produits", aspects: "Ce qu'on en dit",
  verbatims: "Verbatims", formats_et_contenus: "Formats et contenus", recherche_google: "Recherche Google",
  recherches_montantes: "Recherches montantes", videos_phares: "Vidéos phares", creer_graphique: "Graphique",
};

/** Prisme : agent analyste autonome (LLM Hugging Face + outils en lecture seule sur Supabase), indépendant de n8n. */
export function PrismePanel({ veilleId }: { veilleId: string }) {
  const [question, setQuestion] = useState(EXEMPLES[0]);
  const [r, setR] = useState<ReponsePrisme | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lancer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setR(null);
    try {
      setR(await api<ReponsePrisme>(`/api/social/${veilleId}/prisme`, { method: "POST", json: { question } }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-night/20">
      <CardHead title={<span className="inline-flex items-center gap-2"><Sparkles size={17} aria-hidden />Prisme, l&apos;agent analyste</span>}
        sub="Posez une question : Prisme choisit lui-même quelles données consulter dans Supabase, puis répond avec des graphiques (LLM Hugging Face)." />
      <form onSubmit={lancer} className="space-y-3">
        <textarea className={`${inputCls} min-h-[72px]`} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} />
        <div className="flex flex-wrap items-center gap-2">
          {EXEMPLES.slice(1).map((q) => (
            <button type="button" key={q} onClick={() => setQuestion(q)} className="rounded-full border border-line px-3 py-1 text-[13px] text-ink-soft hover:border-[#cfd4dc]">{q}</button>
          ))}
          <button className={`${btnAccent} ml-auto`} disabled={busy || question.trim().length < 3}>
            <Sparkles size={16} aria-hidden />{busy ? "Prisme analyse… (20-60 s)" : "Analyser avec Prisme"}
          </button>
        </div>
      </form>
      {error && <ErrorText>{error}</ErrorText>}

      {r && (
        <div className="mt-6 space-y-6">
          {!!r.etapes.length && (
            <div>
              <p className="mb-2 text-[12.5px] font-semibold text-ink-faint">Ce que Prisme a consulté</p>
              <ol className="flex flex-wrap gap-2">
                {r.etapes.map((e, i) => <li key={i}><Pill tone={e.outil === "creer_graphique" ? "wait" : "night"}>{i + 1}. {LIBELLES[e.outil] ?? e.outil}{e.outil !== "creer_graphique" ? ` · ${e.lignes} lignes` : ""}</Pill></li>)}
              </ol>
            </div>
          )}
          <div>
            <p className="whitespace-pre-line text-[15px] leading-relaxed">{r.reponse}</p>
            {!!r.recommandations.length && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{r.recommandations.map((x, i) => <li key={i}>{x}</li>)}</ul>}
            <p className="mt-3 text-[12.5px] text-ink-faint">{r.secours ? "Modèles indisponibles : analyse enregistrée affichée." : `Modèle : ${r.modele} · chiffres issus uniquement des données consultées.`}</p>
          </div>
          {!!r.graphiques.length && (
            <div className="grid gap-6 lg:grid-cols-2">
              {r.graphiques.map((g) => (
                <div key={g.id} className="rounded-[12px] border border-line p-4">
                  <p className="font-semibold">{g.titre}</p>
                  {g.lecture && <p className="mb-3 mt-0.5 text-[13px] text-ink-faint">{g.lecture}</p>}
                  <SocialChart g={g} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
