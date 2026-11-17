"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { Private } from "@/components/Session";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, ErrorText, Field, btnPrimary, btnSecondary, inputCls } from "@/components/ui";
import type { ProductSheet, Zone } from "@/lib/types";
import type { Site } from "@/lib/sites";

/** Tâche de la file de l'équipe (table enrichment_jobs + fiche market_products). */
interface QueueItem {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  attempts: number;
  error: string | null;
  sessionId: string | null;
  created_at: string;
  productId: string;
  brand: string;
  name: string;
  url: string | null;
  zone: Zone | null;
  product: ProductSheet | null;
  site: Site | null;
  siteDomain: string | null;
  reports: { id: string; name: string }[];
}

const TABS = [
  { id: "queue", label: "File de l'équipe" },
  { id: "sites", label: "Sites" },
  { id: "users", label: "Utilisateurs" },
  { id: "stats", label: "Collecte" },
] as const;

/* ---------------- File de l'équipe ---------------- */

function ManualForm({ item, onDone }: { item: QueueItem; onDone: () => void }) {
  const p = item.product;
  const [f, setF] = useState({
    name: p?.name || item.name,
    brand: p?.brand || item.brand,
    price: p?.price?.toString() ?? "",
    currency: p?.currency ?? (item.zone === "US" ? "USD" : "EUR"),
    ingredients: p?.ingredients ?? "",
    formats: p?.formats.map((x) => x.size).join(", ") ?? "",
    shades: p?.shades.map((x) => (x.hex ? `${x.name} ${x.hex}` : x.name)).join(", ") ?? "",
    packaging: p?.packaging ?? "",
    imageUrl: p?.imageUrl ?? "",
    sourceUrl: p?.sourceUrl ?? (item.url?.includes("/search?") ? "" : item.url ?? ""),
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
      await api(`/api/admin/jobs/${item.id}`, {
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
  const [instructions, setInstructions] = useState(item.site?.cuInstructions ?? "");
  const [url, setUrl] = useState(item.product?.sourceUrl ?? (item.url?.includes("/search?") ? "" : item.url ?? ""));
  const [open, setOpen] = useState<"cu" | "manual" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(json: Record<string, unknown>) {
    setError(null);
    setBusy(true);
    try {
      await api(`/api/admin/jobs/${item.id}`, { method: "POST", json });
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
          <p className="font-medium">{item.brand} · {item.name} {item.zone && <span className="text-xs text-ink-soft">({item.zone})</span>}</p>
          <p className="text-sm text-ink-soft">
            site : {item.site?.name ?? item.siteDomain ?? "inconnu"} · {item.attempts} tentative(s) · depuis le {fmtDate(item.created_at)}
          </p>
          {!!item.reports.length && (
            <p className="text-sm text-ink-soft">
              Rapports :{" "}
              {item.reports.map((r, i) => (
                <span key={r.id}>{i > 0 && ", "}<Link className="underline underline-offset-2" href={`/reports/${r.id}`}>{r.name}</Link></span>
              ))}
            </p>
          )}
          {item.error && <p className="mt-1 text-sm text-amber-dark">{item.error}</p>}
        </div>
        <StatusBadge status={item.status === "running" ? "navigating" : "awaiting_team"} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {item.status === "running" ? (
          <button className={btnSecondary} disabled={busy} onClick={() => act({ action: "poll" })}>Vérifier la session H Company</button>
        ) : (
          <button className={btnPrimary} onClick={() => setOpen(open === "cu" ? null : "cu")}>Lancer le computer use</button>
        )}
        <button className={btnSecondary} onClick={() => setOpen(open === "manual" ? null : "manual")}>Saisie manuelle</button>
        <button className={`${btnSecondary} text-bad`} disabled={busy} onClick={() => act({ action: "dismiss" })}>Écarter</button>
      </div>
      <ErrorText>{error}</ErrorText>

      {open === "cu" && (
        <form
          className="mt-4 space-y-3 rounded-lg bg-cream p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (url && !/^https?:\/\//.test(url)) return setError("L'URL doit commencer par http(s)://");
            act({ action: "start_cu", url: url || null, instructions: instructions || null });
          }}
        >
          <Field label="URL de départ (facultatif)"><input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
          <Field label="Parcours pour ce site" hint="Étapes concrètes en anglais : « Close the country pop-up, open the Ingredients accordion, open the shade selector… »">
            <textarea rows={4} className={inputCls} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </Field>
          <p className="text-xs text-ink-soft">
            Pour que ce parcours soit appliqué automatiquement aux prochains produits du site, ajoutez-le dans src/lib/sites.ts (cuInstructions, méthode « computer_use »).
          </p>
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
  const load = useCallback(() => api<{ jobs: QueueItem[] }>("/api/admin/queue").then((r) => setItems(r.jobs)).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  // Suivi automatique des sessions H Company en cours.
  useEffect(() => {
    const running = (items ?? []).filter((i) => i.status === "running");
    if (!running.length) return;
    const t = setTimeout(async () => {
      await Promise.all(running.map((i) => api(`/api/admin/jobs/${i.id}`, { method: "POST", json: { action: "poll" } }).catch(() => null)));
      load();
    }, 8000);
    return () => clearTimeout(t);
  }, [items, load]);

  if (error) return <p className="text-bad">{error}</p>;
  if (!items) return <p className="text-ink-soft">Chargement…</p>;
  if (!items.length) return <p className="rounded-xl border border-dashed border-line bg-paper p-8 text-center text-ink-soft">Aucun produit en attente : tous les sites passent en automatique.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">{items.length} fiche(s) que le scraping n&apos;a pas pu compléter. Chaque fiche complétée met à jour tous les rapports qui la contiennent.</p>
      <ul className="space-y-3">{items.map((i) => <QueueCard key={i.id} item={i} reload={load} />)}</ul>
    </div>
  );
}

/* ---------------- Sites (définis dans le code) ---------------- */

function Sites() {
  const [sites, setSites] = useState<Site[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ sites: Site[] }>("/api/sites").then((r) => setSites(r.sites)).catch((e) => setError(e.message));
  }, []);
  if (!sites) return <p className="text-ink-soft">{error ?? "Chargement…"}</p>;
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-ink-soft">
            <tr><th className="py-2 font-medium">Site</th><th className="py-2 font-medium">Zone</th><th className="py-2 font-medium">Méthode</th><th className="py-2 font-medium">Parcours computer use</th></tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.domain} className="border-t border-line align-top">
                <td className="py-2"><span className="font-medium">{s.name}</span> <span className="text-ink-soft">{s.domain}</span></td>
                <td className="py-2">{s.zone}</td>
                <td className="py-2"><StatusBadge status={s.method} /></td>
                <td className="py-2 text-xs text-ink-soft">{s.cuInstructions ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-soft">
        Le schéma Supabase n&apos;a pas de table de sites : ils sont définis dans src/lib/sites.ts. Modifiez ce fichier (méthode, parcours) puis redéployez.
      </p>
    </Card>
  );
}

/* ---------------- Utilisateurs ---------------- */

function Users() {
  const [users, setUsers] = useState<{ id: string; email: string | null; fullName: string | null; created_at: string }[] | null>(null);
  useEffect(() => {
    api<{ users: NonNullable<typeof users> }>("/api/admin/users").then((r) => setUsers(r.users));
  }, []);
  if (!users) return <p className="text-ink-soft">Chargement…</p>;
  return (
    <Card>
      <table className="w-full text-left text-sm">
        <thead className="text-ink-soft"><tr><th className="py-2 font-medium">Nom</th><th className="py-2 font-medium">E-mail</th><th className="py-2 font-medium">Inscrit le</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-line">
              <td className="py-2">{u.fullName ?? "—"}</td><td className="py-2">{u.email}</td><td className="py-2">{fmtDate(u.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-ink-soft">Le paiement en ligne (Stripe) n&apos;est pas encore branché ; l&apos;équipe Lookout est définie par la variable STAFF_EMAILS.</p>
    </Card>
  );
}

/* ---------------- Statistiques de collecte ---------------- */

const METHOD_LABEL: Record<string, string> = { scraping: "Scraping direct", linkup: "Linkup", hcompany: "H Company", manual: "Saisie équipe", demo: "Démo", inconnue: "Non collectée" };

function Stats() {
  const [data, setData] = useState<{ products: number; byMethod: Record<string, number>; byStatus: Record<string, number>; bySite: Record<string, number>; jobsByStatus: Record<string, number> } | null>(null);
  useEffect(() => {
    api<NonNullable<typeof data>>("/api/admin/stats").then(setData);
  }, []);
  if (!data) return <p className="text-ink-soft">Chargement…</p>;
  const block = (title: string, rec: Record<string, number>, label: (k: string) => string = (k) => k) => (
    <Card>
      <h2 className="mb-2 font-semibold">{title}</h2>
      <ul className="space-y-1 text-sm">
        {Object.entries(rec).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
          <li key={k} className="flex justify-between border-t border-line py-1"><span>{label(k)}</span><span className="font-medium">{v}</span></li>
        ))}
        {!Object.keys(rec).length && <li className="text-ink-soft">Aucune donnée</li>}
      </ul>
    </Card>
  );
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">{data.products} fiches produits enregistrées (table market_products), partagées entre toutes les analyses.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {block("Fiches par méthode de collecte", data.byMethod, (k) => METHOD_LABEL[k] ?? k)}
        {block("Fiches par statut", data.byStatus)}
        {block("Fiches par site", data.bySite)}
        {block("Tâches de l'équipe par statut", data.jobsByStatus)}
      </div>
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
      {tab === "users" && <Users />}
      {tab === "stats" && <Stats />}
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
