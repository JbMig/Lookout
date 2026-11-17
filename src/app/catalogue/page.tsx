"use client";
import { useEffect, useState } from "react";
import { api, fmtEur } from "@/lib/client";
import { Private } from "@/components/Session";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, ErrorText } from "@/components/ui";
import type { Site } from "@/lib/sites";
import type { ClientProduct } from "@/lib/types";

type SavedProduct = ClientProduct & { id: string; updated_at: string };

function Catalogue() {
  const [sites, setSites] = useState<Site[] | null>(null);
  const [products, setProducts] = useState<SavedProduct[] | null>(null);
  const [zone, setZone] = useState<"all" | "US" | "EU">("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ sites: Site[] }>("/api/sites").then((r) => setSites(r.sites)).catch((e) => setError(e.message));
    api<{ products: SavedProduct[] }>("/api/catalog").then((r) => setProducts(r.products)).catch((e) => setError(e.message));
  }, []);

  const list = (sites ?? []).filter((s) => zone === "all" || s.zone === zone);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Catalogues</h1>
        <p className="mt-1 text-ink-soft">Les sites surveillés par Lookout et votre catalogue produits enregistré.</p>
      </div>
      <ErrorText>{error}</ErrorText>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Sites surveillés ({list.length})</h2>
          <select aria-label="Filtrer par zone" value={zone} onChange={(e) => setZone(e.target.value as typeof zone)} className="rounded-md border border-line bg-paper px-2 py-1.5 text-sm">
            <option value="all">Toutes les zones</option>
            <option value="US">États-Unis</option>
            <option value="EU">Europe</option>
          </select>
        </div>
        {!sites && <p className="text-ink-soft">Chargement…</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-ink-soft">
              <tr><th className="py-2 pr-4">Site</th><th className="pr-4">Zone</th><th className="pr-4">Type</th><th className="pr-4">Catégories</th><th>Méthode</th></tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.domain} className="border-t border-line">
                  <td className="py-2 pr-4"><span className="font-medium">{s.name}</span> <span className="text-ink-soft">{s.domain}</span></td>
                  <td className="pr-4">{s.zone} · {s.country}</td>
                  <td className="pr-4">{s.type}</td>
                  <td className="pr-4">{s.categories.join(", ")}</td>
                  <td><StatusBadge status={s.method} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          La liste des sites est définie dans le code de Lookout (src/lib/sites.ts) : pour en ajouter un, contactez l&apos;équipe.
        </p>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Votre catalogue ({products?.length ?? "…"} produits)</h2>
        <p className="mb-4 text-sm text-ink-soft">Mis à jour à chaque import de catalogue lors d&apos;une analyse, et réutilisable sans nouvel import.</p>
        {products && !products.length && <p className="text-sm text-ink-soft">Aucun produit enregistré pour l&apos;instant.</p>}
        {!!products?.length && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-ink-soft">
                <tr><th className="py-2 pr-4">Produit</th><th className="pr-4">SKU</th><th className="pr-4">Zone</th><th className="pr-4">Prix</th><th className="pr-4">Teintes</th><th>Statut</th></tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-2 pr-4"><span className="font-medium">{p.brand}</span> {p.name}</td>
                    <td className="pr-4 text-ink-soft">{p.sku ?? "—"}</td>
                    <td className="pr-4">{p.zone ?? "—"}</td>
                    <td className="pr-4">{p.price != null ? (p.currency === "EUR" || !p.currency ? fmtEur(p.price) : `${p.price} ${p.currency}`) : "—"}</td>
                    <td className="pr-4">{p.shadesCount ?? "—"}</td>
                    <td>{p.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function CataloguePage() {
  return (
    <Private>
      <Catalogue />
    </Private>
  );
}
