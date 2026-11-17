import { z } from "zod";
import { body, handle } from "@/lib/http";
import { demoLogin, supabaseAuth, HttpError } from "@/lib/auth";
import { isDemo } from "@/lib/config";

const Body = z.object({ email: z.string().email("E-mail invalide"), password: z.string().optional() });

export const POST = handle(async (req: Request) => {
  const { email, password } = Body.parse(await body(req));
  if (isDemo.db) {
    await demoLogin(email);
    return { ok: true };
  }
  if (!password) throw new HttpError(400, "Mot de passe requis");
  const { error } = await (await supabaseAuth()).auth.signInWithPassword({ email, password });
  if (error) throw new HttpError(401, "E-mail ou mot de passe incorrect");
  return { ok: true };
});
