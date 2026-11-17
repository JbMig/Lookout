import { config, isDemo } from "../config";
import { PRODUCT_JSON_SCHEMA, toProductSheet } from "../product";
import type { CircanaRow, ProductSheet } from "../types";
import { demoSheet } from "./demo";

/**
 * Étape 3 : extraction Linkup. Quand le scraping direct est incomplet,
 * Linkup lit la page (rendu JavaScript compris) et renvoie une fiche structurée.
 */
export async function linkupExtract(row: CircanaRow, url: string | null, domains: string[]): Promise<ProductSheet | null> {
  if (isDemo.linkup) return demoSheet(row, true);

  const target = url
    ? `Read the product page ${url}.`
    : `Find the product page for "${row.brand} ${row.product}" on one of: ${domains.join(", ")}.`;
  const q =
    `${target} Extract: exact product name, brand, displayed price and currency, the full INCI ingredient list, ` +
    `every available size/format with its price, all shade names (with hex color if shown), packaging type, ` +
    `main product image URL, and the page URL.`;

  const res = await fetch("https://api.linkup.so/v1/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.linkup.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      q,
      depth: config.linkup.depth,
      outputType: "structured",
      structuredOutputSchema: JSON.stringify(PRODUCT_JSON_SCHEMA),
      ...(url ? {} : { includeDomains: domains }),
    }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok) throw new Error(`Linkup ${res.status} : ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const json = (await res.json()) as unknown;
  const payload = json && typeof json === "object" && "data" in (json as Record<string, unknown>) ? (json as Record<string, unknown>).data : json;
  const sheet = toProductSheet(payload, { brand: row.brand, name: row.product });
  if (sheet && !sheet.sourceUrl) sheet.sourceUrl = url;
  return sheet;
}
