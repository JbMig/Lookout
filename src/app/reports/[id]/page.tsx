"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { Private, useSession } from "@/components/Session";
import { StatusBadge } from "@/components/StatusBadge";
import { ReportView, type Bundle } from "@/components/report/ReportView";
import { btnSecondary } from "@/components/ui";

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
  if (!bundle) return <p className="text-ink-soft">Chargement du rapport…</p>;
  const { report, items } = bundle;
  const finished = items.filter((i) => !["pending", "collecting"].includes(i.status)).length;
  const progress = items.length ? Math.round((finished / items.length) * 100) : 0;
  const canEdit = me!.user.role !== "viewer";
  const canDelete = me!.user.role === "owner" || me!.user.role === "admin";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{report.name}</h1>
            <StatusBadge status={report.status} />
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {report.category || "Sans catégorie"} · {report.params.zones.join(" + ")}
            {report.params.excludedBrands.length ? ` · ${report.params.excludedBrands.length} marque(s) exclue(s)` : ""}
            {report.params.focus ? ` · focus « ${report.params.focus} »` : ""} · {fmtDate(report.created_at)}
          </p>
        </div>
        {report.status === "done" && (
          <div className="flex flex-wrap gap-2">
            {canEdit && (shareUrl ? (
              <button className={btnSecondary} onClick={unshare}>Désactiver le lien de partage</button>
            ) : (
              <button className={btnSecondary} onClick={share}>Partager</button>
            ))}
            <button className={btnSecondary} onClick={() => window.print()}>Exporter en PDF</button>
            {canEdit && <button className={btnSecondary} onClick={rerun}>Relancer</button>}
            {canDelete && <button className={`${btnSecondary} text-bad`} onClick={remove}>Supprimer</button>}
          </div>
        )}
      </header>

      {shareUrl && (
        <p className="rounded-md bg-paper p-3 text-sm">
          Lien de partage en lecture seule {copied && "(copié)"} :{" "}
          <a className="break-all underline underline-offset-2" href={shareUrl} target="_blank" rel="noreferrer">{shareUrl}</a>
        </p>
      )}
      {error && <p className="text-sm text-bad" role="alert">{error}</p>}
      {report.error && <p className="text-sm text-bad">{report.error}</p>}

      {report.status !== "done" && report.status !== "failed" && (
        <section className="rounded-xl border border-line bg-paper p-5" aria-live="polite">
          <div className="flex justify-between text-sm">
            <span>{report.status === "analyzing" ? "Analyse du marché, du catalogue et des tendances…" : `Collecte des fiches produits : ${finished} / ${items.length}`}</span>
            <span>{progress} %</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream">
            <div className="h-full bg-amber transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Linkup trouve chaque page produit, puis Lookout tente un scraping direct. Les sites qui résistent sont confiés à l&apos;équipe,
            qui les traite en computer use : ces fiches se compléteront ensuite automatiquement.
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
