import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";

// Display — Bricolage Grotesque: grotesca cálida y un punto imperfecta (marca local).
const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

// Cuerpo — Hanken Grotesk: humanista, legible, tranquila.
const body = Hanken_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
});

// Datos — mono tabular para S/ precios y kg/cantidades (las cifras cuadran).
const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: 'Miski GO',
    template: '%s | Miski GO',
  },
  description: 'Del campo a tu mesa, sin escalas.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
