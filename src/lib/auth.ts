import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { config, demoLogin as demoCfg, isDemo } from "./config";
import { repo } from "./repo";
import type { ProfileRow, SessionUser } from "./types";

/**
 * Authentification.
 * - Supabase : Supabase Auth (e-mail + mot de passe). Le profil est créé dans `profiles`
 *   par le déclencheur `handle_new_user` du projet ; l'application le complète si besoin.
 * - Mode démo (sans Supabase) : session locale (cookie lk_demo_uid).
 * Le schéma est mono-client : tous les utilisateurs connectés partagent le même espace.
 * L'équipe Lookout (administration) est définie par STAFF_EMAILS.
 */

const DEMO_COOKIE = "lk_demo_uid";

export const DEMO_ACCOUNT = { email: demoCfg.email, fullName: "Compte démo" };

export function demoLoginEnabled() {
  return isDemo.db || (demoCfg.forced && !!demoCfg.password);
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function supabaseAuth() {
  const store = await cookies();
  return createServerClient(config.supabase.url, config.supabase.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) store.set(name, value, options);
      },
    },
  });
}

/** Garantit l'existence du profil (le déclencheur Supabase le crée normalement à l'inscription). */
export async function ensureProfile(userId: string, email: string, fullName?: string) {
  const existing = await repo().get<ProfileRow>("profiles", userId);
  if (!existing) {
    try {
      await repo().insert<ProfileRow>("profiles", [{ id: userId, email: email.toLowerCase(), full_name: fullName ?? null }]);
    } catch {
      /* créé entre-temps par le déclencheur */
    }
  } else if (fullName && !existing.full_name) {
    await repo().update("profiles", userId, { full_name: fullName });
  }
}

function isStaff(email: string) {
  const e = email.toLowerCase();
  if (demoLoginEnabled() && e === DEMO_ACCOUNT.email) return true;
  if (config.staffEmails.length) return config.staffEmails.includes(e);
  return isDemo.db; // en démo sans liste, tout le monde voit l'administration
}

export async function getSession(): Promise<SessionUser | null> {
  if (isDemo.db) {
    const userId = (await cookies()).get(DEMO_COOKIE)?.value;
    if (!userId) return null;
    const p = await repo().get<ProfileRow>("profiles", userId);
    if (!p?.email) return null;
    return { userId, email: p.email, fullName: p.full_name, isStaff: isStaff(p.email) };
  }
  const { data } = await (await supabaseAuth()).auth.getUser();
  const u = data.user;
  if (!u?.email) return null;
  const p = await repo().get<ProfileRow>("profiles", u.id);
  if (!p) await ensureProfile(u.id, u.email, (u.user_metadata?.full_name as string) ?? undefined);
  return { userId: u.id, email: u.email, fullName: p?.full_name ?? null, isStaff: isStaff(u.email) };
}

export async function demoLogin(email: string, fullName?: string) {
  const existing = await repo().select<ProfileRow>("profiles", { eq: { email: email.toLowerCase() } });
  const userId = existing[0]?.id ?? randomUUID();
  await ensureProfile(userId, email, fullName);
  (await cookies()).set(DEMO_COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

/** Avec Supabase : crée le compte démo s'il n'existe pas (e-mail confirmé d'office) et ouvre la session. */
export async function supabaseDemoLogin() {
  const admin = createClient(config.supabase.url, config.supabase.serviceKey, { auth: { persistSession: false } });
  const created = await admin.auth.admin.createUser({
    email: demoCfg.email,
    password: demoCfg.password,
    email_confirm: true,
    user_metadata: { full_name: DEMO_ACCOUNT.fullName },
  });
  if (created.error && !/already|registered|exists/i.test(created.error.message)) throw new HttpError(500, created.error.message);
  const { data, error } = await (await supabaseAuth()).auth.signInWithPassword({ email: demoCfg.email, password: demoCfg.password });
  if (error || !data.user) throw new HttpError(500, `Connexion démo impossible : ${error?.message ?? "utilisateur introuvable"}`);
  await ensureProfile(data.user.id, demoCfg.email, DEMO_ACCOUNT.fullName);
}

export async function logout() {
  if (isDemo.db) (await cookies()).delete(DEMO_COOKIE);
  else await (await supabaseAuth()).auth.signOut();
}

export async function requireUser(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new HttpError(401, "Connexion requise");
  return s;
}

export async function requireStaff(): Promise<SessionUser> {
  const s = await requireUser();
  if (!s.isStaff) throw new HttpError(403, "Réservé à l'équipe Lookout");
  return s;
}
