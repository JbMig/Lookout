import { z } from "zod";
import { body, handle } from "@/lib/http";
import { HttpError, requireStaff, requireUser } from "@/lib/auth";
import { addSite, listSites, siteByDomain } from "@/lib/sites";

/** Sites surveillés (table sites). Les parcours de computer use ne sont visibles que par l'équipe. */
export const GET = handle(async () => {
  const user = await requireUser();
  const sites = await listSites();
  return { sites: sites.map((s) => (user.isStaff ? s : { ...s, cuInstructions: undefined })) };
});

const NewSite = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((d) => d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""))
    .pipe(z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "Domaine invalide (ex. : sephora.it)")),
  name: z.string().trim().min(1, "Nom requis").max(80),
  zone: z.enum(["US", "EU"]),
  country: z.string().trim().max(60).nullable().default(null),
  type: z.enum(["revendeur", "marque", "marketplace"]).default("revendeur"),
  categories: z.array(z.string().trim().min(1)).default([]),
});

/** Ajout manuel d'un site par l'équipe. */
export const POST = handle(async (req: Request) => {
  await requireStaff();
  const input = NewSite.parse(await body(req));
  if (await siteByDomain(input.domain)) throw new HttpError(409, "Ce site est déjà dans la liste");
  return { site: await addSite(input) };
});
