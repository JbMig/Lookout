import { z } from "zod";

/** Un champ texte vide est traité comme absent (le formulaire envoie "" quand le champ est masqué). */
const optionalText = (schema: z.ZodString) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());

export const SignupInput = z.object({
  email: z.string().trim().email("E-mail invalide"),
  password: optionalText(z.string()),
  fullName: optionalText(z.string().trim().max(80)),
});

export const LoginInput = z.object({
  email: z.string().trim().email("E-mail invalide"),
  password: optionalText(z.string()),
});

export const PASSWORD_MIN = 8;
