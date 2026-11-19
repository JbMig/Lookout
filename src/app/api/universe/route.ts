import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { loadUniverse } from "@/lib/universe";

/** Catalogue, marché et ventes normalisés (pages catalogue, marché, concurrents). */
export const GET = handle(async () => {
  await requireUser();
  return loadUniverse();
});
