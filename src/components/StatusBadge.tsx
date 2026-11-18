import { Pill } from "./ui";

type Tone = "neutral" | "wait" | "ok" | "bad" | "night";

const STYLES: Record<string, { label: string; tone: Tone }> = {
  collecting: { label: "Collecte en cours", tone: "wait" },
  analyzing: { label: "Analyse en cours", tone: "wait" },
  done: { label: "Terminé", tone: "ok" },
  failed: { label: "Échec", tone: "bad" },
  pending: { label: "En attente", tone: "neutral" },
  navigating: { label: "Computer use", tone: "night" },
  awaiting_team: { label: "Chez l'équipe", tone: "wait" },
  partial: { label: "Incomplet", tone: "wait" },
  untested: { label: "Non testé", tone: "neutral" },
  scraping: { label: "Scraping", tone: "ok" },
  linkup: { label: "Linkup", tone: "ok" },
  computer_use: { label: "Computer use", tone: "night" },
  needs_review: { label: "À traiter", tone: "wait" },
  blocked: { label: "Bloqué", tone: "bad" },
  requested: { label: "Demandé", tone: "neutral" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STYLES[status] ?? { label: status, tone: "neutral" as Tone };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}
