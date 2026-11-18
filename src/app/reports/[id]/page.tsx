"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { Private, useSession } from "@/components/Session";
import { StatusBadge } from "@/components/StatusBadge";
import { ReportView, type Bundle } from "@/components/report/ReportView";
import { FileDown, Link2, RotateCw, Share2, Trash2 } from "lucide-react";
import { PageHeader, PageSkeleton, Pill, btnDanger, btnPrimary, btnSecondary } from "@/components/ui";

function Report() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useSession();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const running = useRef(false);

  // Fait avancer le pipeline tant que la collecte ou des sessions H Company sont en cours.
  useEffect(() => {
    let cancelled = false;
    const active = (b: Bundle) =>
      b.report.status === "collecting" || b.report.status === "analyzing" || b.items.some((i) => i.status === "navigating");
    async function loop() {
      if (running.current) return;
      running.current = true;
      try {
        let b = await api<Bundle>(`/api/reports/${id}`);
        if (!cancelled) setBundle(b);
        if (b.report.share_token) setShareUrl(`${location.origin}/share/${b.report.share_token}`);
        // Rapport terminé avec des fiches confiées à l'équipe : on récupère leur avancement une fois.
        if (b.report.status === "done" && b.items.some((i) => i.status === "awaiting_team")) {
          b = await api<Bundle>(`/api/reports/${id}/step`, { method: "POST" });
          if (!cancelled) setBundle(b);
        }
        while (!cancelled && active(b)) {
          b = await api<Bundle>(`/api/reports/${id}/step`, { method: "POST" });
          if (!cancelled) setBundle(b);
          await new Promise((ok) => setTimeout(ok, b.report.status === "done" ? 8000 : 2500));
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        running.current = false;
      }
    }
    loop();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function share() {
    const { token } = await api<{ token: string }>(`/api/reports/${id}/share`, { method: "POST" });
    const url = `${location.origin}/share/${token}`;
    setShareUrl(url);
    await navigator.clipboard?.writeText(url).catch(() => null);
    setCopied(true);
  }
  async function unshare() {
    await api(`/api/reports/${id}/share`, { method: "DELETE" });
    setShareUrl(null);
    setCopied(false);
  }
  const [retrying, setRetrying] = useState(false);
  /** Rapport en échec : recalcule l'analyse sans refaire la collecte, puis reprend le suivi. */
  async function retry() {
    setRetrying(true);
    setError(null);
    try {
      let b = await api<Bundle>(`/api/reports/${id}/step?retry=1`, { method: "POST" });
      setBundle(b);
      while (b.report.status === "collecting" || b.report.status === "analyzing") {
        await new Promise((ok) => setTimeout(ok, 2500));
        b = await api<Bundle>(`/api/reports/${id}/step`, { method: "POST" });
        setBundle(b);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRetrying(false);
    }
  }

  async function rerun() {
    try {
      const { id: newId } = await api<{ id: string }>(`/api/reports/${id}/rerun`, { method: "POST" });
      router.push(`/reports/${newId}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove() {
    if (!confirm("Supprimer définitivement ce rapport ?")) return;
    await api(`/api/reports/${id}`, { method: "DELETE" });
    router.push("/");
  }

  if (error && !bundle) return <p className="text-bad" role="alert">{error}</p>;
  if (!bundle) return <PageSkeleton />;
  const { report, items } = bundle;
  const finished = items.filter((i) => !["pending", "collecting"].includes(i.status)).length;
  const progress = items.length ? Math.round((finished / items.length) * 100) : 0;
  const complete = items.filter((i) => i.status === "done").length;
  const team = items.filter((i) => ["awaiting_team", "navigating"].includes(i.status)).length;
  const canDelete = me!.user.isStaff || report.created_by === me!.user.userId;
  const inProgress = report.status !== "done" && report.status !== "failed";

  return (
    <div className="space-y-6">
      <PageHeader
        title={report.name}
        meta={
          <>
            <span>{[report.category || null, report.params.zones.map((z) => (z === "US" ? "États-Unis" : "Europe")).join(" et "), `lancée le ${fmtDate(report.created_at)}`].filter(Boolean).join(" · ")}</span>
            {inProgress ? (
              <StatusBadge status={report.status} />
            ) : (
              <Pill tone={team ? "wait" : "ok"}>
                {complete} fiche{complete > 1 ? "s" : ""} complète{complete > 1 ? "s" : ""} sur {items.length}
                {team ? ` · ${team} chez l'équipe` : ""}
              </Pill>
            )}
            {report.params.excludedBrands.length > 0 && <span>{report.params.excludedBrands.length} marque{report.params.excludedBrands.length > 1 ? "s" : ""} exclue{report.params.excludedBrands.length > 1 ? "s" : ""}</span>}
            {report.params.focus && <span>Focus « {report.params.focus} »</span>}
          </>
        }
        actions={
          report.status === "done" ? (
            <>
              <button className={btnSecondary} onClick={rerun}><RotateCw size={15} aria-hidden />Relancer</button>
              <button className={btnSecondary} onClick={() => window.print()}><FileDown size={15} aria-hidden />PDF</button>
              {canDelete && <button className={btnDanger} onClick={remove} aria-label="Supprimer le rapport"><Trash2 size={15} aria-hidden /></button>}
              {shareUrl ? (
                <button className={btnSecondary} onClick={unshare}>Désactiver le lien</button>
              ) : (
                <button className={btnPrimary} onClick={share}><Share2 size={15} aria-hidden />Partager</button>
              )}
            </>
          ) : undefined
        }
      />

      {shareUrl && (
        <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-line bg-paper px-4 py-3 text-sm">
          <Link2 size={16} className="text-ink-faint" aria-hidden />
          <span className="text-ink-soft">Lien en lecture seule{copied ? ", copié dans le presse-papiers" : ""} :</span>
          <a className="break-all font-semibold hover:underline" href={shareUrl} target="_blank" rel="noreferrer">{shareUrl}</a>
        </div>
      )}
      {error && <p className="text-sm text-bad" role="alert">{error}</p>}
      {report.status === "failed" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-bad/25 bg-bad/5 px-4 py-3 text-sm text-bad">
          <span>L&apos;analyse n&apos;a pas pu se terminer{report.error ? ` : ${report.error}` : "."}</span>
          <button className={btnSecondary} onClick={retry} disabled={retrying}>
            <RotateCw size={15} aria-hidden />{retrying ? "Nouvel essai…" : "Réessayer"}
          </button>
        </div>
      )}

      {inProgress && (
        <section className="rounded-[14px] border border-line bg-paper p-5" aria-live="polite">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <span className="font-semibold">{report.status === "analyzing" ? "Analyse du marché, du catalogue et des tendances…" : `Collecte des fiches produits : ${finished} sur ${items.length}`}</span>
            <span className="text-ink-soft">{progress} %</span>
          </div>
          <div className="mt-3 flex h-3 gap-[3px]" aria-hidden>
            {items.map((i) => (
              <i
                key={i.id}
                className={`flex-1 rounded-[3px] transition-colors duration-300 ${
                  i.status === "done" ? "bg-night" : ["awaiting_team", "navigating", "partial"].includes(i.status) ? "bg-amber" : i.status === "failed" ? "bg-bad" : i.status === "collecting" ? "skeleton" : "bg-line-soft"
                }`}
              />
            ))}
          </div>
          <p className="mt-3 text-[13px] text-ink-soft">
            Linkup trouve chaque page produit, puis Lookout la lit directement. Les sites qui résistent passent à l&apos;équipe, qui les traite en computer use : ces fiches se compléteront ensuite d&apos;elles-mêmes.
          </p>
        </section>
      )}

      <ReportView bundle={bundle} />
    </div>
  );
}

export default function ReportPage() {
  return (
    <Private>
      <Report />
    </Private>
  );
}
