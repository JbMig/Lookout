"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { Private, useSession } from "@/components/Session";
import { Card, ErrorText, Field, btnSecondary, inputCls } from "@/components/ui";

function Account() {
  const { me, refresh } = useSession();
  const [name, setName] = useState(me!.user.fullName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (!name.trim()) return setError("Le nom ne peut pas être vide.");
    try {
      await api("/api/profile", { method: "PATCH", json: { fullName: name } });
      await refresh();
      setMsg("Nom enregistré.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Mon compte</h1>
      <ErrorText>{error}</ErrorText>
      {msg && <p className="text-sm text-ok">{msg}</p>}
      <Card>
        <h2 className="mb-3 font-semibold">Profil</h2>
        <p className="mb-4 text-sm text-ink-soft">
          {me!.user.email}
          {me!.user.isStaff && " · équipe Lookout"}
        </p>
        <form className="flex items-end gap-3" onSubmit={save}>
          <div className="flex-1">
            <Field label="Nom affiché"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          </div>
          <button className={btnSecondary}>Enregistrer</button>
        </form>
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Espace de travail</h2>
        <p className="text-sm text-ink-soft">
          Tous les comptes partagent le même espace : les rapports, le catalogue et les fiches produits sont visibles par toute l&apos;équipe.
        </p>
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
