"use client";
import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";

type Flags = { db: boolean; linkup: boolean; hcompany: boolean; hf: boolean };
const LABELS: Record<keyof Flags, string> = { db: "Supabase", linkup: "Linkup", hcompany: "H Company", hf: "Hugging Face" };

/** Bandeau qui signale les services en mode démo (clé absente). */
export function DemoBanner() {
  const [flags, setFlags] = useState<Flags | null>(null);
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((j) => setFlags(j.demo))
      .catch(() => null);
  }, []);
  if (!flags) return null;
  const demo = (Object.keys(flags) as (keyof Flags)[]).filter((k) => flags[k]);
  if (!demo.length) return null;
  return (
    <div className="flex items-center justify-center gap-2 border-b border-amber/30 bg-amber-wash px-5 py-2 text-center text-[13px] text-amber-dark">
      <FlaskConical size={14} aria-hidden className="shrink-0" />
      <span>Mode démo pour {demo.map((k) => LABELS[k]).join(", ")} : les données de ces services sont fictives.</span>
    </div>
  );
}
