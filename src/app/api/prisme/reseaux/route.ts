import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { reseauxMarques } from "@/lib/reseaux";

/** Réseaux des marques : comptes officiels L'Oréal et concurrents. */
export const GET = handle(async () => {
  await requireUser();
  return reseauxMarques();
});
