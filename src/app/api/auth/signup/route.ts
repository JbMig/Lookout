import { z } from "zod";
import { body, handle } from "@/lib/http";
import { demoLogin, ensureAccount, supabaseAuth, HttpError } from "@/lib/auth";
import { isDemo } from "@/lib/config";

const Body = z.object({
  email: z.string().email("E-mail invalide"),
  password: z.string().min(8, "8 caractères minimum").optional(),
  fullName: z.string().trim().max(80).optional(),
  orgName: z.string().trim().max(80).optional(),
});

export const POST = handle(async (req: Request) => {
  const { email, password, fullName, orgName } = Body.parse(await body(req));
  if (isDemo.db) {
    await demoLogin(email, fullName, orgName);
    return { ok: true };
  }
  if (!password) throw new HttpError(400, "Mot de passe requis");
  const { data, error } = await (await supabaseAuth()).auth.signUp({ email, password });
  if (error) throw new HttpError(400, error.message);
  if (data.user) await ensureAccount(data.user.id, email, fullName, orgName);
  return { ok: true, needsConfirmation: !data.session };
});
