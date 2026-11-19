"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { useSession } from "@/components/Session";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ErrorText, Field, Skeleton, btnPrimary, inputCls } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const { me, refresh } = useSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [demo, setDemo] = useState<boolean | null>(null); // base en mode démo (pas de mot de passe)
  const [oneClick, setOneClick] = useState(false); // connexion en un clic disponible
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "" });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ demo: { db: boolean }; demoLogin: boolean }>("/api/status")
      .then((s) => {
        setDemo(s.demo.db);
        setOneClick(s.demoLogin);
      })
      .catch(() => setDemo(false));
  }, []);
  useEffect(() => {
    if (me) router.replace(next);
  }, [me, next, router]);

  /** Mode démo : connexion directe au compte de démonstration. */
  async function demoAccess() {
    setError(null);
    setBusy(true);
    try {
      await api("/api/auth/demo", { method: "POST" });
      // On vérifie que la session est bien retrouvée avant de quitter la page.
      try {
        await api("/api/me");
      } catch {
        throw new Error(
          demo
            ? "La connexion a été acceptée mais la session est introuvable : sur Vercel, le mode démo ne conserve pas les données entre les requêtes. Branchez Supabase pour la démo en ligne."
            : "La connexion a été acceptée mais la session est introuvable. Réessayez.",
        );
      }
      await refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError("Saisissez un e-mail valide.");
    if (!demo && form.password.length < (mode === "signup" ? 8 : 1)) {
      return setError(mode === "signup" ? "Le mot de passe doit faire au moins 8 caractères." : "Saisissez votre mot de passe.");
    }
    setBusy(true);
    try {
      // En mode démo, le mot de passe n'est pas envoyé.
      const payload = demo ? { ...form, password: undefined } : form;
      const res = await api<{ needsConfirmation?: boolean }>(`/api/auth/${mode}`, { method: "POST", json: payload });
      if (res.needsConfirmation) {
        setInfo("Compte créé. Confirmez votre adresse via l'e-mail reçu, puis connectez-vous.");
        setMode("login");
      } else {
        await refresh();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const title = oneClick && !showForm ? "Connexion" : mode === "login" ? "Connexion" : "Créer un compte";

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative flex flex-col justify-between overflow-hidden bg-night px-8 py-8 text-white sm:px-12 lg:py-12">
        <span className="inline-flex self-start"><Logo clair className="h-28 w-auto" /></span>
        <div className="my-12 max-w-lg lg:my-0">
          <p className="font-display text-[46px] font-semibold leading-[1] text-balance sm:text-[62px]">La veille qui ne dort jamais.</p>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-night-text">
            Vos ventes Circana croisées avec chaque fiche produit du web : prix, composition, formats et teintes, sourcés et partageables.
          </p>
        </div>
        <div className="space-y-2.5" aria-hidden>
          {SWATCHES.map((row, i) => (
            <div key={i} className="shade-strip flex h-7 max-w-md overflow-hidden rounded-md">
              {row.map((h) => <i key={h} style={{ background: h }} />)}
            </div>
          ))}
        </div>
      </aside>

      <div className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-[400px]">
          <h1 className="text-[28px] font-semibold tracking-[-0.025em]">{title}</h1>
          <p className="mt-1.5 text-ink-soft">
            {oneClick && !showForm ? "Accès de démonstration : aucun identifiant n'est nécessaire." : mode === "login" ? "Retrouvez vos analyses et vos rapports." : "Quelques secondes, puis lancez votre première analyse."}
          </p>

          <div className="mt-8">
            {demo === null ? (
              <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            ) : oneClick && !showForm ? (
              <div className="space-y-4">
                <button type="button" onClick={demoAccess} disabled={busy} className={`${btnPrimary} w-full py-3`}>
                  {busy ? "Connexion…" : "Entrer dans Lookout"}<ArrowRight size={16} aria-hidden />
                </button>
                <ErrorText>{error}</ErrorText>
                {!demo && (
                  <button type="button" className="text-sm font-semibold text-ink-soft hover:text-ink hover:underline" onClick={() => setShowForm(true)}>
                    Se connecter avec un autre compte
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4" noValidate>
                {mode === "signup" && (
                  <Field label="Nom complet"><input className={inputCls} autoComplete="name" value={form.fullName} onChange={set("fullName")} /></Field>
                )}
                <Field label="E-mail"><input type="email" autoComplete="email" className={inputCls} value={form.email} onChange={set("email")} /></Field>
                {!demo && (
                  <Field label="Mot de passe" hint={mode === "signup" ? "8 caractères minimum." : undefined}>
                    <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className={inputCls} value={form.password} onChange={set("password")} />
                  </Field>
                )}
                <ErrorText>{error}</ErrorText>
                {info && <p className="text-sm text-ok">{info}</p>}
                <button type="submit" disabled={busy} className={`${btnPrimary} w-full py-3`}>
                  {busy ? "Un instant…" : mode === "login" ? "Se connecter" : "Créer le compte"}
                </button>
              </form>
            )}
          </div>

          {demo === false && (!oneClick || showForm) && (
            <p className="mt-6 text-sm text-ink-soft">
              {mode === "login" ? "Pas encore de compte ? " : "Déjà un compte ? "}
              <button className="font-semibold text-ink hover:underline" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
                {mode === "login" ? "Créer un compte" : "Se connecter"}
              </button>
            </p>
          )}
          <p className="mt-10 text-[13px] text-ink-faint"><Link href="/offres" className="hover:text-ink hover:underline">Voir les offres</Link></p>
        </div>
      </div>
    </div>
  );
}

/** Gammes de teintes de blush, rose à baie : le motif de la marque. */
const SWATCHES = [
  ["#F4B6A6", "#F2A38C", "#E8919A", "#E57F6E", "#D96B6F", "#C4566B", "#B8475E", "#9E3A4F"],
  ["#F2C2B8", "#EFB0AE", "#E58FA0", "#D48E9A", "#C9667B", "#C2707F", "#AD5568", "#8E3557"],
  ["#F0A58F", "#E9967A", "#E06A7A", "#D4796B", "#C9846E", "#B76E79", "#B04F63", "#C8243B"],
];

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
