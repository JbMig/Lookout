"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImageOff, Loader2, Play } from "lucide-react";
import { api, fmtDateTime as fmtDate } from "@/lib/client";
import { agentInfo, type AgentId, type AgentRun } from "@/lib/agent-runs";
import { FORMATS, inZone, type Format, type Zone } from "@/lib/normalize";
import { StatusBadge } from "@/components/StatusBadge";
import { btnAccent, controlCls } from "@/components/ui";
import type { Universe } from "@/lib/universe";
import type { AgentConfig } from "@/lib/settings";
import { NEEDS_SETTINGS, missingSettings } from "@/lib/settings-check";

/* ---------------- Devises (Frankfurter, côté navigateur) ---------------- */

let ratesCache: Promise<Record<string, number>> | null = null;
function fetchRates() {
  ratesCache ??= fetch("https://api.frankfurter.dev/v1/latest?base=EUR")
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((d: { rates: Record<string, number> }) => ({ EUR: 1, ...d.rates }))
    .catch(() => ({ EUR: 1, USD: 1.08, GBP: 0.85, CNY: 7.8, KRW: 1450 }));
  return ratesCache;
}

/** Conversion en euros (taux du jour de la BCE via Frankfurter). Les données restent stockées en devise d'origine. */
export function useEur() {
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let alive = true;
    fetchRates().then((r) => alive && setRates(r));
    return () => { alive = false; };
  }, []);
  return useCallback(
    (v: number | null | undefined, cur: string | null | undefined) => {
      if (v === null || v === undefined) return null;
      const r = rates?.[cur || "EUR"];
      return r ? v / r : cur === "EUR" || !cur ? v : null;
    },
    [rates],
  );
}

export const money = (v: number | null | undefined, cur?: string | null, digits = 2) =>
  v === null || v === undefined ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur || "EUR", currencyDisplay: "narrowSymbol", maximumFractionDigits: digits }).format(v);

/** Chiffre d'affaires compact : 8,1 M$, 640 k€. */
export const revenue = (v: number | null | undefined, cur?: string | null) =>
  v === null || v === undefined ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur || "EUR", currencyDisplay: "narrowSymbol", notation: "compact", maximumFractionDigits: 1 }).format(v);

export const growthPct = (prev: number | null | undefined, cur: number | null | undefined) =>
  prev && cur !== null && cur !== undefined ? Math.round(((cur - prev) / prev) * 1000) / 10 : null;

/* ---------------- Réglages ---------------- */

let settingsCache: Promise<AgentConfig | null> | null = null;

/** À appeler après l'enregistrement des réglages. */
export function invalidateSettings() {
  settingsCache = null;
}

/** Réglages manquants (null pendant le chargement). */
export function useMissingSettings() {
  const [missing, setMissing] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    settingsCache ??= api<{ config: AgentConfig }>("/api/settings").then((r) => r.config).catch(() => null);
    settingsCache.then((c) => alive && setMissing(missingSettings(c)));
    return () => { alive = false; };
  }, []);
  return missing;
}

/* ---------------- Agents ---------------- */

export function useAgentRuns() {
  const [runs, setRuns] = useState<AgentRun[] | null>(null);
  const [link, setLink] = useState<string>("aucun");
  const refresh = useCallback(() => api<{ runs: AgentRun[]; link: string }>("/api/agents").then((r) => { setRuns(r.runs); setLink(r.link); }).catch(() => setRuns([])), []);
  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);
  return { runs, link, refresh };
}

export async function launchAgent(agent: AgentId, params: Record<string, unknown> = {}) {
  return (await api<{ run: AgentRun }>("/api/agents/run", { method: "POST", json: { agent, params } })).run;
}

