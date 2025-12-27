// ARQUIVO: app/layout.tsx
"use client";

import "./globals.css"; // ESTA LINHA É A MAIS IMPORTANTE
import { Inter, Montserrat } from "next/font/google";
import { AuthProvider } from "./contexts/AuthContext";
import { UIProvider } from "./contexts/UIContext";
import { ErrorBoundary } from './components/ErrorBoundary';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  

  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${montserrat.variable}`}>
        <ErrorBoundary>      
          <AuthProvider>  
            <UIProvider>
              {children}
            </UIProvider>
          </AuthProvider>
         </ErrorBoundary>     
      </body>
    </html>
  );
}

