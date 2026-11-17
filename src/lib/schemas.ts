import { z } from "zod";

export const SiteInput = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((d) => d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""))
    .refine((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d), "Domaine invalide (ex. sephora.fr)"),
  name: z.string().trim().min(1, "Nom requis").max(80),
  zone: z.enum(["US", "EU"]),
  country: z.string().trim().max(40).default(""),
  type: z.enum(["revendeur", "marque", "marketplace"]).default("revendeur"),
  categories: z.array(z.string().trim().min(1)).default([]),
});

