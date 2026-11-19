"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { money, revenue } from "@/components/agents/kit";
import type { OpportunityRow } from "@/components/agents/Opportunity";
import { Delta } from "@/components/ui";
import { ZONE_LABEL, formatLabel } from "@/lib/normalize";
import type { GrowthAnalysis } from "@/lib/growth";
import { parseSynthesis } from "@/lib/synthesis";

export interface AnalysisSummary {
  id: string;
  type: string;
  status: string;
  params: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  result: GrowthAnalysis | null;
}

export function useAnalyses(all = false) {
  const [data, setData] = useState<{ analyses: AnalysisSummary[]; latestId: string | null; opportunities: OpportunityRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api<NonNullable<typeof data>>(`/api/analyses${all ? "?all=1" : ""}`).then(setData).catch((e) => setError(e.message)), [all]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const running = data?.analyses.some((a) => a.status === "running" || a.status === "pending");
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [running, load]);
  return { data, error, load };
}

const pct = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

export function ComparisonTable({ a }: { a: GrowthAnalysis }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-[12.5px] text-ink-faint">
          <tr><th className="py-2 pl-5 font-medium">Votre produit</th><th className="font-medium">Format · zone</th><th className="text-right font-medium">Prix</th><th className="text-right font-medium">Médiane marché</th><th className="text-right font-medium">Écart prix</th><th className="text-right font-medium">Teintes (vous / top 5)</th><th className="pr-5 text-right font-medium">Concurrents</th></tr>
        </thead>
        <tbody>
          {a.comparison.map((c) => (
            <tr key={c.id} className="border-t border-line">
              <td className="py-2 pl-5 font-medium">{c.name}</td>
              <td className="text-ink-soft">{formatLabel(c.format)} · {c.zone ? ZONE_LABEL[c.zone] : "—"}</td>
              <td className="text-right tabular-nums">{money(c.price, c.currency)}</td>
              <td className="text-right tabular-nums">{money(c.marketMedian, c.currency)}</td>
              <td className="text-right tabular-nums"><Delta value={pct(c.priceGapPct)} /></td>
              <td className="text-right tabular-nums">{c.shadeCount} / {c.marketShades ?? "—"}</td>
              <td className="pr-5 text-right tabular-nums">{c.competitors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FormatsTable({ a }: { a: GrowthAnalysis }) {
  return (
    <ul className="divide-y divide-line">
      {[...a.formats].sort((x, y) => (y.growth ?? -9) - (x.growth ?? -9)).map((f) => (
        <li key={`${f.zone}-${f.format}-${f.currency}`} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span><b className="font-medium">{formatLabel(f.format)}</b> <span className="text-ink-faint">· {ZONE_LABEL[f.zone]}</span></span>
          <span className="flex items-center gap-3 tabular-nums">
            {revenue(f.salesCur, f.currency)} <Delta value={f.growth === null ? null : Math.round(f.growth * 1000) / 10} />
            <span className={`rounded-full px-2 py-0.5 text-[12px] ${f.clientPresent ? "bg-ground text-ink-soft" : "bg-amber-wash text-amber-dark"}`}>{f.clientPresent ? "présent" : "absent"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function IngredientsList({ a }: { a: GrowthAnalysis }) {
  if (!a.ingredients.length) return <p className="text-sm text-ink-faint">Pas assez de compositions de produits en croissance.</p>;
  return (
    <ul className="space-y-2">
      {a.ingredients.slice(0, 10).map((i) => (
        <li key={i.name} className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-3 text-sm">
          <span className="truncate">{i.name}</span>
          <span className="h-2 rounded-full bg-line-soft"><span className="block h-full rounded-full bg-night" style={{ width: `${Math.round(i.share * 100)}%` }} /></span>
          <span className={`text-[12px] ${i.client ? "text-ok" : "text-amber-dark"}`}>{Math.round(i.share * 100)} % · {i.client ? "chez vous" : "absent"}</span>
        </li>
      ))}
    </ul>
  );
}


/** Synthèse lisible : phrase d'ouverture, périmètre, constats numérotés, remarques. */
export function SynthesisCard({ text, date, meta, opportunities, high }: { text: string; date: string; meta: string[]; opportunities: number; high: number }) {
  const p = parseSynthesis(text);
  return (
    <section className="rounded-[14px] border border-line bg-paper p-5 sm:p-6" aria-labelledby="synthese-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="synthese-title" className="text-base font-semibold">Synthèse</h2>
        <p className="text-[13px] text-ink-faint">{[`Analyse du ${date}`, ...meta].join(" · ")}</p>
      </div>
      {p.lead && <p className="mt-3 max-w-[70ch] text-[17px] font-medium leading-snug tracking-[-0.01em]">{p.lead}</p>}
      {p.scope && <p className="mt-2 max-w-[80ch] text-[13.5px] text-ink-soft"><span className="font-medium text-ink">Périmètre : </span>{p.scope}</p>}
      <div className="mt-4 flex flex-wrap gap-2 text-[12.5px]">
        {p.findings.length > 0 && <span className="rounded-full bg-ground px-2.5 py-1 font-medium">{p.findings.length} constat{p.findings.length > 1 ? "s" : ""}</span>}
        {opportunities > 0 && <span className="rounded-full bg-ground px-2.5 py-1 font-medium">{opportunities} opportunité{opportunities > 1 ? "s" : ""}</span>}
        {high > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-ground px-2.5 py-1 font-medium"><i className="h-2 w-2 rounded-full bg-bad" aria-hidden />{high} de priorité haute</span>}
      </div>
      {p.findings.length > 0 && (
        <ol className="mt-5 space-y-3">
          {p.findings.map((f, i) => (
            <li key={i} className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-night text-[13px] font-semibold tabular-nums text-white" aria-hidden>{i + 1}</span>
              <p className="max-w-[85ch] pt-0.5 text-[15px] leading-relaxed">{f}</p>
            </li>
          ))}
        </ol>
      )}
      {p.notes.length > 0 && (
        <div className="mt-5 rounded-[10px] bg-ground px-4 py-3">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.04em] text-ink-faint">À noter</p>
          <ul className="mt-1.5 space-y-1 text-[14px] text-ink-soft">{p.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
