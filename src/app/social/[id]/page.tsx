"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { Private } from "@/components/Session";
import { ArrowLeft } from "lucide-react";
import { Card, CardHead, Empty, ErrorText, PageHeader, PageSkeleton, Pill } from "@/components/ui";
import { SocialChart } from "@/components/social/SocialChart";
import type { Analyse, Insight, ScoreMarque, Veille } from "@/lib/social";

interface Detail { veille: Veille; analyse: Analyse | null; insights: Insight[]; scores: ScoreMarque[] }

const CONFIANCE: Record<string, "ok" | "wait" | "neutral"> = { "élevée": "ok", moyenne: "wait", faible: "neutral" };
const nf = (v: number | null | undefined, d = 0) => (v == null ? "—" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(v));

function VeilleView() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const load = () => api<Detail>(`/api/social/${id}`).then((r) => { if (!stop) setD(r); return r; }).catch((e) => setError(e.message));
    load();
    const t = setInterval(async () => { const r = await load(); if (r && r.veille.statut !== "en_cours") clearInterval(t); }, 15000);
    return () => { stop = true; clearInterval(t); };
  }, [id]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!d) return <PageSkeleton />;
  const { veille: v, analyse: a, insights, scores } = d;

  return (
    <div className="space-y-7">
      <Link href="/social" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"><ArrowLeft size={15} aria-hidden />Toutes les veilles</Link>
      <PageHeader
        title={`${v.sujet} · ${v.pays}`}
        meta={<>
          <span>{fmtDate(v.started_at)}</span>
          {v.stats && <span>{nf(v.stats.videos)} vidéos · {nf(v.stats.commentaires)} commentaires classés</span>}
          {v.stats?.duree_s != null && <span>{Math.round(v.stats.duree_s / 60)} min</span>}
          {v.cout_usd != null && <span>Apify : {nf(v.cout_usd, 2)} $</span>}
          <Pill tone={v.statut === "termine" ? "ok" : v.statut === "en_cours" ? "wait" : v.statut === "echec" ? "bad" : "neutral"}>{v.statut === "en_cours" ? `En cours · ${v.etape ?? ""}` : v.statut}</Pill>
        </>}
      />

      {v.statut === "en_cours" && !a && <Empty title="Veille en cours">Collecte et analyse en arrière-plan. Cette page se met à jour toute seule.</Empty>}

      {a?.resume && (
        <Card className="border-amber/40 bg-amber-wash">
          <CardHead title="En bref" sub="Rédigé par un LLM Hugging Face à partir de chiffres calculés (pas inventés)" />
          <p className="text-[15px] leading-relaxed">{a.resume}</p>
          {!!a.recommandations?.length && (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">{a.recommandations.map((r, i) => <li key={i}>{r}</li>)}</ul>
          )}
        </Card>
      )}

      {!!a?.graphiques?.length && (
        <div className="grid gap-6 lg:grid-cols-2">
          {a.graphiques.map((g) => (
            <Card key={g.id}>
              <CardHead title={g.titre} sub={g.lecture} />
              <SocialChart g={g} />
            </Card>
          ))}
        </div>
      )}

      {!!insights.length && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Insights</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {insights.map((i) => (
              <Card key={i.rang}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Pill tone="night">{i.type}</Pill>
                  <Pill tone={CONFIANCE[i.confiance] ?? "neutral"}>Confiance {i.confiance}</Pill>
                </div>
                <p className="font-semibold">{i.titre}</p>
                <p className="mt-1 text-sm text-ink-soft">{i.constat}</p>
                <p className="mt-2 text-[13px] text-ink-faint"><b>Preuve :</b> {i.preuve}</p>
                <p className="mt-2 text-sm"><b>À faire :</b> {i.recommandation}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {!!scores.length && (
        <Card flush>
          <div className="p-5 pb-0"><CardHead title="Scores par marque" sub="Part de voix pondérée (pubs ×0,5) · sentiment pondéré par les vues (−1 à 1) · Wilson = part d'avis positifs minimale crédible" /></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[12.5px] text-ink-faint">
                <tr>{["Marque", "Part de voix", "Vidéos", "Sentiment", "Commentaires", "Wilson", "Confiance"].map((h) => <th key={h} className="px-5 py-2 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {scores.filter((s) => s.confiance !== "faible").concat(scores.filter((s) => s.confiance === "faible")).slice(0, 15).map((s) => (
                  <tr key={s.marque}>
                    <td className="px-5 py-2 font-medium">{s.marque}{s.est_loreal && <span className="ml-2 rounded bg-amber-wash px-1.5 text-[11px] text-amber-dark">L&apos;Oréal</span>}</td>
                    <td className="px-5 py-2">{nf(s.part_de_voix_pct, 1)} %</td>
                    <td className="px-5 py-2">{nf(s.videos)}</td>
                    <td className="px-5 py-2">{nf(s.sentiment_pondere, 2)}</td>
                    <td className="px-5 py-2">{nf(s.commentaires)}</td>
                    <td className="px-5 py-2">{nf(s.wilson_pos, 2)}</td>
                    <td className="px-5 py-2"><Pill tone={CONFIANCE[s.confiance] ?? "neutral"}>{s.confiance}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!!a?.verbatims?.length && (
        <Card>
          <CardHead title="Ce qu'on en dit" sub="Commentaires les plus aimés (sans pseudo)" />
          <ul className="space-y-3">
            {a.verbatims.map((c, i) => (
              <li key={i} className="border-l-2 pl-3 text-sm" style={{ borderColor: c.sentiment === "positif" ? "#17784F" : "#B33939" }}>
                « {c.text} » <span className="text-ink-faint">· {c.marque} · {c.platform} · {nf(c.likes)} j&apos;aime</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!!a?.limites?.length && (
        <p className="text-[13px] text-ink-faint">Limites : {a.limites.join(" · ")}</p>
      )}
    </div>
  );
}

export default function VeillePage() {
  return (
    <Private>
      <VeilleView />
    </Private>
  );
}
