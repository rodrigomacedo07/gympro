// ARQUIVO: app/layout.tsx

import "./globals.css"; // ESTA LINHA É A MAIS IMPORTANTE
import { Inter, Montserrat } from "next/font/google";

// Configuração das fontes para otimização do Next.js
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata = {
  title: "GymPro",
  description: "Gestão de Treinamento Inteligente",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${montserrat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
