"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { Private, useSession } from "@/components/Session";
import { StatusBadge } from "@/components/StatusBadge";
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
  const quota = me!.plan.analysesPerMonth;

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-ink px-8 py-8 text-white">
        <div>
          <p className="text-sm text-white/70">{me!.user.orgName} · offre {me!.plan.label}</p>
          <h1 className="mt-1 text-3xl font-semibold">Du fichier Circana au dashboard décisionnel.</h1>
          <p className="mt-2 max-w-2xl text-white/80">
            Ventes Circana, données produits du web, tendances sociales et votre catalogue, fusionnés dans un rapport sourcé.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-white/70">Analyses ce mois-ci</p>
          <p className="text-3xl font-semibold">
            {me!.usage.analysesThisMonth}
            <span className="text-lg text-white/60"> / {quota ?? "∞"}</span>
          </p>
          <Link href="/new" className="mt-3 inline-block rounded-md bg-amber px-5 py-2.5 font-medium text-ink hover:bg-amber/90">
            Lancer une analyse
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Historique des rapports</h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un rapport"
            aria-label="Rechercher un rapport"
            className="w-64 rounded-md border border-line bg-paper px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-bad">{error}</p>}
        {!reports && !error && <p className="text-ink-soft">Chargement…</p>}
        {reports && filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-line bg-paper p-8 text-center text-ink-soft">
            {reports.length ? "Aucun rapport ne correspond." : "Aucun rapport pour l'instant. Lancez votre première analyse."}
          </p>
        )}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <li key={r.id}>
              <Link href={`/reports/${r.id}`} className="block h-full rounded-xl border border-line bg-paper p-5 transition hover:border-ink/40">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium">{r.name}</h3>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {r.category || "Sans catégorie"} · {r.params.zones.join(" + ")} · {fmtDate(r.created_at)}
                </p>
                {r.productCount !== null && (
                  <p className="mt-3 text-sm">
                    {r.productCount} produits · {r.completeCount} fiches complètes
                    {r.awaitingTeam ? <span className="text-amber-dark"> · {r.awaitingTeam} en traitement</span> : null}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>
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
