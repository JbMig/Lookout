"use client";
import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { fmtDate } from "@/lib/client";
import { Private } from "@/components/Session";
import { StatusBadge } from "@/components/StatusBadge";
import { AgentButton, SettingsBanner, namesOf, useUniverse } from "@/components/agents/kit";
import { OpportunityCard } from "@/components/agents/Opportunity";
import { ComparisonTable, FormatsTable, IngredientsList, useAnalyses } from "@/components/agents/AnalysisParts";
import { Card, CardHead, Empty, ErrorText, PageHeader, PageSkeleton } from "@/components/ui";
import type { GrowthAnalysis } from "@/lib/growth";

const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function Analysis() {
  const { data, error, load } = useAnalyses();
  const u = useUniverse();
  const names = useMemo(() => namesOf(u.data), [u.data]);
  if (!data) return error ? <ErrorText>{error}</ErrorText> : <PageSkeleton />;
  const latest = data.analyses.find((a) => a.id === data.latestId) ?? null;
  const running = data.analyses.find((a) => a.status === "running" || a.status === "pending");
  // Le résultat vient du moteur intégré (summary, comparison…) ou de l'Agent 3 externe (synthese, top_3, limites).
  const r = (latest?.result ?? null) as (Partial<GrowthAnalysis> & { synthese?: string; top_3?: unknown; limites?: unknown }) | null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analyse"
        meta={<span>Comparaison de votre catalogue au marché : prix, formats, teintes et ingrédients</span>}
        actions={<AgentButton agent="3" label="Lancer l'analyse" onDone={() => { void load(); void u.reload(); }} />}
      />
      <SettingsBanner />
      {running && <p className="rounded-[10px] border border-line bg-paper px-4 py-2.5 text-sm" role="status"><StatusBadge status="running" /> <span className="ml-2">Analyse lancée le {fmtDate(running.createdAt)}, la page se met à jour toute seule.</span></p>}
      {!r ? (
        <Empty title="Aucune analyse pour l'instant">Lancez l&apos;analyse une fois le catalogue audité et le marché enrichi.</Empty>
      ) : (
        <>
          <Card>
            <CardHead title="Synthèse" sub={`Analyse du ${fmtDate(latest!.createdAt)}${r.period?.cur ? ` · ventes ${r.period.prev ?? "?"} → ${r.period.cur}` : ""}`} />
            <p className="max-w-[75ch] text-[15px] leading-relaxed">{r.summary ?? r.synthese ?? "Pas de synthèse."}</p>
          </Card>
          {(list(r.top_3).length > 0 || list(r.limites).length > 0) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {list(r.top_3).length > 0 && (
                <Card><CardHead title="Points clés" /><ol className="list-decimal space-y-2 pl-5 text-sm">{list(r.top_3).map((t, i) => <li key={i}>{t}</li>)}</ol></Card>
              )}
              {list(r.limites).length > 0 && (
                <Card><CardHead title="Limites des données" sub="Relevées par l'agent pendant l'analyse" /><ul className="list-disc space-y-1.5 pl-5 text-[13.5px] text-ink-soft">{list(r.limites).map((t, i) => <li key={i}>{t}</li>)}</ul></Card>
              )}
            </div>
          )}
          {Array.isArray(r.comparison) && (
            <Card flush>
              <div className="px-5 pt-5"><CardHead title="Catalogue vs marché" sub="Prix comparés dans la même devise, au sein du même format et de la même zone" /></div>
              {r.comparison.length ? <ComparisonTable a={r as GrowthAnalysis} /> : <p className="px-5 pb-5 text-sm text-ink-faint">Catalogue vide.</p>}
            </Card>
          )}
          {(Array.isArray(r.formats) || Array.isArray(r.ingredients)) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {Array.isArray(r.formats) && <Card><CardHead title="Formats" sub="Ventes par format et présence de votre catalogue" /><FormatsTable a={r as GrowthAnalysis} /></Card>}
              {Array.isArray(r.ingredients) && <Card><CardHead title="Ingrédients des concurrents en croissance" sub="Part des produits qui les mettent en avant" /><IngredientsList a={r as GrowthAnalysis} /></Card>}
            </div>
          )}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Opportunités prioritaires</h2>
              <Link href="/opportunities" className="press inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">Toutes les opportunités ({data.opportunities.length})<ArrowRight size={14} aria-hidden /></Link>
            </div>
            {data.opportunities.slice(0, 5).map((o) => <OpportunityCard key={o.id} o={o} names={names} />)}
          </section>
        </>
      )}
      <Card>
        <CardHead title="Historique" />
        <ul className="divide-y divide-line text-sm">
          {data.analyses.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{fmtDate(a.createdAt)} · <span className="text-ink-soft">{a.type.replace(/_/g, " ")}</span>{a.error && <span className="text-bad"> · {a.error}</span>}</span>
              <StatusBadge status={a.status} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export default function AnalysisPage() {
  return <Private><Analysis /></Private>;
}
