import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adresscan - Risques et prix immobilier par adresse",
  description:
    "Adresscan : rapport gratuit combinant risques naturels et prix du marché pour n'importe quelle adresse en France.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
