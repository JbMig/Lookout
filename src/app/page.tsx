"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { Private, useSession } from "@/components/Session";
import { StatusBadge } from "@/components/StatusBadge";
import { ChevronRight, Plus, Search } from "lucide-react";
import { Card, Empty, PageHeader, Skeleton, btnAccent, controlCls } from "@/components/ui";
import type { AnalysisParams, ReportStatus } from "@/lib/types";

interface ReportSummary {
  id: string;
  name: string;
  category: string;
  status: ReportStatus;
  created_at: string;
  params: AnalysisParams;
  productCount: number | null;
  completeCount: number | null;
  awaitingTeam: number | null;
}

function History() {
  const { me } = useSession();
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    api<{ reports: ReportSummary[] }>("/api/reports").then((r) => setReports(r.reports)).catch((e) => setError(e.message));
  }, []);

  const filtered = (reports ?? []).filter((r) => `${r.name} ${r.category}`.toLowerCase().includes(q.toLowerCase()));
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = (reports ?? []).filter((r) => r.created_at.startsWith(month)).length;
  const first = me!.user.fullName?.split(" ")[0];

  return (
    <div className="space-y-7">
      <PageHeader
        title={first ? `Bonjour ${first}` : "Vos analyses"}
        meta={reports ? <span>{reports.length} analyse{reports.length > 1 ? "s" : ""}, dont {thisMonth} ce mois-ci</span> : null}
        actions={<Link href="/new" className={btnAccent}><Plus size={16} aria-hidden />Nouvelle analyse</Link>}
      />

      <Card flush>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <h2 className="text-base font-semibold tracking-[-0.01em]">Historique des rapports</h2>
          <label className="relative block">
            <span className="sr-only">Rechercher un rapport</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-[11px] text-ink-faint" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un rapport" className={`${controlCls} w-64 pl-9`} />
          </label>
        </div>
        {error && <p className="px-5 pb-5 text-bad">{error}</p>}
        {!reports && !error && (
          <div className="space-y-2 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        )}
        {reports && filtered.length === 0 && (
          <div className="p-5">
            {reports.length ? (
              <Empty title="Aucun rapport ne correspond">Essayez un autre nom ou une autre catégorie.</Empty>
            ) : (
              <Empty title="Aucune analyse pour l'instant" action={<Link href="/new" className={btnAccent}>Lancer une première analyse</Link>}>
                Importez un export Circana : Lookout retrouve chaque produit sur le web et construit le rapport.
              </Empty>
            )}
          </div>
        )}
        {filtered.length > 0 && (
          <ul className="mt-4 border-t border-line-soft">
            {filtered.map((r) => {
              const total = r.productCount ?? 0;
              const done = r.completeCount ?? 0;
              const team = r.awaitingTeam ?? 0;
              return (
                <li key={r.id} className="border-b border-line-soft last:border-0">
                  <Link href={`/reports/${r.id}`} className="group grid items-center gap-x-6 gap-y-2 px-5 py-4 transition-colors duration-150 hover:bg-ground/70 sm:grid-cols-[minmax(0,1fr)_200px_150px_24px]">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.name}</p>
                      <p className="mt-0.5 text-[13px] text-ink-soft">
                        {[r.category || null, r.params.zones.map((z) => (z === "US" ? "États-Unis" : "Europe")).join(" et "), fmtDate(r.created_at)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div>
                      {total > 0 ? (
                        <>
                          <div className="flex h-2 overflow-hidden rounded-full bg-line-soft" aria-hidden>
                            <i className="bg-night" style={{ width: `${(done / total) * 100}%` }} />
                            <i className="bg-amber" style={{ width: `${(team / total) * 100}%` }} />
                          </div>
                          <p className="mt-1.5 text-[12.5px] text-ink-soft">{done} fiches sur {total}{team ? ` · ${team} chez l'équipe` : ""}</p>
                        </>
                      ) : null}
                    </div>
                    <div><StatusBadge status={r.status} /></div>
                    <ChevronRight size={18} className="hidden text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 sm:block" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function HomePage() {
  return (
    <Private>
      <History />
    </Private>
  );
}
