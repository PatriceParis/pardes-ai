import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pardes — פרדס",
  description: "Compagnon d'étude juive — Pshat, Remez, Drash, Sod.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans">{children}</body>
    </html>
  );
}
