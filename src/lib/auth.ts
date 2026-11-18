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

const DEMO_COOKIE = "lk_demo";

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
    // Le cookie porte l'identité complète : la session tient même si le stockage
    // local du serveur est vide (Vercel : une copie par fonction).
    const demo = readDemoCookie((await cookies()).get(DEMO_COOKIE)?.value);
    if (!demo) return null;
    const p = await repo().get<ProfileRow>("profiles", demo.id);
    if (!p) await ensureProfile(demo.id, demo.email, demo.name ?? undefined);
    return { userId: demo.id, email: demo.email, fullName: p?.full_name ?? demo.name, isStaff: isStaff(demo.email) };
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
  const value = Buffer.from(JSON.stringify({ id: userId, email: email.toLowerCase(), name: fullName ?? existing[0]?.full_name ?? null })).toString("base64url");
  (await cookies()).set(DEMO_COOKIE, value, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

/** Lit le cookie de démo ({ id, email, name } en base64url). */
export function readDemoCookie(raw: string | undefined): { id: string; email: string; name: string | null } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    return typeof v?.id === "string" && typeof v?.email === "string" ? { id: v.id, email: v.email, name: v.name ?? null } : null;
  } catch {
    return null;
  }
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
