"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Private } from "@/components/Session";
import { FileImport, type ImportedTable } from "@/components/FileImport";
import { Card, ErrorText, Field, inputCls } from "@/components/ui";
import { missingRequired, toCircanaRows } from "@/lib/tabular";
import type { Zone } from "@/lib/types";
import type { Site } from "@/lib/site-types";

const MAX_PRODUCTS = 300;

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function NewAnalysis() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [circana, setCircana] = useState<ImportedTable | null>(null);
  const [catalog, setCatalog] = useState<ImportedTable | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [zones, setZones] = useState<Zone[]>(["US", "EU"]);
  const [siteIds, setSiteIds] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [focus, setFocus] = useState("");
  const [focusOnly, setFocusOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedCatalog, setSavedCatalog] = useState(0);
  const [useSaved, setUseSaved] = useState(true);

  useEffect(() => {
    api<{ sites: Site[] }>("/api/sites").then((r) => setSites(r.sites.filter((s) => s.method !== "blocked")));
    api<{ products: unknown[] }>("/api/catalog").then((r) => setSavedCatalog(r.products.length)).catch(() => null);
  }, []);

  const rows = useMemo(() => (circana ? toCircanaRows(circana.rows, circana.mapping) : []), [circana]);
  const brands = useMemo(() => [...new Set(rows.map((r) => r.brand))].sort(), [rows]);
  const kept = useMemo(() => {
    const ex = new Set(excluded.map(norm));
    const terms = norm(focus).split(/\s+/).filter((w) => w.length > 2);
    return rows
      .filter((r) => zones.includes(r.zone) && !ex.has(norm(r.brand)))
      .filter((r) => !focusOnly || !terms.length || terms.some((t) => norm(`${r.brand} ${r.product}`).includes(t)));
  }, [rows, zones, excluded, focus, focusOnly]);
  const max = MAX_PRODUCTS;
  const zoneSites = sites.filter((s) => zones.includes(s.zone));

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Donnez un nom à l'analyse.");
    if (!circana) return setError("Importez le fichier Circana.");
    const miss = missingRequired(circana.mapping, circana.fields);
    if (miss.length) return setError(`Associez les colonnes obligatoires du fichier Circana : ${miss.join(", ")}.`);
    if (catalog) {
      const m2 = missingRequired(catalog.mapping, catalog.fields);
      if (m2.length) return setError(`Associez les colonnes obligatoires du catalogue : ${m2.join(", ")}.`);
    }
    if (!zones.length) return setError("Choisissez au moins une zone.");
    if (!kept.length) return setError("Aucune ligne ne correspond à vos critères.");
    setBusy(true);
    try {
      const res = await api<{ id: string }>("/api/reports", {
        method: "POST",
        json: {
          name,
          category,
          params: { zones, siteIds: siteIds.filter((d) => zoneSites.some((s) => s.domain === d)), excludedBrands: excluded, focus, focusOnly },
          circana: { rows: circana.rows, mapping: circana.mapping, fileName: circana.fileName, storagePath: circana.storagePath ?? null },
          ...(catalog ? { catalog: { rows: catalog.rows, mapping: catalog.mapping, fileName: catalog.fileName } } : {}),
          useSavedCatalog: !catalog && useSaved && savedCatalog > 0,
        },
      });
      router.push(`/reports/${res.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div>
        <h1 className="text-2xl font-semibold">Nouvelle analyse</h1>
        <p className="mt-1 text-ink-soft">Importez vos ventes Circana, choisissez votre périmètre, Lookout s&apos;occupe du reste.</p>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">1. Analyse</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom de l'analyse"><input className={inputCls} placeholder="Ex. Blush — US vs Europe, T3 2026" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Catégorie" hint="Sert aussi à rechercher les tendances sociales.">
            <input className={inputCls} placeholder="Ex. Blush" value={category} onChange={(e) => setCategory(e.target.value)} />
          </Field>
        </div>
      </Card>

      <div className="space-y-4">
        <h2 className="font-semibold">2. Données</h2>
        <FileImport
          kind="circana"
          title="Ventes Circana (obligatoire)"
          description="Une ligne par produit, avec marque, produit, zone et ventes. Plusieurs périodes permettent de détecter ce qui progresse."
          value={circana}
          onChange={(t) => {
            setCircana(t);
            setExcluded([]);
          }}
          sampleUrl="/exemple-circana.csv"
        />
        <FileImport
          kind="catalog"
          title="Votre catalogue (facultatif)"
          description="Vos propres produits : nom, marque, prix, nombre de teintes, statut. Lookout les compare au marché."
          value={catalog}
          onChange={setCatalog}
          sampleUrl="/exemple-catalogue.csv"
        />
        {!catalog && savedCatalog > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useSaved} onChange={(e) => setUseSaved(e.target.checked)} />
            Comparer avec le catalogue déjà enregistré ({savedCatalog} produits)
          </label>
        )}
      </div>

      <Card>
        <h2 className="mb-4 font-semibold">3. Périmètre</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-5">
            <fieldset>
              <legend className="text-sm font-medium">Zones</legend>
              <div className="mt-2 flex gap-4 text-sm">
                {(["US", "EU"] as Zone[]).map((z) => (
                  <label key={z} className="flex items-center gap-2">
                    <input type="checkbox" checked={zones.includes(z)} onChange={() => setZones(toggle(zones, z))} />
                    {z === "US" ? "États-Unis" : "Europe"}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium">Sites à fouiller</legend>
              <p className="text-xs text-ink-soft">Aucun coché = tous les sites actifs des zones choisies.</p>
              <div className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
                {zoneSites.map((s) => (
                  <label key={s.domain} className="flex items-center gap-2">
                    <input type="checkbox" checked={siteIds.includes(s.domain)} onChange={() => setSiteIds(toggle(siteIds, s.domain))} />
                    {s.name} <span className="text-xs text-ink-soft">{s.zone}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="space-y-5">
            <Field label="Produits ciblés" hint="Mots-clés ajoutés aux recherches (ex. « liquid blush », « vitamine C »).">
              <input className={inputCls} value={focus} onChange={(e) => setFocus(e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={focusOnly} onChange={(e) => setFocusOnly(e.target.checked)} />
              Ne garder que les lignes Circana qui contiennent ces mots-clés
            </label>

            <fieldset>
              <legend className="text-sm font-medium">Marques exclues</legend>
              {!brands.length && <p className="text-xs text-ink-soft">Importez le fichier Circana pour choisir les marques à exclure.</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {brands.map((b) => {
                  const on = excluded.includes(b);
                  return (
                    <button
                      type="button"
                      key={b}
                      aria-pressed={on}
                      onClick={() => setExcluded(toggle(excluded, b))}
                      className={`rounded-full border px-3 py-1 text-xs ${on ? "border-bad bg-bad/10 text-bad line-through" : "border-line"}`}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        </div>
      </Card>

      <ErrorText>{error}</ErrorText>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-ink px-6 py-4 text-white">
        <p className="text-sm">
          {circana ? (
            <>
              <strong>{Math.min(kept.length, max)}</strong> produits seront analysés
              {kept.length > max && <span className="text-amber"> (limite de {max} produits par analyse)</span>}
              {catalog ? <> · {catalog.rows.length} produits de votre catalogue à comparer</> : useSaved && savedCatalog > 0 ? <> · catalogue enregistré ({savedCatalog} produits) à comparer</> : null}
            </>
          ) : (
            "Importez le fichier Circana pour commencer."
          )}
        </p>
        <button type="submit" disabled={busy} className="rounded-md bg-amber px-5 py-2.5 text-sm font-medium text-ink disabled:opacity-60">
          {busy ? "Lancement…" : "Lancer l'analyse"}
        </button>
      </div>
    </form>
  );
}

export default function NewPage() {
  return (
    <Private>
      <NewAnalysis />
    </Private>
  );
}
