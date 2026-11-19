import { handle } from "@/lib/http";
import { requireUser, HttpError } from "@/lib/auth";
import { focusMarque } from "@/lib/prisme-dashboard";

/** Vue d'une marque (ou du groupe L'Oréal : marque=groupe) dans la veille affichée par Prisme. */
export const GET = handle(async (req: Request) => {
  await requireUser();
  const u = new URL(req.url);
  const veille = u.searchParams.get("veille"), marque = u.searchParams.get("marque");
  if (!veille || !marque || marque.length > 80) throw new HttpError(400, "Paramètres veille et marque requis");
  return focusMarque(veille, marque);
});
