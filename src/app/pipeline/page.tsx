"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Circle, Loader2, Play, XCircle, Clock3, Send } from "lucide-react";
import { fmtDateTime as fmtDate } from "@/lib/client";
import { Private } from "@/components/Session";
import { StatusBadge } from "@/components/StatusBadge";
import { launchAgent, useAgentRuns, useUniverse } from "@/components/agents/kit";
import { AGENTS, type AgentId, type AgentRun } from "@/lib/agent-runs";
import { Card, CardHead, Empty, PageHeader, PageSkeleton, btnAccent } from "@/components/ui";

const ORDER: AgentId[] = ["0", "1", "2", "2.5", "3", "4"];

function StepIcon({ run, active }: { run: AgentRun | undefined; active: boolean }) {
  if (active) return <Loader2 size={20} className="animate-spin text-night" aria-label="En cours" />;
  if (!run) return <Circle size={20} className="text-line" aria-label="À faire" />;
  if (run.status === "completed") return <CheckCircle2 size={20} className="text-ok" aria-label="Terminé" />;
  if (run.status === "failed") return <XCircle size={20} className="text-bad" aria-label="Échec" />;
  if (run.status === "started") return <Send size={18} className="text-amber-dark" aria-label="Transmis" />;
  return <Clock3 size={19} className="text-ink-faint" aria-label="Demandé" />;
}

function Pipeline() {
  const { runs, link, refresh } = useAgentRuns();
  const { data, reload } = useUniverse();
  const [current, setCurrent] = useState<AgentId | null>(null);
  const [live, setLive] = useState<{ id: string; runs: AgentRun[] } | null>(null);

  const last = useMemo(() => {
    if (live) return live;
    const id = runs?.find((r) => r.pipelineId)?.pipelineId;
    return id ? { id, runs: runs!.filter((r) => r.pipelineId === id) } : null;
  }, [runs, live]);

  if (!runs) return <PageSkeleton />;
  const byAgent = (a: AgentId) => last?.runs.find((r) => r.agent === a);
  const done = ORDER.filter((a) => byAgent(a)).length;
  const dashboardLink = byAgent("4")?.status === "completed" ? byAgent("4")!.link : null;
  const errors = (last?.runs ?? []).filter((r) => r.status === "failed");

  async function runAll() {
    const id = crypto.randomUUID();
    const acc: AgentRun[] = [];
    setLive({ id, runs: acc });
    for (const a of ORDER) {
      setCurrent(a);
      try {
        acc.unshift(await launchAgent(a, { pipelineId: id }));
      } catch (e) {
        acc.unshift({ id: `${a}-${Date.now()}`, agent: a, status: "failed", at: new Date().toISOString(), finishedAt: new Date().toISOString(), by: null, via: "integre", message: (e as Error).message, link: null, pipelineId: id });
      }
      setLive({ id, runs: [...acc] });
    }
    setCurrent(null);
    await refresh();
    setLive(null);
    void reload();
  }

  const facts: Record<AgentId, string | null> = data
    ? {
        "0": `${data.catalog.length} produits au catalogue`,
        "1": `${data.sales.length} lignes de ventes (${data.years.prev ?? "?"} → ${data.years.cur ?? "?"})`,
        "2": `${data.market.filter((m) => m.status === "enriched" || m.enrichedAt).length} / ${data.market.length} produits enrichis`,
        "2.5": `${data.enrichment.done} tâches terminées, ${data.enrichment.queued} en attente`,
        "3": null,
        "4": null,
      }
    : { "0": null, "1": null, "2": null, "2.5": null, "3": null, "4": null };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        meta={<span>Les six agents, dans l&apos;ordre : catalogue, ventes, marché, analyse, dashboard</span>}
        actions={
          <button type="button" onClick={runAll} disabled={!!current} className={`${btnAccent} disabled:opacity-60`}>
            {current ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Play size={15} aria-hidden />}
            {current ? `Étape ${ORDER.indexOf(current) + 1}/${ORDER.length} en cours…` : "Lancer le pipeline complet"}
          </button>
        }
      />
      {link === "aucun" && (
        <p className="rounded-[10px] border border-line bg-paper px-4 py-2.5 text-sm text-ink-soft">
          Les agents navigateur (0, 2 et 2.5) ne sont pas reliés au site : leurs demandes sont notées ici pour l&apos;équipe. L&apos;import Circana, l&apos;analyse et le dashboard s&apos;exécutent directement.
        </p>
      )}
      <Card>
        <CardHead
          title={last ? `Dernier passage · ${done}/${ORDER.length} étapes` : "Aucun passage complet"}
          sub={last ? `Lancé le ${fmtDate(last.runs.at(-1)?.at ?? new Date().toISOString())}` : "Lancez le pipeline pour enchaîner les agents."}
        />
        <div className="mb-5 h-2 overflow-hidden rounded-full bg-line-soft" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={ORDER.length} aria-label="Étapes du pipeline">
          <div className="h-full rounded-full bg-night transition-[width] duration-500" style={{ width: `${(done / ORDER.length) * 100}%` }} />
        </div>
        <ol className="space-y-1">
          {ORDER.map((a, n) => {
            const info = AGENTS.find((x) => x.id === a)!;
            const run = byAgent(a);
            return (
              <li key={a} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-[10px] px-2 py-3 sm:grid-cols-[28px_minmax(0,1fr)_auto]">
                <StepIcon run={run} active={current === a} />
                <div className="min-w-0">
                  <p className="font-medium">{n + 1}. {info.name} <span className="font-normal text-ink-faint">· Agent {a}</span></p>
                  <p className="text-[13px] text-ink-soft">{run?.message || facts[a] || `Écrit dans ${info.produces}`}</p>
                  {run?.link && run.link.startsWith("http") && <a href={run.link} target="_blank" rel="noreferrer" className="text-[13px] underline underline-offset-4">Voir l&apos;agent travailler</a>}
                </div>
                <div className="col-start-2 flex items-center gap-3 sm:col-start-3">
                  {run && <StatusBadge status={run.status} />}
                  <Link href={info.page} className="text-[13px] font-medium text-ink-soft underline-offset-4 hover:underline">Ouvrir</Link>
                </div>
              </li>
            );
          })}
        </ol>
        {dashboardLink && (
          <Link href={dashboardLink} className={`${btnAccent} mt-5`}>Ouvrir le dashboard généré<ArrowRight size={15} aria-hidden /></Link>
        )}
      </Card>
      <Card>
        <CardHead title="Journal des erreurs" sub="Par étape, pour le dernier passage" />
        {errors.length ? (
          <ul className="space-y-2 text-sm">
            {errors.map((r) => <li key={r.id} className="rounded-[10px] bg-[#fbeeee] px-3 py-2"><b>Agent {r.agent}</b> · {fmtDate(r.at)} · <span className="text-bad">{r.message}</span></li>)}
          </ul>
        ) : <p className="text-sm text-ink-faint">Aucune erreur.</p>}
      </Card>
      <Card>
        <CardHead title="Tous les déclenchements" sub="Boutons des pages et pipeline" />
        {runs.length ? (
          <ul className="divide-y divide-line text-sm">
            {runs.slice(0, 25).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">Agent {r.agent} · {fmtDate(r.at)}{r.by ? ` · ${r.by}` : ""} <span className="text-ink-soft">· {r.message}</span></span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        ) : <Empty title="Aucun agent lancé depuis le site" />}
      </Card>
    </div>
  );
}

export default function PipelinePage() {
  return <Private><Pipeline /></Private>;
}
