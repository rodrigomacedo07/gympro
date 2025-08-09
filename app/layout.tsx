// ARQUIVO: app/layout.tsx


import "./globals.css"; // ESTA LINHA É A MAIS IMPORTANTE
import { Inter, Montserrat } from "next/font/google";
import { AuthProvider } from "./contexts/AuthContext";

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
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR"> 
    <body className={`${inter.variable} ${montserrat.variable}`}>
      <AuthProvider>
      {children}
      </AuthProvider>
      </body>
    </html>
  );
}
