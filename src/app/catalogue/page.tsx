"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Private, useSession } from "@/components/Session";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, ErrorText, Field, btnPrimary, inputCls } from "@/components/ui";
import type { SiteRow } from "@/lib/types";

function Catalogue() {
  const { me } = useSession();
  const [sites, setSites] = useState<SiteRow[] | null>(null);
  const [zone, setZone] = useState<"all" | "US" | "EU">("all");
  const [form, setForm] = useState({ domain: "", name: "", zone: "EU", country: "", type: "revendeur" });
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => api<{ sites: SiteRow[] }>("/api/sites").then((r) => setSites(r.sites));
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (!form.domain.trim() || !form.name.trim()) return setError("Renseignez le domaine et le nom du site.");
    try {
      const r = await api<{ alreadyExists?: boolean }>("/api/sites", { method: "POST", json: form });
      setMsg(r.alreadyExists ? "Ce site est déjà dans le catalogue." : me!.user.isStaff ? "Site ajouté." : "Demande envoyée : l'équipe ajoutera ce site au catalogue.");
      setForm({ ...form, domain: "", name: "" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const list = (sites ?? []).filter((s) => zone === "all" || s.zone === zone);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Catalogue de sites</h1>
        <p className="mt-1 text-ink-soft">
          Les sites déjà cartographiés par l&apos;équipe Lookout. Chaque site ajouté profite à tous les clients.
        </p>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">{list.length} sites</h2>
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
              <tr>
                <th className="py-2 font-medium">Site</th><th className="py-2 font-medium">Zone</th>
                <th className="py-2 font-medium">Type</th><th className="py-2 font-medium">Catégories</th><th className="py-2 font-medium">Méthode</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="py-2"><span className="font-medium">{s.name}</span> <span className="text-ink-soft">{s.domain}</span></td>
                  <td className="py-2">{s.zone}{s.country ? ` · ${s.country}` : ""}</td>
                  <td className="py-2 capitalize">{s.type}</td>
                  <td className="py-2">{s.categories.join(", ") || "—"}</td>
                  <td className="py-2"><StatusBadge status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">{me!.user.isStaff ? "Ajouter un site" : "Demander l'ajout d'un site"}</h2>
        <form onSubmit={request} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Domaine"><input className={inputCls} placeholder="ex. sephora.de" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} /></Field>
          <Field label="Nom"><input className={inputCls} placeholder="ex. Sephora Allemagne" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Zone">
            <select className={inputCls} value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })}>
              <option value="EU">Europe</option><option value="US">États-Unis</option>
            </select>
          </Field>
          <Field label="Pays"><input className={inputCls} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
          <Field label="Type">
            <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="revendeur">Revendeur</option><option value="marque">Site de marque</option><option value="marketplace">Marketplace</option>
            </select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-5">
            <ErrorText>{error}</ErrorText>
            {msg && <p className="text-sm text-ok">{msg}</p>}
            <button className={`${btnPrimary} mt-2`}>{me!.user.isStaff ? "Ajouter" : "Envoyer la demande"}</button>
          </div>
        </form>
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
