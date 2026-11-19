"use client";
import { useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { Private } from "@/components/Session";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, ErrorText, PageHeader, Skeleton, controlCls } from "@/components/ui";
import type { Site } from "@/lib/site-types";

function Sites() {
  const [sites, setSites] = useState<Site[] | null>(null);
  const [zone, setZone] = useState<"all" | "US" | "EU">("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ sites: Site[] }>("/api/sites").then((r) => setSites(r.sites)).catch((e) => setError(e.message));
  }, []);

  const list = (sites ?? []).filter((s) => zone === "all" || s.zone === zone);

  return (
    <div className="space-y-6">
      <PageHeader title="Sites suivis" meta={<span>Les sites que les agents d&apos;enrichissement parcourent, par zone.</span>} />
      <ErrorText>{error}</ErrorText>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Sites surveillés ({list.length})</h2>
          <select aria-label="Filtrer par zone" value={zone} onChange={(e) => setZone(e.target.value as typeof zone)} className={`${controlCls}`}>
            <option value="all">Toutes les zones</option>
            <option value="US">États-Unis</option>
            <option value="EU">Europe</option>
          </select>
        </div>
        {!sites && <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-ink-soft">
              <tr><th className="py-2 pr-4">Site</th><th className="pr-4">Zone</th><th className="hidden pr-4 md:table-cell">Catégories</th><th className="pr-4">Méthode</th><th className="hidden md:table-cell">Dernière collecte</th></tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.domain} className="border-t border-line">
                  <td className="py-2 pr-4">
                    <span className="font-medium">{s.name}</span> <span className="text-ink-soft">{s.domain !== s.name && s.domain}</span>
                    {s.source === "discovered" && <span className="ml-2 rounded bg-amber/20 px-1.5 py-0.5 text-xs text-amber-dark">ajouté par une analyse</span>}
                  </td>
                  <td className="pr-4">{s.zone}<span className="hidden sm:inline">{s.country && ` · ${s.country}`}</span></td>
                  <td className="hidden pr-4 md:table-cell">{s.categories.join(", ") || "—"}</td>
                  <td className="pr-4"><StatusBadge status={s.method} /></td>
                  <td className="hidden text-ink-soft md:table-cell">{s.lastSuccessAt ? fmtDate(s.lastSuccessAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          Les sites rencontrés pendant un enrichissement sont ajoutés automatiquement à cette liste. L&apos;équipe Lookout règle ensuite leur méthode de collecte.
        </p>
      </Card>

    </div>
  );
}

export default function SitesPage() {
  return (
    <Private>
      <Sites />
    </Private>
  );
}