/** Bouton « Lancer » d'une page : déclenche l'agent et affiche son dernier passage. */
export function AgentButton({
  agent,
  label,
  params,
  disabled,
  onDone,
}: {
  agent: AgentId;
  label: string;
  params?: Record<string, unknown>;
  disabled?: string | null;
  onDone?: (run: AgentRun) => void;
}) {
  const { runs, refresh } = useAgentRuns();
  const missing = useMissingSettings();
  const blocked = NEEDS_SETTINGS.includes(agent) && (missing === null || missing.length > 0);
  const reason = disabled ?? (blocked ? (missing === null ? "Vérification des réglages…" : "Remplissez les réglages pour lancer cet agent.") : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = runs?.find((r) => r.agent === agent) ?? null;
  const info = agentInfo(agent);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const run = await launchAgent(agent, params);
      await refresh();
      onDone?.(run);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button type="button" onClick={go} disabled={busy || !!reason} title={reason ?? undefined} className={`${btnAccent} disabled:cursor-not-allowed disabled:opacity-60`}>
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Play size={15} aria-hidden />}
        {busy ? "Agent en cours…" : label}
      </button>
      <p className="line-clamp-2 max-w-[340px] text-[12.5px] text-ink-faint sm:text-right" aria-live="polite">
        {error ? <span className="text-bad">{error}</span>
          : reason ? <>{reason}{blocked && missing?.length ? <> <Link href="/settings" className="font-medium text-ink underline underline-offset-4">Ouvrir les réglages</Link></> : null}</>
          : last ? <>Agent {info.id} · <span className="whitespace-nowrap">{fmtDate(last.at)}</span> · {last.message}</>
          : <>Agent {info.id} · jamais lancé depuis le site</>}
      </p>
      {last && !error && !reason && <StatusBadge status={last.status} />}
    </div>
  );
}

/* ---------------- Filtres ---------------- */

export interface Filters { zone: string; format: string; min: string; max: string; brand: string }
export const NO_FILTERS: Filters = { zone: "all", format: "all", min: "", max: "", brand: "all" };

interface Filterable { zone: Zone | null; country: string | null; format: Format; price: number | null; currency: string | null; brand: string }

export function useFiltered<T extends Filterable>(items: T[], f: Filters) {
  const eur = useEur();
  return useMemo(() => {
    const min = f.min === "" ? null : Number(f.min);
    const max = f.max === "" ? null : Number(f.max);
    return items.filter((i) => {
      if (!inZone(i, f.zone)) return false;
      if (f.format !== "all" && i.format !== f.format) return false;
      if (f.brand !== "all" && i.brand !== f.brand) return false;
      if (min !== null || max !== null) {
        const p = eur(i.price, i.currency);
        if (p === null) return false;
        if (min !== null && p < min) return false;
        if (max !== null && p > max) return false;
      }
      return true;
    });
  }, [items, f, eur]);
}

export function FilterBar({ value, onChange, brands, show = ["zone", "format", "price"] }: {
  value: Filters;
  onChange: (f: Filters) => void;
  brands?: string[];
  show?: ("zone" | "format" | "price" | "brand")[];
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });
  const active = JSON.stringify(value) !== JSON.stringify(NO_FILTERS);
  return (
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filtres">
      {show.includes("zone") && (
        <label className="grid gap-1 text-[12.5px] font-medium text-ink-soft">Zone
          <select value={value.zone} onChange={(e) => set({ zone: e.target.value })} className={controlCls}>
            <option value="all">Toutes</option>
            <option value="US">États-Unis</option>
            <option value="EU">Europe</option>
            <option value="FR">France</option>
          </select>
        </label>
      )}
      {show.includes("format") && (
        <label className="grid gap-1 text-[12.5px] font-medium text-ink-soft">Format
          <select value={value.format} onChange={(e) => set({ format: e.target.value })} className={controlCls}>
            <option value="all">Tous</option>
            {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
      )}
      {show.includes("brand") && brands && (
        <label className="grid gap-1 text-[12.5px] font-medium text-ink-soft">Marque
          <select value={value.brand} onChange={(e) => set({ brand: e.target.value })} className={`${controlCls} max-w-[200px]`}>
            <option value="all">Toutes</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
      )}
      {show.includes("price") && (
        <fieldset className="grid gap-1 text-[12.5px] font-medium text-ink-soft">
          <legend className="mb-1">Prix (€)</legend>
          <div className="flex items-center gap-1.5">
            <input inputMode="decimal" aria-label="Prix minimum en euros" placeholder="min" value={value.min} onChange={(e) => set({ min: e.target.value.replace(/[^0-9.]/g, "") })} className={`${controlCls} w-20`} />
            <span aria-hidden>–</span>
            <input inputMode="decimal" aria-label="Prix maximum en euros" placeholder="max" value={value.max} onChange={(e) => set({ max: e.target.value.replace(/[^0-9.]/g, "") })} className={`${controlCls} w-20`} />
          </div>
        </fieldset>
      )}
      {active && (
        <button type="button" onClick={() => onChange(NO_FILTERS)} className="press mb-1 text-[13px] font-medium text-ink-soft underline-offset-4 hover:underline">
          Réinitialiser
        </button>
      )}
    </div>
  );
}

