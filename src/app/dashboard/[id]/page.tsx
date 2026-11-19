"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { Private } from "@/components/Session";
import { AgentButton } from "@/components/agents/kit";
import { DashboardActions, DashboardView } from "@/components/agents/DashboardView";
import { Empty, PageHeader, PageSkeleton } from "@/components/ui";
import type { DashboardBundle } from "@/lib/dashboards";

function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<DashboardBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<DashboardBundle>(`/api/dashboards/${id}`).then(setBundle).catch((e) => setError(e.message));
  }, [id]);
  if (error) return <Empty title="Dashboard introuvable">{error}</Empty>;
  if (!bundle) return <PageSkeleton />;
  const c = bundle.report.config;
  return (
    <div className="space-y-6">
      <PageHeader
        title={bundle.report.title}
        meta={<span>{[c.brand, c.category, `généré le ${fmtDate(bundle.report.createdAt)}`, "chiffres lus en direct dans Supabase"].filter(Boolean).join(" · ")}</span>}
        actions={<div className="flex flex-wrap items-start gap-4"><DashboardActions bundle={bundle} /><div className="no-print"><AgentButton agent="4" label="Générer un nouveau dashboard" onDone={(run) => run.link && (window.location.href = run.link)} /></div></div>}
      />
      <DashboardView bundle={bundle} />
    </div>
  );
}

export default function DashboardPage() {
  return <Private><Dashboard /></Private>;
}
