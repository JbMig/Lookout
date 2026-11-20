import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { enregistrerInstantane } from "@/lib/prisme-historique";
import { reseauxMarques } from "@/lib/reseaux";

/** Réseaux des marques : comptes officiels L'Oréal et concurrents. */
export const GET = handle(async () => {
  const user = await requireUser();
  const r = await reseauxMarques();
  // gardé dans l'historique « Social listening » (au plus un relevé toutes les 3 h) ; un échec n'empêche pas l'affichage
  await enregistrerInstantane("reseaux", r, { userId: user.userId, email: user.email }).catch((e) => console.error("Historique : enregistrement impossible", e));
  return r;
});
