"use client";
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { api } from "@/lib/client";
import { Private } from "@/components/Session";
import { Card, CardHead, ErrorText, Field, PageHeader, PageSkeleton, btnPrimary, inputCls } from "@/components/ui";
import type { AgentConfig } from "@/lib/settings";
import { invalidateSettings } from "@/components/agents/kit";
import { missingSettings } from "@/lib/settings-check";

const CATEGORIES = ["blush", "gloss", "rouge à lèvres", "mascara", "fond de teint", "highlighter", "bronzer", "fard à paupières"];
const FORMAT_CHOICES = [
  { id: "liquide", label: "Liquide" },
  { id: "compact", label: "Compact" },
  { id: "creme", label: "Crème" },
  { id: "stick", label: "Stick" },
] as const;

function Settings() {
  const [cfg, setCfg] = useState<AgentConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ config: AgentConfig }>("/api/settings").then((r) => setCfg(r.config)).catch((e) => setError(e.message));
  }, []);

  if (!cfg) return error ? <ErrorText>{error}</ErrorText> : <PageSkeleton />;
  const set = (patch: Partial<AgentConfig>) => { setCfg({ ...cfg, ...patch }); setSaved(false); };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await api<{ config: AgentConfig }>("/api/settings", { method: "PUT", json: cfg });
      setCfg(r.config);
      setSaved(true);
      invalidateSettings();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Réglages" meta={<span>Les informations dont les agents ont besoin pour travailler sur votre marque. Tous les champs sont obligatoires.</span>} />
      {missingSettings(cfg).length > 0 && !saved && (
        <p className="rounded-[10px] border border-amber/40 bg-amber/10 px-4 py-2.5 text-sm">
          À remplir avant de lancer une analyse : {missingSettings(cfg).join(", ")}.
        </p>
      )}
      <form onSubmit={save} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHead title="Votre marque" sub="Utilisé par l'audit du catalogue (Agent 0), l'enrichissement (Agent 2) et l'analyse (Agent 3)." />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Marque">
              <input required value={cfg.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="Lancôme" className={inputCls} />
            </Field>
            <Field label="Pays / zone">
              <select value={cfg.zone} onChange={(e) => set({ zone: e.target.value as AgentConfig["zone"] })} className={inputCls}>
                <option value="US">États-Unis</option>
                <option value="FR">France</option>
                <option value="EU">Europe</option>
              </select>
            </Field>
            <Field label="Catégorie">
              <select value={cfg.category} onChange={(e) => set({ category: e.target.value })} className={inputCls}>
                {[...new Set([cfg.category, ...CATEGORIES])].filter(Boolean).map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="URL de départ" hint="La page de la catégorie sur le site officiel de la marque.">
              <input type="url" required value={cfg.startUrl} onChange={(e) => set({ startUrl: e.target.value })} placeholder="https://www.lancome-usa.com/makeup/face-makeup/blushes-and-bronzers/" className={inputCls} />
            </Field>
          </div>
          <fieldset className="mt-6">
            <legend className="text-sm font-medium">Formats connus <span className="font-normal text-ink-faint">(au moins un)</span></legend>
            <p className="mt-0.5 text-[13px] text-ink-faint">Les formats que la marque propose déjà dans cette catégorie.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {FORMAT_CHOICES.map((f) => {
                const on = cfg.formats.includes(f.id);
                return (
                  <label key={f.id} className={`press flex cursor-pointer items-center gap-2 rounded-[10px] border px-3.5 py-2 text-sm font-medium ${on ? "border-night bg-night text-white" : "border-line bg-paper hover:border-[#d9cdbf]"}`}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => set({ formats: on ? cfg.formats.filter((x) => x !== f.id) : [...cfg.formats, f.id] })} />
                    {on && <Check size={14} aria-hidden />}{f.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-line pt-5">
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving && <Loader2 size={16} className="animate-spin" aria-hidden />}Sauvegarder la configuration
            </button>
            {saved && <span className="flex items-center gap-1.5 text-sm text-ok" role="status"><Check size={15} aria-hidden />Configuration enregistrée</span>}
          </div>
          <div className="mt-3"><ErrorText>{error}</ErrorText></div>
        </Card>
        <Card className="h-fit">
          <CardHead title="Qui s'en sert" />
          <ul className="space-y-3 text-sm">
            <li><b>Agent 0 · audit du catalogue</b><br /><span className="text-ink-soft">marque, zone, catégorie, formats, URL de départ</span></li>
            <li><b>Agent 2 · enrichissement</b><br /><span className="text-ink-soft">zone, catégorie</span></li>
            <li><b>Agent 3 · analyse</b><br /><span className="text-ink-soft">catégorie, zone ; la marque sépare votre catalogue des concurrents</span></li>
          </ul>
        </Card>
      </form>
    </div>
  );
}

export default function SettingsPage() {
  return <Private><Settings /></Private>;
}
