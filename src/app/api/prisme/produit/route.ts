import { handle } from "@/lib/http";
import { requireUser, HttpError } from "@/lib/auth";
import { detailProduit } from "@/lib/prisme-dashboard";

/** Détail d'un produit pour la pop-up du dashboard Prisme. */
export const GET = handle(async (req: Request) => {
  await requireUser();
  const u = new URL(req.url);
  const veille = u.searchParams.get("veille"), noms = u.searchParams.getAll("nom"), produit = u.searchParams.get("produit") ?? noms[0];
  if (!veille || !noms.length) throw new HttpError(400, "Paramètres veille et nom requis");
  return detailProduit(veille, noms, produit);
});
