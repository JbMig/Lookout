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


/** Un champ texte vide est traité comme absent (le formulaire envoie "" quand le champ est masqué). */
const optionalText = (schema: z.ZodString) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());

export const SignupInput = z.object({
  email: z.string().trim().email("E-mail invalide"),
  password: optionalText(z.string()),
  fullName: optionalText(z.string().trim().max(80)),
  orgName: optionalText(z.string().trim().max(80)),
});

export const LoginInput = z.object({
  email: z.string().trim().email("E-mail invalide"),
  password: optionalText(z.string()),
});

export const PASSWORD_MIN = 8;
