/**
 * Conversion des prix en euros avec les taux de la BCE (API Frankfurter).
 * Taux de secours si l'API ne répond pas.
 */
const FALLBACK_RATES: Record<string, number> = { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95, JPY: 165, KRW: 1480 };

let cache: { at: number; rates: Record<string, number> } | null = null;

async function rates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.at < 6 * 3600_000) return cache.rates;
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=EUR", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as { rates: Record<string, number> };
    cache = { at: Date.now(), rates: { EUR: 1, ...json.rates } };
  } catch {
    cache = { at: Date.now(), rates: FALLBACK_RATES };
  }
  return cache.rates;
}

export async function toEur(amount: number | null, currency: string | null): Promise<number | null> {
  if (amount === null || !currency) return null;
  const r = (await rates())[currency.toUpperCase()];
  if (!r) return null;
  return Math.round((amount / r) * 100) / 100;
}