/* ---------------- Visuels produit ---------------- */

export function Packshot({ src, alt, size = 64 }: { src: string | null; alt: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className="flex shrink-0 items-center justify-center rounded-[10px] bg-ground text-ink-faint" style={{ width: size, height: size }} aria-label="Pas de packshot">
        <ImageOff size={Math.round(size / 3.2)} aria-hidden />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={size} height={size} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)}
      className="shrink-0 rounded-[10px] bg-ground object-contain" style={{ width: size, height: size }} />
  );
}

export interface SwatchShade { name: string; hex: string | null; family: string | null; available?: boolean; bestseller?: boolean }

/** Gamme de teintes (shaderange) : une pastille par teinte, hex au survol. */
export function Shaderange({ shades, max = 10, size = 18 }: { shades: SwatchShade[]; max?: number; size?: number }) {
  if (!shades.length) return <span className="text-[12.5px] text-ink-faint">Aucune teinte</span>;
  const shown = shades.slice(0, max);
  return (
    <div className="flex flex-wrap items-center gap-1" role="list" aria-label={`${shades.length} teintes`}>
      {shown.map((s, i) => (
        <span
          key={`${s.name}-${i}`}
          role="listitem"
          title={`${s.name}${s.hex ? ` · ${s.hex}` : ""}${s.family ? ` · ${s.family}` : ""}${s.available === false ? " · indisponible" : ""}${s.bestseller ? " · best-seller" : ""}`}
          className={`inline-block rounded-full shadow-[inset_0_0_0_1px_rgb(19_35_63/0.12)] ${s.available === false ? "opacity-40" : ""}`}
          style={{ width: size, height: size, background: s.hex ?? "#CCCCCC" }}
        />
      ))}
      {shades.length > max && <span className="ml-1 text-[12px] text-ink-faint">+{shades.length - max}</span>}
    </div>
  );
}

export function TrendPill({ trend }: { trend: "croissance" | "stable" | "declin" | null }) {
  if (!trend) return <span className="text-[12.5px] text-ink-faint">Pas de ventes</span>;
  const map = { croissance: ["ok", "En croissance"], stable: ["neutral", "Stable"], declin: ["bad", "En déclin"] } as const;
  const [tone, label] = map[trend];
  const dot = { ok: "bg-ok", neutral: "bg-ink-faint", bad: "bg-bad" }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-paper px-2.5 py-0.5 text-[13px] font-medium">
      <i className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />{label}
    </span>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-line bg-paper px-4 py-3.5">
      <p className="text-[12.5px] font-medium text-ink-faint">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-[-0.02em]">{value}</p>
      {sub && <p className="mt-0.5 text-[12.5px] text-ink-soft">{sub}</p>}
    </div>
  );
}

/** Bandeau tant que les réglages ne sont pas remplis : les agents restent bloqués. */
export function SettingsBanner() {
  const missing = useMissingSettings();
  if (!missing?.length) return null;
  return (
    <p className="rounded-[10px] border border-amber/40 bg-amber/10 px-4 py-2.5 text-sm">
      Remplissez d&apos;abord les <Link href="/settings" className="font-medium underline underline-offset-4">réglages</Link> : il manque {missing.join(", ")}. Les agents ne peuvent pas être lancés avant.
    </p>
  );
}

/* ---------------- Données ---------------- */


export function useUniverse() {
  const [data, setData] = useState<Universe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => api<Universe>("/api/universe").then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { void Promise.resolve().then(reload); }, [reload]);
  return { data, error, reload };
}

/** Fait défiler jusqu'à l'élément visé par l'ancre (#p-… / #c-…) une fois les données chargées. */
export function useHashScroll(ready: boolean) {
  useEffect(() => {
    if (!ready || !window.location.hash) return;
    const el = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    if (!el) return;
    el.scrollIntoView({ block: "start" });
    el.classList.add("ring-2", "ring-amber", "rounded-[14px]");
  }, [ready]);
}

export function namesOf(u: Universe | null): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of u?.catalog ?? []) m.set(c.id, c.name);
  for (const p of u?.market ?? []) m.set(p.id, `${p.brand} ${p.name}`);
  return m;
}
