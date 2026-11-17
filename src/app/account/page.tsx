"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Private, useSession } from "@/components/Session";
import { Card, ErrorText, Field, btnPrimary, btnSecondary, inputCls } from "@/components/ui";
import type { InvitationRow, Role } from "@/lib/types";

interface OrgData {
  org: { id: string; name: string; plan: string };
  members: { id: string; userId: string; email: string; fullName: string | null; role: Role }[];
  invitations: InvitationRow[];
}

const ROLE_LABEL: Record<Role, string> = { owner: "Propriétaire", admin: "Administrateur", analyst: "Analyste", viewer: "Lecteur" };

function Account() {
  const { me, refresh } = useSession();
  const [data, setData] = useState<OrgData | null>(null);
  const [name, setName] = useState("");
  const [invite, setInvite] = useState({ email: "", role: "analyst" as Role });
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const canAdmin = me!.user.role === "owner" || me!.user.role === "admin";

  const load = useCallback(async () => {
    const d = await api<OrgData>("/api/org");
    setData(d);
    setName(d.org.name);
  }, []);
  useEffect(() => {
    api<OrgData>("/api/org")
      .then((d) => {
        setData(d);
        setName(d.org.name);
      })
      .catch((e) => setError(e.message));
  }, []);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setError(null);
    setMsg(null);
    try {
      await fn();
      await load();
      if (ok) setMsg(ok);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!data) return <p className="text-ink-soft">{error ?? "Chargement…"}</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Compte et équipe</h1>
      <ErrorText>{error}</ErrorText>
      {msg && <p className="text-sm text-ok">{msg}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Organisation</h2>
          <form
            className="flex items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return setError("Le nom ne peut pas être vide.");
              run(async () => {
                await api("/api/org", { method: "PATCH", json: { name } });
                await refresh();
              }, "Nom enregistré.");
            }}
          >
            <div className="flex-1">
              <Field label="Nom"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} disabled={!canAdmin} /></Field>
            </div>
            {canAdmin && <button className={btnSecondary}>Enregistrer</button>}
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Abonnement</h2>
          <p>
            Offre actuelle : <strong>{me!.plan.label}</strong>
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {me!.usage.analysesThisMonth} analyse(s) ce mois-ci sur {me!.plan.analysesPerMonth ?? "un nombre illimité"} ·{" "}
            {me!.plan.productsPerAnalysis} produits max par analyse.
          </p>
          <p className="mt-3 rounded-md bg-cream p-3 text-sm">
            Le paiement en ligne (Stripe) arrive bientôt. Pour changer d&apos;offre, contactez l&apos;équipe Lookout.
          </p>
          <Link href="/offres" className="mt-3 inline-block text-sm font-medium underline underline-offset-2">Voir les offres</Link>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Membres</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-ink-soft">
              <tr><th className="py-2 font-medium">Membre</th><th className="py-2 font-medium">Rôle</th><th /></tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="py-2">{m.fullName ? `${m.fullName} · ` : ""}{m.email}{m.userId === me!.user.userId && " (vous)"}</td>
                  <td className="py-2">
                    {canAdmin && m.userId !== me!.user.userId ? (
                      <select
                        aria-label={`Rôle de ${m.email}`}
                        value={m.role}
                        onChange={(e) => run(() => api(`/api/org/members/${m.id}`, { method: "PATCH", json: { role: e.target.value } }), "Rôle mis à jour.")}
                        className="rounded-md border border-line bg-paper px-2 py-1"
                      >
                        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    ) : (
                      ROLE_LABEL[m.role]
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {canAdmin && m.userId !== me!.user.userId && (
                      <button
                        className="text-sm text-bad underline underline-offset-2"
                        onClick={() => confirm(`Retirer ${m.email} de l'organisation ?`) && run(() => api(`/api/org/members/${m.id}`, { method: "DELETE" }), "Membre retiré.")}
                      >
                        Retirer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canAdmin && (
          <>
            <h3 className="mb-2 mt-6 font-medium">Inviter un collègue</h3>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!/^\S+@\S+\.\S+$/.test(invite.email)) return setError("Saisissez un e-mail valide.");
                run(async () => {
                  await api("/api/org/invitations", { method: "POST", json: invite });
                  setInvite({ email: "", role: "analyst" });
                }, "Invitation créée : votre collègue rejoindra l'équipe en créant son compte avec cet e-mail.");
              }}
            >
              <div className="min-w-64 flex-1">
                <Field label="E-mail"><input type="email" className={inputCls} value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></Field>
              </div>
              <Field label="Rôle">
                <select className={inputCls} value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as Role })}>
                  <option value="admin">Administrateur</option>
                  <option value="analyst">Analyste</option>
                  <option value="viewer">Lecteur</option>
                </select>
              </Field>
              <button className={btnPrimary}>Inviter</button>
            </form>
            {data.invitations.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm">
                {data.invitations.map((i) => (
                  <li key={i.id} className="flex items-center justify-between rounded-md bg-cream px-3 py-2">
                    <span>{i.email} · {ROLE_LABEL[i.role]} · en attente</span>
                    <button className="text-bad underline underline-offset-2" onClick={() => run(() => api(`/api/org/invitations?id=${i.id}`, { method: "DELETE" }), "Invitation annulée.")}>
                      Annuler
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Private>
      <Account />
    </Private>
  );
}
