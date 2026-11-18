import type { Metadata, Viewport } from "next";
import "@fontsource-variable/hanken-grotesk";
import "./globals.css";
import { SessionProvider } from "@/components/Session";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Lookout · la veille qui ne dort jamais",
  description: "Ventes Circana, fiches produits du web, tendances sociales et votre catalogue, croisés dans un rapport sourcé.",
};

export const viewport: Viewport = { themeColor: "#13233f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full">
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
