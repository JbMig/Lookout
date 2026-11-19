"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, Link2 } from "lucide-react";
import { api, fmtDate } from "@/lib/client";
import { Private } from "@/components/Session";
import { AgentButton, SettingsBanner } from "@/components/agents/kit";
import { Card, Empty, ErrorText, PageHeader, Pill, Skeleton } from "@/components/ui";

interface Item { id: string; title: string; createdAt: string; status: string; shared: boolean; kind: "agents" | "legacy" }

function Dashboards() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ dashboards: Item[] }>("/api/dashboards").then((r) => setItems(r.dashboards)).catch((e) => setError(e.message));
  }, []);
  const agents = items?.filter((i) => i.kind === "agents") ?? [];
  const legacy = items?.filter((i) => i.kind === "legacy") ?? [];
  const row = (i: Item, href: string) => (
    <li key={i.id}>
      <Link href={href} className="press flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-ground">
        <span className="min-w-0"><span className="block truncate font-medium">{i.title}</span><span className="text-[13px] text-ink-faint">{fmtDate(i.createdAt)}</span></span>
        <span className="flex items-center gap-3 text-[13px] text-ink-faint">{i.status === "pending" && <Pill tone="wait">en cours</Pill>}{i.shared && <span className="inline-flex items-center gap-1"><Link2 size={13} aria-hidden />partagé</span>}<ChevronRight size={16} aria-hidden /></span>
      </Link>
    </li>
  );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboards"
        meta={<span>Marché, catalogue, prix, variantes, composition et opportunités, à partager en un lien</span>}
        actions={<AgentButton agent="4" label="Générer le dashboard" onDone={(run) => run.link && router.push(run.link)} />}
      />
      <SettingsBanner />
      <ErrorText>{error}</ErrorText>
      {!items ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : !agents.length ? (
        <Empty title="Aucun dashboard généré">Générez-en un : il reprend les données de tous les agents et la dernière analyse.</Empty>
      ) : (
        <Card flush><ul className="divide-y divide-line">{agents.map((i) => row(i, `/dashboard/${i.id}`))}</ul></Card>
      )}
      {legacy.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Anciens rapports d&apos;analyse</h2>
          <Card flush><ul className="divide-y divide-line">{legacy.map((i) => row(i, `/reports/${i.id}`))}</ul></Card>
        </section>
      )}
    </div>
  );
}

export default function DashboardsPage() {
  return <Private><Dashboards /></Private>;
}
