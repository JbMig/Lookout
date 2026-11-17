"use client";
import { useCallback, useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { Private } from "@/components/Session";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, ErrorText, Field, btnPrimary, btnSecondary, inputCls } from "@/components/ui";
import type { OrganizationRow, PlanId, ReportItemRow, SiteRow, SiteStatus } from "@/lib/types";
import { PLANS } from "@/lib/plans";

type QueueItem = ReportItemRow & { reportName: string; orgName: string; site: SiteRow | null };
const TABS = [
  { id: "queue", label: "File de l'équipe" },
  { id: "sites", label: "Catalogue de sites" },
  { id: "orgs", label: "Clients" },
  { id: "costs", label: "Appels et coûts" },
] as const;

/* ---------------- File de l'équipe ---------------- */

function ManualForm({ item, onDone }: { item: QueueItem; onDone: () => void }) {
  const p = item.product;
  const [f, setF] = useState({
    name: p?.name || item.circana.product,
    brand: p?.brand || item.circana.brand,
    price: p?.price?.toString() ?? "",
    currency: p?.currency ?? (item.circana.zone === "US" ? "USD" : "EUR"),
    ingredients: p?.ingredients ?? "",
    formats: p?.formats.map((x) => x.size).join(", ") ?? "",
    shades: p?.shades.map((x) => (x.hex ? `${x.name} ${x.hex}` : x.name)).join(", ") ?? "",
    packaging: p?.packaging ?? "",
    imageUrl: p?.imageUrl ?? "",
    sourceUrl: p?.sourceUrl ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const price = f.price.trim() ? Number(f.price.replace(",", ".")) : null;
    if (price !== null && !Number.isFinite(price)) return setError("Prix invalide.");
    if (f.currency && f.currency.length !== 3) return setError("Devise sur 3 lettres (EUR, USD…).");
    const url = (v: string) => (v.trim() ? v.trim() : null);
    try {
      await api(`/api/admin/items/${item.id}`, {
        method: "POST",
        json: {
          action: "manual",
          product: {
            name: f.name, brand: f.brand, price, currency: f.currency.toUpperCase() || null,
            ingredients: f.ingredients.trim() || null,
            formats: f.formats.split(",").map((s) => s.trim()).filter(Boolean).map((size) => ({ size, ...(price !== null ? { price } : {}) })),
            shades: f.shades.split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
              const hex = s.match(/#[0-9a-f]{6}\b/i)?.[0];
              return { name: s.replace(hex ?? "", "").trim() || s, ...(hex ? { hex } : {}) };
            }),
            packaging: f.packaging.trim() || null,
            imageUrl: url(f.imageUrl),
            sourceUrl: url(f.sourceUrl),
          },
        },
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={save} className="mt-4 grid gap-3 rounded-lg bg-cream p-4 sm:grid-cols-2">
      <Field label="Nom"><input className={inputCls} value={f.name} onChange={set("name")} /></Field>
      <Field label="Marque"><input className={inputCls} value={f.brand} onChange={set("brand")} /></Field>
      <Field label="Prix"><input className={inputCls} inputMode="decimal" value={f.price} onChange={set("price")} /></Field>
      <Field label="Devise"><input className={inputCls} value={f.currency} onChange={set("currency")} /></Field>
      <Field label="Formats" hint="Séparés par des virgules : 4.5 g, Mini"><input className={inputCls} value={f.formats} onChange={set("formats")} /></Field>
      <Field label="Teintes" hint="Séparées par des virgules, couleur facultative : Joy #E86A7A"><input className={inputCls} value={f.shades} onChange={set("shades")} /></Field>
      <Field label="Packaging"><input className={inputCls} value={f.packaging} onChange={set("packaging")} /></Field>
      <Field label="URL du packshot"><input className={inputCls} value={f.imageUrl} onChange={set("imageUrl")} /></Field>
      <div className="sm:col-span-2"><Field label="URL source"><input className={inputCls} value={f.sourceUrl} onChange={set("sourceUrl")} /></Field></div>
      <div className="sm:col-span-2"><Field label="Composition INCI"><textarea rows={3} className={inputCls} value={f.ingredients} onChange={set("ingredients")} /></Field></div>
      <div className="sm:col-span-2"><ErrorText>{error}</ErrorText><button className={btnPrimary}>Enregistrer la fiche</button></div>
    </form>
  );
}

function QueueCard({ item, reload }: { item: QueueItem; reload: () => void }) {
  const [instructions, setInstructions] = useState(item.site?.cu_instructions ?? "");
  const [url, setUrl] = useState(item.product?.sourceUrl ?? "");
  const [save, setSave] = useState(true);
  const [open, setOpen] = useState<"cu" | "manual" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(json: Record<string, unknown>) {
    setError(null);
    setBusy(true);
    try {
      await api(`/api/admin/items/${item.id}`, { method: "POST", json });
      setOpen(null);
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-line bg-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{item.circana.brand} · {item.circana.product} <span className="text-xs text-ink-soft">({item.circana.zone})</span></p>
          <p className="text-sm text-ink-soft">
            {item.orgName} · {item.reportName} · site : {item.site?.name ?? item.site_domain ?? "inconnu"}
            {item.site && <> · <StatusBadge status={item.site.status} /></>}
          </p>
          {item.error && <p className="mt-1 text-sm text-amber-dark">{item.error}</p>}
        </div>
        <StatusBadge status={item.status} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {item.status === "navigating" ? (
          <button className={btnSecondary} disabled={busy} onClick={() => act({ action: "poll" })}>Vérifier la session H Company</button>
        ) : (
          <button className={btnPrimary} onClick={() => setOpen(open === "cu" ? null : "cu")}>Lancer le computer use</button>
        )}
        <button className={btnSecondary} onClick={() => setOpen(open === "manual" ? null : "manual")}>Saisie manuelle</button>
        <button className={btnSecondary} disabled={busy} onClick={() => act({ action: "retry" })}>Relancer la collecte</button>
        <button className={`${btnSecondary} text-bad`} disabled={busy} onClick={() => act({ action: "dismiss" })}>Écarter</button>
      </div>
      <ErrorText>{error}</ErrorText>

      {open === "cu" && (
        <form
          className="mt-4 space-y-3 rounded-lg bg-cream p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (url && !/^https?:\/\//.test(url)) return setError("L'URL doit commencer par http(s)://");
            act({ action: "start_cu", url: url || null, instructions: instructions || null, saveToSite: save });
          }}
        >
          <Field label="URL de départ (facultatif)"><input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
          <Field label="Parcours pour ce site" hint="Étapes concrètes en anglais : « Close the country pop-up, open the Ingredients accordion, open the shade selector… »">
            <textarea rows={4} className={inputCls} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
            Enregistrer ce parcours pour {item.site?.name ?? "ce site"} : les prochains produits passeront automatiquement en computer use
          </label>
          <button className={btnPrimary} disabled={busy}>{busy ? "Lancement…" : "Lancer la session H Company"}</button>
        </form>
      )}
      {open === "manual" && <ManualForm item={item} onDone={() => { setOpen(null); reload(); }} />}
    </li>
  );
}

function Queue() {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api<{ items: QueueItem[] }>("/api/admin/queue").then((r) => setItems(r.items)).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  // Suivi automatique des sessions H Company en cours.
  useEffect(() => {
    const navigating = (items ?? []).filter((i) => i.status === "navigating");
    if (!navigating.length) return;
    const t = setTimeout(async () => {
      await Promise.all(navigating.map((i) => api(`/api/admin/items/${i.id}`, { method: "POST", json: { action: "poll" } }).catch(() => null)));
      load();
    }, 8000);
    return () => clearTimeout(t);
  }, [items, load]);

  if (error) return <p className="text-bad">{error}</p>;
  if (!items) return <p className="text-ink-soft">Chargement…</p>;
  if (!items.length) return <p className="rounded-xl border border-dashed border-line bg-paper p-8 text-center text-ink-soft">Aucun produit en attente : tous les sites passent en automatique.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">{items.length} produit(s) que le scraping n&apos;a pas pu compléter. Une fois le parcours enregistré, le site passe en automatique pour tous les clients.</p>
      <ul className="space-y-3">{items.map((i) => <QueueCard key={i.id} item={i} reload={load} />)}</ul>
    </div>
  );
}

/* ---------------- Catalogue de sites ---------------- */

const SITE_STATUSES: SiteStatus[] = ["untested", "scraping", "linkup", "computer_use", "needs_review", "blocked", "requested"];

function Sites() {
  const [sites, setSites] = useState<SiteRow[] | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api<{ sites: SiteRow[] }>("/api/sites").then((r) => setSites(r.sites)).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  async function patch(id: string, json: Record<string, unknown>) {
    setError(null);
    try {
      await api(`/api/sites/${id}`, { method: "PATCH", json });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!sites) return <p className="text-ink-soft">{error ?? "Chargement…"}</p>;
  return (
    <Card>
      <ErrorText>{error}</ErrorText>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-ink-soft">
            <tr><th className="py-2 font-medium">Site</th><th className="py-2 font-medium">Zone</th><th className="py-2 font-medium">Méthode</th><th className="py-2 font-medium">Dernier succès</th><th /></tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id} className="border-t border-line align-top">
                <td className="py-2">
                  <span className="font-medium">{s.name}</span> <span className="text-ink-soft">{s.domain}</span>
                  {s.requested_by_org && <span className="ml-2 text-xs text-amber-dark">demandé par un client</span>}
                  {edit === s.id && (
                    <div className="mt-2 space-y-2">
                      <textarea rows={4} aria-label="Parcours de computer use" className={inputCls} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Parcours de computer use pour ce site" />
                      <div className="flex gap-2">
                        <button className={btnPrimary} onClick={() => patch(s.id, { cu_instructions: draft || null }).then(() => setEdit(null))}>Enregistrer</button>
                        <button className={btnSecondary} onClick={() => setEdit(null)}>Annuler</button>
                      </div>
                    </div>
                  )}
                </td>
                <td className="py-2">{s.zone}</td>
                <td className="py-2">
                  <select aria-label={`Méthode pour ${s.name}`} value={s.status} onChange={(e) => patch(s.id, { status: e.target.value })} className="rounded-md border border-line bg-paper px-2 py-1">
                    {SITE_STATUSES.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </td>
                <td className="py-2">{s.last_success_at ? fmtDate(s.last_success_at) : "—"}</td>
                <td className="py-2 text-right">
                  <button className="text-sm underline underline-offset-2" onClick={() => { setEdit(s.id); setDraft(s.cu_instructions ?? ""); }}>Parcours</button>{" "}
                  <button className="ml-2 text-sm text-bad underline underline-offset-2" onClick={() => confirm(`Supprimer ${s.domain} ?`) && api(`/api/sites/${s.id}`, { method: "DELETE" }).then(load)}>Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-soft">Ajoutez des sites depuis la page « Sites ».</p>
    </Card>
  );
}

/* ---------------- Clients ---------------- */

function Orgs() {
  const [orgs, setOrgs] = useState<(OrganizationRow & { members: number; analysesThisMonth: number })[] | null>(null);
  const load = useCallback(() => api<{ orgs: typeof orgs }>("/api/admin/orgs").then((r) => setOrgs(r.orgs)), []);
  useEffect(() => {
    load();
  }, [load]);
  if (!orgs) return <p className="text-ink-soft">Chargement…</p>;
  return (
    <Card>
      <p className="mb-3 text-sm text-ink-soft">Le paiement en ligne (Stripe) n&apos;est pas encore branché : l&apos;offre se change ici après accord commercial.</p>
      <table className="w-full text-left text-sm">
        <thead className="text-ink-soft"><tr><th className="py-2 font-medium">Client</th><th className="py-2 font-medium">Membres</th><th className="py-2 font-medium">Analyses ce mois</th><th className="py-2 font-medium">Offre</th></tr></thead>
        <tbody>
          {orgs.map((o) => (
            <tr key={o.id} className="border-t border-line">
              <td className="py-2">{o.name} <span className="text-xs text-ink-soft">depuis le {fmtDate(o.created_at)}</span></td>
              <td className="py-2">{o.members}</td>
              <td className="py-2">{o.analysesThisMonth}</td>
              <td className="py-2">
                <select aria-label={`Offre de ${o.name}`} value={o.plan} onChange={(e) => api(`/api/admin/orgs/${o.id}`, { method: "PATCH", json: { plan: e.target.value } }).then(load)} className="rounded-md border border-line bg-paper px-2 py-1">
                  {(Object.keys(PLANS) as PlanId[]).map((p) => <option key={p} value={p}>{PLANS[p].label}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* ---------------- Coûts ---------------- */

function Costs() {
  const [data, setData] = useState<{ byService: { service: string; calls: number; failures: number }[]; byOrg: Record<string, string | number>[] } | null>(null);
  useEffect(() => {
    api<typeof data>("/api/admin/costs").then(setData);
  }, []);
  if (!data) return <p className="text-ink-soft">Chargement…</p>;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {data.byService.map((s) => (
          <div key={s.service} className="rounded-xl border border-line bg-paper p-4">
            <p className="text-xs capitalize text-ink-soft">{s.service}</p>
            <p className="mt-1 text-2xl font-semibold">{s.calls}</p>
            <p className="text-xs text-ink-soft">{s.calls ? Math.round((s.failures / s.calls) * 100) : 0} % d&apos;échecs · 30 jours</p>
          </div>
        ))}
      </div>
      <Card>
        <h2 className="mb-2 font-semibold">Par client</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-ink-soft"><tr><th className="py-2 font-medium">Client</th><th className="py-2 font-medium">Scraping</th><th className="py-2 font-medium">Linkup</th><th className="py-2 font-medium">H Company</th><th className="py-2 font-medium">Hugging Face</th></tr></thead>
          <tbody>
            {data.byOrg.map((o) => (
              <tr key={String(o.org)} className="border-t border-line">
                <td className="py-2">{o.org}</td><td className="py-2">{o.scraping}</td><td className="py-2">{o.linkup}</td><td className="py-2">{o.hcompany}</td><td className="py-2">{o.huggingface}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-ink-soft">Multipliez par vos tarifs Linkup, H Company et Hugging Face pour obtenir le coût par client.</p>
      </Card>
    </div>
  );
}

function Admin() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("queue");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Administration Lookout</h1>
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === t.id ? "border-ink font-medium" : "border-transparent text-ink-soft"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "queue" && <Queue />}
      {tab === "sites" && <Sites />}
      {tab === "orgs" && <Orgs />}
      {tab === "costs" && <Costs />}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Private staff>
      <Admin />
    </Private>
  );
}
