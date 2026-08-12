import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { defaultLocale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "rwthrank",
  description: "Notenspiegel vergleichen. Anmeldung per Code, kein Passwort.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Prerendered in the default locale; Providers swaps the lang attribute if the
  // visitor has chosen otherwise.
  return (
    <html lang={defaultLocale} className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-base-100 text-base-content">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
