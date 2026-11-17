import Link from "next/link";
import { PLANS } from "@/lib/plans";

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@example.com";

export default function OffersPage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">Offres</h1>
        <p className="mt-2 text-ink-soft">
          Le paiement en ligne (Stripe) arrive bientôt. En attendant, contactez-nous : nous activons votre offre sous 24 h.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(PLANS).map(([id, p]) => (
          <section key={id} className={`flex flex-col rounded-2xl border bg-paper p-6 ${id === "pro" ? "border-ink" : "border-line"}`}>
            <h2 className="text-lg font-semibold">{p.label}</h2>
            <p className="mt-1 text-2xl font-semibold">{p.price}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {p.features.map((f) => <li key={f}>✓ {f}</li>)}
            </ul>
            <Link
              href={id === "trial" ? "/login" : `mailto:${CONTACT}?subject=${encodeURIComponent(`Offre Lookout ${p.label}`)}`}
              className={`mt-6 rounded-md px-4 py-2 text-center text-sm font-medium ${id === "pro" ? "bg-ink text-white" : "border border-line"}`}
            >
              {id === "trial" ? "Commencer l'essai" : "Nous contacter"}
            </Link>
          </section>
        ))}
      </div>
    </div>
  );
}
