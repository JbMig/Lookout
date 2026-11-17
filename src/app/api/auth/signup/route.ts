import { body, handle } from "@/lib/http";
import { demoLogin, ensureProfile, supabaseAuth, HttpError } from "@/lib/auth";
import { isDemo } from "@/lib/config";
import { PASSWORD_MIN, SignupInput } from "@/lib/schemas";

export const POST = handle(async (req: Request) => {
  const { email, password, fullName } = SignupInput.parse(await body(req));
  if (isDemo.db) {
    await demoLogin(email, fullName);
    return { ok: true };
  }
  if (!password || password.length < PASSWORD_MIN) {
    throw new HttpError(400, `Le mot de passe doit faire au moins ${PASSWORD_MIN} caractères.`);
  }
  const { data, error } = await (await supabaseAuth()).auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  if (error) throw new HttpError(400, error.message);
  if (data.user && data.session) await ensureProfile(data.user.id, email, fullName);
  return { ok: true, needsConfirmation: !data.session };
});
