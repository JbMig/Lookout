import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { alertes } from "@/lib/alertes";

/** Veille de crise : alertes sur les marques du groupe L'Oréal. */
export const maxDuration = 120;
export const GET = handle(async () => {
  await requireUser();
  return alertes();
});
