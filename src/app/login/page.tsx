"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { useSession } from "@/components/Session";
import { Card, ErrorText, Field, btnPrimary, inputCls } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const { me, refresh } = useSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [demo, setDemo] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "", orgName: "" });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ demo: { db: boolean } }>("/api/status").then((s) => setDemo(s.demo.db)).catch(() => null);
  }, []);
  useEffect(() => {
    if (me) router.replace(next);
  }, [me, next, router]);

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
      const res = await api<{ needsConfirmation?: boolean }>(`/api/auth/${mode}`, { method: "POST", json: form });
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

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{mode === "login" ? "Connexion" : "Créer un compte"}</h1>
        <p className="mt-1 text-sm text-ink-soft">Du fichier Circana au rapport de marché, en un clic.</p>
      </div>
      <Card>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {demo && (
            <p className="rounded-md bg-amber/15 p-3 text-sm text-amber-dark">
              Mode démo : saisissez n&apos;importe quel e-mail, aucun mot de passe n&apos;est vérifié.
            </p>
          )}
          {mode === "signup" && (
            <>
              <Field label="Nom complet"><input className={inputCls} value={form.fullName} onChange={set("fullName")} /></Field>
              <Field label="Entreprise" hint="Laissez vide si vous avez reçu une invitation.">
                <input className={inputCls} value={form.orgName} onChange={set("orgName")} />
              </Field>
            </>
          )}
          <Field label="E-mail"><input type="email" autoComplete="email" className={inputCls} value={form.email} onChange={set("email")} /></Field>
          {!demo && (
            <Field label="Mot de passe">
              <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className={inputCls} value={form.password} onChange={set("password")} />
            </Field>
          )}
          <ErrorText>{error}</ErrorText>
          {info && <p className="text-sm text-ok">{info}</p>}
          <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
            {busy ? "Un instant…" : mode === "login" ? "Se connecter" : "Créer le compte"}
          </button>
        </form>
      </Card>
      <p className="text-center text-sm text-ink-soft">
        {mode === "login" ? "Pas encore de compte ? " : "Déjà un compte ? "}
        <button className="font-medium text-ink underline underline-offset-2" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Créer un compte" : "Se connecter"}
        </button>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
