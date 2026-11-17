import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/Session";
import { Header } from "@/components/Header";
import { DemoBanner } from "@/components/DemoBanner";

export const metadata: Metadata = {
  title: "Lookout — veille produits beauté",
  description: "Du fichier Circana au rapport de marché, en un clic.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <SessionProvider>
          <Header />
          <DemoBanner />
          <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
          <footer className="border-t border-line py-6 text-center text-xs text-ink-soft">
            Lookout · Circana + web (Linkup, scraping, H Company) + Hugging Face
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
