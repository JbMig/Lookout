import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { toClientProduct } from "@/lib/imports";
import type { CatalogProductRow } from "@/lib/types";

/** Catalogue du client déjà enregistré (table catalog_products). */
export const GET = handle(async () => {
  await requireUser();
  const rows = await repo().select<CatalogProductRow>("catalog_products", { order: ["updated_at", "desc"], limit: 2000 });
  return { products: rows.map((r) => ({ id: r.id, ...toClientProduct(r), updated_at: r.updated_at })) };
});
