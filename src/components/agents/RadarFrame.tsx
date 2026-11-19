"use client";
import { useState } from "react";
import { Check, Download, FileDown, Link2, Loader2 } from "lucide-react";
import { api } from "@/lib/client";
import { btnSecondary } from "@/components/ui";

/** Le dashboard « Market Radar » tel que fourni, affiché dans un cadre pleine hauteur. */
export function RadarFrame({ src, title, height = "h-[calc(100dvh-120px)]" }: { src: string; title: string; height?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative">
      {!loaded && <div className="absolute inset-0 flex items-center justify-center rounded-[14px] bg-ground text-sm text-ink-soft"><Loader2 size={18} className="mr-2 animate-spin" aria-hidden />Chargement des données…</div>}
      <iframe id="radar-frame" src={src} title={title} onLoad={() => setLoaded(true)} className={`block ${height} min-h-[640px] w-full rounded-[14px] border border-line bg-ground`} />
    </div>
  );
}

export function RadarActions({ id, shareSlug }: { id: string; shareSlug: string | null }) {
  const [token, setToken] = useState(shareSlug);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  async function share() {
    setBusy(true);
    try {
      const t = token ?? (await api<{ token: string }>(`/api/reports/${id}/share`, { method: "POST" })).token;
      setToken(t);
      await navigator.clipboard?.writeText(`${window.location.origin}/share/${t}`).catch(() => undefined);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } finally {
      setBusy(false);
    }
  }
  const printFrame = () => {
    const w = (document.getElementById("radar-frame") as HTMLIFrameElement | null)?.contentWindow;
    if (w) { w.focus(); w.print(); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={share} disabled={busy} title="Copie un lien en lecture seule, réservé aux comptes Lookout" className={btnSecondary}>
        {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : copied ? <Check size={15} aria-hidden /> : <Link2 size={15} aria-hidden />}
        {copied ? "Lien copié" : "Partager"}
      </button>
      <button type="button" onClick={printFrame} className={btnSecondary}><FileDown size={15} aria-hidden />PDF</button>
      <a href={`/api/dashboards/${id}/radar?download=1`} className={btnSecondary}><Download size={15} aria-hidden />HTML</a>
      {token && <a href={`/share/${token}`} target="_blank" rel="noreferrer" className="max-w-[260px] truncate text-[12px] text-ink-faint underline-offset-4 hover:underline">/share/{token}</a>}
    </div>
  );
}
