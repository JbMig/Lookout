"use client";
/** Appel aux routes API depuis le navigateur, avec message d'erreur lisible. */
export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.json !== undefined ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error ?? `Erreur ${res.status}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const fmtEur = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

export const fmtMoney = (v: number | null | undefined, cur?: string | null) =>
  v === null || v === undefined ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur || "EUR" }).format(v);

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
