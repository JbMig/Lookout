import Link from "next/link";
import { Check } from "lucide-react";
import { PublicTop } from "@/components/PublicTop";
import { btnPrimary, btnSecondary } from "@/components/ui";

/** Offres affichées à titre indicatif : le paiement (Stripe) et les quotas ne sont pas encore branchés. */
const PLANS = {
  trial: { label: "Essai", price: "Gratuit 14 jours", features: ["Quelques analyses pour tester", "Zones US et Europe", "Historique des rapports"] },
  pro: { label: "Pro", price: "Sur devis", features: ["Analyses régulières", "Croisement avec votre catalogue", "Tendances sociales", "Partage des rapports"] },
  enterprise: { label: "Entreprise", price: "Sur devis", features: ["Volumes sur mesure", "Sites ajoutés au catalogue", "Accompagnement dédié"] },
} as const;

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@example.com";

export default function OffersPage() {
  return (
    <>
    <PublicTop><Link href="/login" className={btnPrimary}>Se connecter</Link></PublicTop>
    <div className="mx-auto max-w-[1100px] space-y-10 px-5 py-14 sm:px-8">
      <div className="text-center">
        <h1 className="text-[34px] font-semibold tracking-[-0.025em]">Offres</h1>
        <p className="mt-2 text-ink-soft">
          Le paiement en ligne (Stripe) arrive bientôt. En attendant, contactez-nous : nous activons votre offre sous 24 h.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(PLANS).map(([id, p]) => (
          <section key={id} className={`flex flex-col rounded-[14px] border bg-paper p-6 ${id === "pro" ? "border-night ring-1 ring-night" : "border-line"}`}>
            <h2 className="text-lg font-semibold">{p.label}</h2>
            <p className="mt-1 text-2xl font-semibold">{p.price}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {p.features.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden />{f}</li>)}
            </ul>
            <Link
              href={id === "trial" ? "/login" : `mailto:${CONTACT}?subject=${encodeURIComponent(`Offre Lookout ${p.label}`)}`}
              className={`mt-6 ${id === "pro" ? btnPrimary : btnSecondary}`}
            >
              {id === "trial" ? "Commencer l'essai" : "Nous contacter"}
            </Link>
          </section>
        ))}
      </div>
      <p className="mt-12 text-center text-[13px] text-ink-faint"><Link href="/mentions-legales" className="hover:text-ink hover:underline">Mentions légales</Link></p>
    </div>
    </>
  );
}
