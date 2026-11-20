"use client";
import { useMemo, useState } from "react";
import { Private } from "@/components/Session";
import { namesOf, useUniverse } from "@/components/agents/kit";
import { OpportunityCard, kindLabel, oppZone } from "@/components/agents/Opportunity";
import { useAnalyses } from "@/components/agents/AnalysisParts";
import { Empty, ErrorText, PageHeader, PageSkeleton, controlCls } from "@/components/ui";
import { KIND_LABEL } from "@/lib/growth";

function Opportunities() {
  const [all, setAll] = useState(false);
  const { data, error } = useAnalyses(all);
  const u = useUniverse();
  const names = useMemo(() => namesOf(u.data), [u.data]);
  const [kind, setKind] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [zone, setZone] = useState("all");

  const list = useMemo(
    () => (data?.opportunities ?? [])
      .filter((o) => kind === "all" || o.kind === kind)
      .filter((o) => o.score * 100 >= minScore)
      .filter((o) => zone === "all" || oppZone(o) === zone || (zone === "FR" && oppZone(o) === "EU"))
      .sort((a, b) => b.score - a.score),
    [data, kind, minScore, zone],
  );
  if (!data) return error ? <ErrorText>{error}</ErrorText> : <PageSkeleton />;
  const kinds = [...new Set([...Object.keys(KIND_LABEL), ...data.opportunities.map((o) => o.kind)])];

  return (
    <div className="space-y-6">
      <PageHeader title="Opportunités" meta={<span>{all ? "Toutes les analyses" : "Dernière analyse de croissance"} · triées par score</span>} />
      <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filtres">
        <label className="grid gap-1 text-[12.5px] font-medium text-ink-soft">Type
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={controlCls}>
            <option value="all">Tous</option>
            {kinds.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[12.5px] font-medium text-ink-soft">Zone
          <select value={zone} onChange={(e) => setZone(e.target.value)} className={controlCls}>
            <option value="all">Toutes</option><option value="US">États-Unis</option><option value="EU">Europe</option><option value="FR">France</option>
          </select>
        </label>
        <label className="grid gap-1 text-[12.5px] font-medium text-ink-soft">Score minimum (sur 100) : {minScore}
          <input type="range" min={0} max={90} step={10} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="w-44 accent-night" />
        </label>
        <label className="mb-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="h-4 w-4" />Inclure les analyses précédentes
        </label>
      </div>
      <p className="text-[13px] text-ink-faint">{list.length} opportunité{list.length > 1 ? "s" : ""}</p>
      {!data.opportunities.length ? (
        <Empty title="Aucune opportunité">Lancez l&apos;analyse depuis la page Analyse.</Empty>
      ) : !list.length ? (
        <Empty title="Aucune opportunité ne correspond aux filtres" />
      ) : (
        <div className="space-y-3">{list.map((o) => <OpportunityCard key={o.id} o={o} names={names} />)}</div>
      )}
    </div>
  );
}

export default function OpportunitiesPage() {
  return <Private><Opportunities /></Private>;
}
