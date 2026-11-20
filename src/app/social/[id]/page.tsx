"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Trash2 } from "lucide-react";
import { api, fmtDateTime } from "@/lib/client";
import { Private } from "@/components/Session";
import { Empty, PageHeader, PageSkeleton, btnSecondary } from "@/components/ui";
import { PrismeDashboard } from "@/components/prisme/PrismeDashboard";
import { AlertesCrise } from "@/components/prisme/AlertesCrise";
import { ReseauxMarques } from "@/components/prisme/ReseauxMarques";
import type { DashboardPrisme } from "@/lib/prisme-dashboard";
import type { AnalyseComplete } from "@/lib/prisme-historique";

/** Une analyse de l'historique : le dashboard Prisme tel qu'il a été produit lors de la recherche. */
function AnalyseView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [a, setA] = useState<AnalyseComplete | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    api<AnalyseComplete>(`/api/social/${id}`).then(setA).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <Empty title="Analyse introuvable">{error} <Link href="/social" className="underline">Retour à l&apos;historique</Link></Empty>;
  if (!a) return <PageSkeleton />;

  async function supprimer() {
    await api(`/api/social/${id}`, { method: "DELETE" });
    router.push("/social");
  }
  const relancer = "_type" in a.resultat ? "/prisme" : `/prisme?sujet=${encodeURIComponent(a.sujet)}${a.pays ? `&pays=${encodeURIComponent(a.pays)}` : ""}${a.question ? `&question=${encodeURIComponent(a.question)}` : ""}`;

  return (
    <div className="w-full min-w-0 space-y-6 [contain:inline-size]">
      <Link href="/social" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"><ArrowLeft size={15} aria-hidden />Historique</Link>
      <PageHeader
        title={a.sujet}
        meta={<span>{[a.pays, `analyse du ${fmtDateTime(a.created_at)}`, a.created_by_email].filter(Boolean).join(" · ")}{a.question ? ` · question : ${a.question}` : ""}</span>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={relancer} className={btnSecondary}><RefreshCw size={15} aria-hidden />Relancer avec Prisme</Link>
            {confirm ? (
              <>
                <button type="button" onClick={supprimer} className="press rounded-[10px] bg-bad px-3 py-2 text-sm font-medium text-white">Confirmer la suppression</button>
                <button type="button" onClick={() => setConfirm(false)} className="press text-sm text-ink-soft hover:underline">Annuler</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirm(true)} className={btnSecondary}><Trash2 size={15} aria-hidden />Supprimer</button>
            )}
          </div>
        }
      />
      {"_type" in a.resultat
        ? (a.resultat._type === "alertes" ? <AlertesCrise a={a.resultat.donnees} /> : <ReseauxMarques r={a.resultat.donnees} />)
        : <PrismeDashboard d={a.resultat as DashboardPrisme} />}
    </div>
  );
}

export default function AnalysePage() {
  return <Private><AnalyseView /></Private>;
}
