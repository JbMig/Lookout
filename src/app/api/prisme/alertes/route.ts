import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { enregistrerInstantane } from "@/lib/prisme-historique";
import { alertes } from "@/lib/alertes";

/** Veille de crise : alertes sur les marques du groupe L'Oréal. */
export const maxDuration = 120;
export const GET = handle(async () => {
  const user = await requireUser();
  const r = await alertes();
  // gardé dans l'historique « Social listening » (au plus un relevé toutes les 3 h) ; un échec n'empêche pas l'affichage
  await enregistrerInstantane("alertes", r, { userId: user.userId, email: user.email }).catch((e) => console.error("Historique : enregistrement impossible", e));
  return r;
});
