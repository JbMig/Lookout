import { config, isDemo } from "../config";
import { PRODUCT_JSON_SCHEMA, toProductSheet } from "../product";
import type { CircanaRow, ProductSheet } from "../types";
import { demoSheet } from "./demo";

/**
 * Étape 4 : computer use H Company. Lancé par l'équipe depuis l'administration,
 * ou automatiquement quand le site a un parcours enregistré.
 * La session est créée sans attendre, puis interrogée à chaque étape.
 */

const TERMINAL = ["completed", "failed", "timed_out", "interrupted"];

export async function startNavigator(opts: {
  row: CircanaRow;
  url: string | null;
  domain: string | null;
  instructions: string | null; // parcours enregistré pour ce site
  missing: string[];
}): Promise<string> {
  if (isDemo.hcompany) return `demo-${Date.now()}`;
  const { row, url, domain, instructions, missing } = opts;
  const task = [
    url ? `Open ${url}.` : `Go to https://www.${domain}, search for "${row.brand} ${row.product}" and open the matching product page.`,
    instructions ? `Site-specific steps: ${instructions}` : `Accept or close any cookie banner or country pop-up.`,
    `Collect: exact product name, brand, displayed price and currency, the full ingredient list (INCI, often in an "Ingredients" tab or accordion: open it),`,
    `every available size/format with its price, all shade names (open the shade selector), packaging type, main product image URL, and the page URL.`,
    missing.length ? `These fields are especially needed: ${missing.join(", ")}.` : "",
    `If the product cannot be found, answer with found=false.`,
  ].join(" ");

  const res = await fetch(`${config.hcompany.baseUrl}/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.hcompany.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      agent: config.hcompany.agent,
      messages: task,
      max_time_s: config.hcompany.maxTimeS,
      overrides: { "agent.answer_format": PRODUCT_JSON_SCHEMA },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`H Company ${res.status} : ${(await res.text().catch(() => "")).slice(0, 160)}`);
  return ((await res.json()) as { id: string }).id;
}

export type NavigatorPoll = { done: false; viewUrl?: string | null } | { done: true; sheet: ProductSheet | null; error: string | null };

export async function pollNavigator(sessionId: string, row: CircanaRow): Promise<NavigatorPoll> {
  if (sessionId.startsWith("demo-")) {
    if (Date.now() - Number(sessionId.slice(5)) < 6000) return { done: false };
    return { done: true, sheet: demoSheet(row, true), error: null };
  }
  const res = await fetch(`${config.hcompany.baseUrl}/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${config.hcompany.apiKey}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`H Company ${res.status}`);
  const s = (await res.json()) as {
    status?: { status?: string; error?: string | null } | string;
    latest_answer?: unknown;
    agent_view_url?: string;
  };
  const status = typeof s.status === "string" ? s.status : s.status?.status;
  if (!status || !TERMINAL.includes(status)) return { done: false, viewUrl: s.agent_view_url ?? null };
  if (status !== "completed") {
    const err = typeof s.status === "object" ? s.status?.error : null;
    return { done: true, sheet: null, error: `Session ${status}${err ? ` : ${err}` : ""}` };
  }
  const a = s.latest_answer;
  const raw = a && typeof a === "object" && "answer" in (a as Record<string, unknown>) ? (a as Record<string, unknown>).answer : a;
  return { done: true, sheet: toProductSheet(raw, { brand: row.brand, name: row.product }), error: null };
}
