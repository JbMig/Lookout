"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { ReportView, type Bundle } from "@/components/report/ReportView";

/** Rapport partagé : lecture seule, sans compte. */
export default function SharedReportPage() {
  const { token } = useParams<{ token: string }>();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Bundle>(`/api/share/${token}`).then(setBundle).catch((e) => setError(e.message));
  }, [token]);

  if (error) return <p className="text-bad" role="alert">{error}</p>;
  if (!bundle) return <p className="text-ink-soft">Chargement du rapport…</p>;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wide text-ink-soft">Rapport partagé · lecture seule</p>
        <h1 className="text-2xl font-semibold">{bundle.report.name}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {bundle.report.category || "Sans catégorie"} · {bundle.report.params.zones.join(" + ")} · {fmtDate(bundle.report.created_at)}
        </p>
      </header>
      <ReportView bundle={bundle} />
    </div>
  );
}
