// /app/components/BackButtonManager.tsx
"use client";

import { useBackButtonHandler } from '@/app/hooks/useBackButtonHandler';
import { useUI } from '@/app/contexts/UIContext'; // 👈 Importamos o hook do nosso contexto

type BackButtonManagerProps = {
  openExitModal: () => void;
};

export default function BackButtonManager({ openExitModal }: BackButtonManagerProps) {
  // Pegamos o estado e as funções diretamente do contexto
  const { isOverlayOpen, closeOverlay } = useUI();

  useBackButtonHandler({
    isOverlayOpen,
    closeOverlay,
    openExitModal,
  });
  
  return null;
}