// /app/contexts/UIContext.tsx
"use client";

import { createContext, useState, useContext, ReactNode } from 'react';

// 1. Definimos o formato dos dados que o contexto vai fornecer
type UIContextType = {
  isOverlayOpen: boolean;
  openOverlay: () => void;
  closeOverlay: () => void;
};

// 2. Criamos o contexto com um valor padrão
const UIContext = createContext<UIContextType | undefined>(undefined);

// 3. Criamos o "Provedor", o componente que vai gerenciar o estado
export const UIProvider = ({ children }: { children: ReactNode }) => {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  const openOverlay = () => setIsOverlayOpen(true);
  const closeOverlay = () => setIsOverlayOpen(false);

  const value = { isOverlayOpen, openOverlay, closeOverlay };

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
};

// 4. Criamos um hook customizado para facilitar o uso do contexto
export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};