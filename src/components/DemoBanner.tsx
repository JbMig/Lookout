"use client";
import { useEffect, useState } from "react";

type Flags = { db: boolean; linkup: boolean; hcompany: boolean; hf: boolean };
const LABELS: Record<keyof Flags, string> = {
  db: "Supabase",
  linkup: "Linkup",
  hcompany: "H Company",
  hf: "Hugging Face",
};

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
    <div className="border-b border-amber/40 bg-amber/15 px-6 py-2 text-center text-sm text-amber-dark">
      Mode démo pour : {demo.map((k) => LABELS[k]).join(", ")}. Les données de ces services sont fictives
      tant que leurs clés ne sont pas renseignées.
    </div>
  );
}
