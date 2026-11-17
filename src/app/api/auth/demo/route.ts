import { handle } from "@/lib/http";
import { demoLogin, demoLoginEnabled, DEMO_ACCOUNT, HttpError, supabaseDemoLogin } from "@/lib/auth";
import { isDemo } from "@/lib/config";

/** Connexion en un clic au compte de démonstration. */
export const POST = handle(async () => {
  if (!demoLoginEnabled()) throw new HttpError(403, "La connexion de démonstration n'est pas activée.");
  if (isDemo.db) await demoLogin(DEMO_ACCOUNT.email, DEMO_ACCOUNT.fullName);
  else await supabaseDemoLogin();
  return { ok: true };
});
