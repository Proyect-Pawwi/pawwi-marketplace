import type { Metadata } from "next";
import { Montserrat, Montserrat_Alternates, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import ClientNav from "@/components/ClientNav";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

const montserratAlt = Montserrat_Alternates({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat-alt",
});

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pawwi.co";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Pawwi — Hogares de familia, Cero Jaulas",
    template: "%s | Pawwi",
  },
  description: "La primera red de cuidadores de perros verificados con visita domiciliaria en Bogotá. Hogares reales, cero jaulas y fotos de tu perro durante todo el cuidado.",
  keywords: ["cuidado de perros Bogotá", "daycare perros", "cuidadores perros", "dog sitter Bogotá", "pawwi"],
  authors: [{ name: "Pawwi SAS" }],
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: SITE_URL,
    siteName: "Pawwi",
    title: "Pawwi — Hogares de familia, Cero Jaulas",
    description: "La primera red de cuidadores de perros verificados con visita domiciliaria en Bogotá. Hogares reales y cero jaulas.",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "Pawwi — Cuidado de perros en hogares verificados" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pawwi — Hogares de familia, Cero Jaulas",
    description: "La primera red de cuidadores verificados de perros en Bogotá.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${montserrat.variable} ${montserratAlt.variable} ${jakartaSans.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        {children}
        {/* Nav inferior del cliente — se auto-gatea por ruta + sesión (role='client'). */}
        <ClientNav />
      </body>
    </html>
  );
}