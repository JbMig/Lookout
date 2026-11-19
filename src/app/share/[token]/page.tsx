"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { ReportView, type Bundle } from "@/components/report/ReportView";
import { Eye } from "lucide-react";
import { PublicTop } from "@/components/PublicTop";
import { Empty, PageHeader, PageSkeleton } from "@/components/ui";
import { RadarFrame } from "@/components/agents/RadarFrame";
import type { DashboardMeta } from "@/lib/dashboards";

/** Rapport partagé : lecture seule, sans compte. */
export default function SharedReportPage() {
  const { token } = useParams<{ token: string }>();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [dash, setDash] = useState<DashboardMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Bundle | (DashboardMeta & { kind: "agents" })>(`/api/share/${token}`).then((r) => ("kind" in r && r.kind === "agents" ? setDash(r) : setBundle(r as Bundle))).catch((e) => setError(e.message));
  }, [token]);

  return (
    <>
      <PublicTop><Eye size={15} aria-hidden />{dash ? "Dashboard partagé" : "Rapport partagé"} en lecture seule</PublicTop>
      <div className="mx-auto w-full max-w-[1320px] px-5 py-7 sm:px-8 lg:px-10">
        {error ? (
          <Empty title="Ce rapport n'est plus partagé">{error}</Empty>
        ) : dash ? (
          <RadarFrame src={`/api/share/${token}/radar`} title={dash.title} height="h-[calc(100dvh-110px)]" />
        ) : !bundle ? (
          <PageSkeleton />
        ) : (
          <div className="space-y-6">
            <PageHeader
              title={bundle.report.name}
              meta={<span>{[bundle.report.category || null, bundle.report.params.zones.map((z) => (z === "US" ? "États-Unis" : "Europe")).join(" et "), fmtDate(bundle.report.created_at)].filter(Boolean).join(" · ")}</span>}
            />
            <ReportView bundle={bundle} />
          </div>
        )}
      </div>
    </>
  );
}
