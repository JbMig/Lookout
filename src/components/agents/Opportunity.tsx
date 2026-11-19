"use client";
import Link from "next/link";
import { KIND_LABEL, priorityOf, type OpportunityKind, type Priority } from "@/lib/growth";
import { ZONE_LABEL } from "@/lib/normalize";
import { Packshot, type ProductRef } from "./kit";

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

const MORE_KINDS: Record<string, string> = { prix: "Prix", format: "Format", teinte: "Teintes", ingredient_gap: "Ingrédient", segment_gap: "Segment", winner_to_benchmark: "Best-seller à suivre" };
export const kindLabel = (k: string) => KIND_LABEL[k as OpportunityKind] ?? MORE_KINDS[k] ?? k.replace(/_/g, " ");

export function priority(o: OpportunityRow): Priority {
  const p = o.estimated_impact?.priorite;
  return p === "haute" || p === "moyenne" || p === "basse" ? p : priorityOf(o.score);
}

/** Confiance : nombre (0..1) du moteur intégré ou libellé (« elevee », « moyenne », « faible ») de l'agent. */
export function confidence(o: OpportunityRow): string | null {
  const raw = o.estimated_impact?.confiance ?? o.estimated_impact?.confidence;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return raw.replace(/elevee/i, "élevée");
  }
  const n = Number(raw);
  return raw !== null && raw !== undefined && Number.isFinite(n) ? `${Math.round(n * 100)} %` : null;
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export const oppZone = (o: OpportunityRow) => (typeof o.refs?.zone === "string" ? o.refs.zone : null);

const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

const TONE: Record<Priority, string> = { haute: "bg-bad", moyenne: "bg-amber", basse: "bg-ink-faint" };

export function OpportunityCard({ o, names, links = true }: { o: OpportunityRow; names: Map<string, ProductRef>; links?: boolean }) {
  const pr = priority(o);
  const conf = confidence(o);
  const client = ids(o.refs?.produit_client_ids);
  const rivals = ids(o.refs?.produit_concurrent_ids);
  const zone = oppZone(o);
  const known = (list: string[]) => list.filter((id) => names.has(id));
  const ref = (id: string, href: string) => {
    const p = names.get(id)!;
    const body = (
      <>
        <Packshot src={p.image} alt="" size={32} />
        <span className="min-w-0 text-left leading-tight">
          <span className="block text-[11.5px] font-semibold uppercase tracking-[0.03em] text-ink-faint">{p.brand}</span>
          <span className="block truncate text-[13px] font-medium">{p.name}</span>
        </span>
        {p.price && <span className="ml-auto pl-2 text-[12.5px] tabular-nums text-ink-soft">{p.price}</span>}
      </>
    );
    const cls = "flex min-w-0 items-center gap-2.5 rounded-[10px] border border-line bg-paper py-1.5 pl-1.5 pr-3";
    return links
      ? <Link key={id} href={href} title="Voir la fiche" className={`press ${cls} hover:border-ink-faint`}>{body}</Link>
      : <div key={id} className={cls}>{body}</div>;
  };
  const group = (label: string, list: string[], href: (id: string) => string, total: number) =>
    total > 0 && (
      <div>
        <p className="mb-1.5 text-[12.5px] font-medium text-ink-faint">{label}</p>
        {list.length ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{list.map((id) => ref(id, href(id)))}</div>
        ) : (
          <p className="text-[13px] text-ink-faint">{total} produit{total > 1 ? "s" : ""} cité{total > 1 ? "s" : ""}, introuvable{total > 1 ? "s" : ""} dans les données actuelles.</p>
        )}
      </div>
    );
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
          {conf && <span className="text-ink-faint">Confiance {conf}</span>}
          {zone && <span className="text-ink-faint">· {ZONE_LABEL[zone] ?? zone}</span>}
        </div>
        <h3 className="mt-2 font-semibold leading-snug">{o.title}</h3>
        {o.description && <p className="mt-1 text-sm text-ink-soft">{o.description}</p>}
        {text(o.estimated_impact?.recommandation) && <p className="mt-2 text-sm"><b className="font-medium">Recommandation :</b> {text(o.estimated_impact?.recommandation)}</p>}
        {text(o.refs?.preuve) && <p className="mt-1 text-[12.5px] text-ink-faint">Preuve : {text(o.refs?.preuve)}</p>}
        {(client.length > 0 || rivals.length > 0) && (
          <div className="mt-4 space-y-3 border-t border-line pt-3">
            {group(client.length > 1 ? "Vos produits concernés" : "Votre produit concerné", known(client), (id) => `/catalog#p-${id}`, client.length)}
            {group("Concurrents de référence", known(rivals), (id) => `/competitors#c-${id}`, rivals.length)}
          </div>
        )}
      </div>
    </article>
  );
}
