"use client";
import Link from "next/link";
import { KIND_LABEL, priorityOf, type OpportunityKind, type Priority } from "@/lib/growth";
import { ZONE_LABEL } from "@/lib/normalize";

export interface OpportunityRow {
  id: string;
  analysis_id: string;
  kind: string;
  title: string;
  description: string | null;
  score: number;
  estimated_impact: Record<string, unknown> | null;
  refs: Record<string, unknown> | null;
  created_at: string;
}

export const kindLabel = (k: string) => KIND_LABEL[k as OpportunityKind] ?? k.replace(/_/g, " ");

export function priority(o: OpportunityRow): Priority {
  const p = o.estimated_impact?.priorite;
  return p === "haute" || p === "moyenne" || p === "basse" ? p : priorityOf(o.score);
}

export function confidence(o: OpportunityRow): number | null {
  const c = Number(o.estimated_impact?.confiance ?? o.estimated_impact?.confidence);
  return Number.isFinite(c) ? c : null;
}

export const oppZone = (o: OpportunityRow) => (typeof o.refs?.zone === "string" ? o.refs.zone : null);

const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

const TONE: Record<Priority, string> = { haute: "bg-bad", moyenne: "bg-amber", basse: "bg-ink-faint" };

export function OpportunityCard({ o, names, links = true }: { o: OpportunityRow; names: Map<string, string>; links?: boolean }) {
  const pr = priority(o);
  const conf = confidence(o);
  const client = ids(o.refs?.produit_client_ids);
  const rivals = ids(o.refs?.produit_concurrent_ids);
  const zone = oppZone(o);
  const ref = (id: string, href: string) =>
    links ? <Link key={id} href={href} className="rounded-full border border-line px-2.5 py-0.5 text-[12.5px] hover:border-ink-faint">{names.get(id) ?? "Produit"}</Link>
      : <span key={id} className="rounded-full border border-line px-2.5 py-0.5 text-[12.5px]">{names.get(id) ?? "Produit"}</span>;
  return (
    <article className="grid gap-4 rounded-[14px] border border-line bg-paper p-5 md:grid-cols-[88px_minmax(0,1fr)]">
      <div className="flex items-center gap-3 md:flex-col md:items-start">
        <p className="text-[30px] font-semibold leading-none tabular-nums tracking-[-0.03em]">{Math.round(o.score * 100)}</p>
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line-soft" aria-hidden><div className="h-full rounded-full bg-night" style={{ width: `${Math.round(o.score * 100)}%` }} /></div>
        <p className="text-[12px] text-ink-faint">score / 100</p>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          <span className="rounded-full bg-night px-2.5 py-0.5 font-medium text-white">{kindLabel(o.kind)}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 font-medium"><i className={`h-2 w-2 rounded-full ${TONE[pr]}`} aria-hidden />Priorité {pr}</span>
          {conf !== null && <span className="text-ink-faint">Confiance {Math.round(conf * 100)} %</span>}
          {zone && <span className="text-ink-faint">· {ZONE_LABEL[zone] ?? zone}</span>}
        </div>
        <h3 className="mt-2 font-semibold leading-snug">{o.title}</h3>
        {o.description && <p className="mt-1 text-sm text-ink-soft">{o.description}</p>}
        {(client.length > 0 || rivals.length > 0) && (
          <div className="mt-3 space-y-1.5 text-[12.5px]">
            {client.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-ink-faint">Votre produit :</span>{client.map((id) => ref(id, `/catalog#p-${id}`))}</div>}
            {rivals.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-ink-faint">Concurrents :</span>{rivals.map((id) => ref(id, `/competitors#c-${id}`))}</div>}
          </div>
        )}
      </div>
    </article>
  );
}
