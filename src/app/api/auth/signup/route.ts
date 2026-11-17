import { body, handle } from "@/lib/http";
import { demoLogin, ensureAccount, supabaseAuth, HttpError } from "@/lib/auth";
import { isDemo } from "@/lib/config";
import { PASSWORD_MIN, SignupInput } from "@/lib/schemas";

export const POST = handle(async (req: Request) => {
  const { email, password, fullName, orgName } = SignupInput.parse(await body(req));
  // Mode démo : aucun mot de passe n'est demandé ni vérifié.
  if (isDemo.db) {
    await demoLogin(email, fullName, orgName);
    return { ok: true };
  }
  if (!password || password.length < PASSWORD_MIN) {
    throw new HttpError(400, `Le mot de passe doit faire au moins ${PASSWORD_MIN} caractères.`);
  }
  const { data, error } = await (await supabaseAuth()).auth.signUp({ email, password });
  if (error) throw new HttpError(400, error.message);
  if (data.user) await ensureAccount(data.user.id, email, fullName, orgName);
  return { ok: true, needsConfirmation: !data.session };
});
