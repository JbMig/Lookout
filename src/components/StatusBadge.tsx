const STYLES: Record<string, { label: string; cls: string }> = {
  collecting: { label: "Collecte en cours", cls: "bg-amber/20 text-amber-dark" },
  analyzing: { label: "Analyse en cours", cls: "bg-amber/20 text-amber-dark" },
  done: { label: "Terminé", cls: "bg-ok/10 text-ok" },
  failed: { label: "Échec", cls: "bg-bad/10 text-bad" },
  pending: { label: "En attente", cls: "bg-line text-ink-soft" },
  navigating: { label: "Computer use", cls: "bg-ink/10 text-ink" },
  awaiting_team: { label: "Traitement équipe", cls: "bg-amber/20 text-amber-dark" },
  partial: { label: "Incomplet", cls: "bg-amber/20 text-amber-dark" },
  untested: { label: "Non testé", cls: "bg-line text-ink-soft" },
  scraping: { label: "Scraping", cls: "bg-ok/10 text-ok" },
  linkup: { label: "Linkup", cls: "bg-ok/10 text-ok" },
  computer_use: { label: "Computer use", cls: "bg-ink/10 text-ink" },
  needs_review: { label: "À traiter", cls: "bg-amber/20 text-amber-dark" },
  blocked: { label: "Bloqué", cls: "bg-bad/10 text-bad" },
  requested: { label: "Demandé", cls: "bg-line text-ink-soft" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STYLES[status] ?? { label: status, cls: "bg-line text-ink-soft" };
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
