"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { money, revenue } from "@/components/agents/kit";
import type { OpportunityRow } from "@/components/agents/Opportunity";
import { Delta } from "@/components/ui";
import { ZONE_LABEL, formatLabel } from "@/lib/normalize";
import type { GrowthAnalysis } from "@/lib/growth";

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

