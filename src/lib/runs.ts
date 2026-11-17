/**
 * Journalisation des appels aux services externes (visible dans les logs Vercel).
 * Le schéma Supabase n'a pas de table de suivi des appels.
 */
export function logRun(service: "linkup" | "hcompany" | "huggingface" | "scraping", action: string, ok: boolean, reportId?: string) {
  console.info(JSON.stringify({ lookout: "run", service, action, ok, reportId: reportId ?? null, at: new Date().toISOString() }));
}
