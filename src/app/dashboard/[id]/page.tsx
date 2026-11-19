"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { Private } from "@/components/Session";
import { RadarActions, RadarFrame } from "@/components/agents/RadarFrame";
import { Empty, PageSkeleton } from "@/components/ui";
import type { DashboardMeta } from "@/lib/dashboards";

function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const [meta, setMeta] = useState<DashboardMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<DashboardMeta>(`/api/dashboards/${id}`).then(setMeta).catch((e) => setError(e.message));
  }, [id]);
  if (error) return <Empty title="Dashboard introuvable">{error}</Empty>;
  if (!meta) return <PageSkeleton />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft"><span className="font-semibold text-ink">{meta.title}</span> · généré le {fmtDate(meta.createdAt)}</p>
        <RadarActions id={meta.id} shareSlug={meta.shareSlug} />
      </div>
      <RadarFrame src={`/api/dashboards/${meta.id}/radar`} title={meta.title} />
    </div>
  );
}

export default function DashboardPage() {
  return <Private><Dashboard /></Private>;
}
