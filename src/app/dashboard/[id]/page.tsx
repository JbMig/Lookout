"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, FileDown, Link2, Loader2 } from "lucide-react";
import { api, fmtDate } from "@/lib/client";
import { Private } from "@/components/Session";
import { RadarActions, RadarFrame } from "@/components/agents/RadarFrame";
import { Agent4Dashboard } from "@/components/agents/Agent4Dashboard";
import { isAgent4Data } from "@/lib/agent4";
import { Empty, PageSkeleton, btnSecondary } from "@/components/ui";
import type { DashboardMeta } from "@/lib/dashboards";

/** Partage et impression d'un rapport de l'Agent 4 (le lien de partage est le share_slug écrit par l'agent). */
function Agent4Actions({ shareSlug }: { shareSlug: string | null }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!shareSlug) return;
    await navigator.clipboard?.writeText(`${window.location.origin}/share/${shareSlug}`).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {shareSlug && (
        <button type="button" onClick={copy} title="Copie un lien en lecture seule, réservé aux comptes Lookout" className={btnSecondary}>
          {copied ? <Check size={15} aria-hidden /> : <Link2 size={15} aria-hidden />}{copied ? "Lien copié" : "Partager"}
        </button>
      )}
      <button type="button" onClick={() => window.print()} className={btnSecondary}><FileDown size={15} aria-hidden />PDF</button>
    </div>
  );
}

function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const [meta, setMeta] = useState<DashboardMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const failed = meta?.format === "agent4" && meta.status === "failed" && !isAgent4Data(meta.data);
  const waiting = meta?.format === "agent4" && !isAgent4Data(meta.data) && !failed;
  useEffect(() => {
    const load = () => api<DashboardMeta>(`/api/dashboards/${id}`).then(setMeta).catch((e) => setError(e.message));
    void load();
    if (!waiting) return;
    // L'agent Holo écrit le rapport quand il a fini : la page se recharge toute seule.
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [id, waiting]);
  if (error) return <Empty title="Dashboard introuvable">{error}</Empty>;
  if (!meta) return <PageSkeleton />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft"><span className="font-semibold text-ink">{meta.title}</span> · généré le {fmtDate(meta.createdAt)}</p>
        {meta.format === "agent4" ? (!waiting && !failed && <Agent4Actions shareSlug={meta.shareSlug} />) : <RadarActions id={meta.id} shareSlug={meta.shareSlug} />}
      </div>
      {meta.format === "agent4" ? (
        failed ? (
          <Empty title="L'Agent 4 n'a pas pu générer ce dashboard">{meta.error ?? "La session H Company s'est arrêtée avant d'enregistrer le rapport."} Relancez-le depuis la page Dashboards.</Empty>
        ) : waiting ? (
          <Empty title="L'Agent 4 prépare le dashboard">
            <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" aria-hidden />Il lit les données de Supabase puis enregistre son rapport ; cette page se met à jour toute seule.</span>
          </Empty>
        ) : (
          <Agent4Dashboard data={meta.data} />
        )
      ) : (
        <RadarFrame src={`/api/dashboards/${meta.id}/radar`} title={meta.title} />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return <Private><Dashboard /></Private>;
}
