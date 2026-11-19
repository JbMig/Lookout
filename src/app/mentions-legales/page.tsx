import Link from "next/link";
import { PublicTop } from "@/components/PublicTop";
import { EDITOR, HOSTS } from "@/lib/legal";

export const metadata = { title: "Mentions légales · Lookout" };

const Value = ({ v }: { v: string | null }) => (v ? <>{v}</> : <span className="rounded bg-amber/15 px-1.5 py-0.5 text-[13px] text-amber-dark">à compléter</span>);

function Row({ label, v }: { label: string; v: string | null }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[240px_1fr]">
      <dt className="text-ink-soft">{label}</dt>
      <dd><Value v={v} /></dd>
    </div>
  );
}

/** Mentions légales (loi pour la confiance dans l'économie numérique, art. 1-1). */
export default function LegalPage() {
  return (
    <>
      <PublicTop><Link href="/login" className="font-medium hover:underline">Se connecter</Link></PublicTop>
      <main className="mx-auto w-full max-w-[860px] px-5 py-10 sm:px-8">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Mentions légales</h1>
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Éditeur du site</h2>
          <dl className="mt-2 divide-y divide-line text-[15px]">
            <Row label="Raison sociale" v={EDITOR.company} />
            <Row label="Capital social" v={EDITOR.capital} />
            <Row label="Siège social" v={EDITOR.address} />
            <Row label="Immatriculation (RCS, SIREN)" v={EDITOR.registration} />
            <Row label="TVA intracommunautaire" v={EDITOR.vat} />
            <Row label="E-mail" v={EDITOR.email} />
            <Row label="Téléphone" v={EDITOR.phone} />
            <Row label="Directeur de la publication" v={EDITOR.publicationDirector} />
          </dl>
        </section>
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Hébergement</h2>
          <dl className="mt-2 divide-y divide-line text-[15px]">
            {HOSTS.map((h) => (
              <div key={h.name} className="grid gap-1 py-2.5 sm:grid-cols-[240px_1fr]">
                <dt className="text-ink-soft">{h.role}</dt>
                <dd>{h.name}<br /><Value v={h.address} /><br /><a href={h.contact} className="underline underline-offset-4" rel="noreferrer">{h.contact.replace("https://", "")}</a></dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="mt-10 space-y-3 text-[15px] leading-relaxed text-ink-soft">
          <h2 className="text-lg font-semibold text-ink">Propriété des contenus</h2>
          <p>
            Les noms de marques, noms de produits et visuels affichés dans Lookout appartiennent à leurs titulaires respectifs ; ils sont
            présentés à des fins d&apos;analyse concurrentielle, pour les seuls utilisateurs de la plateforme. Les données de ventes importées
            (Circana) restent la propriété de leurs fournisseurs et sont réservées aux comptes de l&apos;entreprise cliente.
          </p>
        </section>
      </main>
    </>
  );
}
