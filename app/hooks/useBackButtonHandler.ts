// /app/hooks/useBackButtonHandler.ts
"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Definimos os tipos das propriedades que o hook vai receber
type BackButtonHandlerProps = {
  isOverlayOpen: boolean; // Um único estado para saber se QUALQUER overlay está aberto
  closeOverlay: () => void; // Uma única função para fechar o overlay ativo
  openExitModal: () => void; // Função para abrir nosso modal de saída
};

export const useBackButtonHandler = ({ 
  isOverlayOpen, 
  closeOverlay, 
  openExitModal 
}: BackButtonHandlerProps) => {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handlePopState = () => {
      history.pushState(null, '', pathname);

      // ETAPA 1: Verifica se há algum overlay (modal/drawer) ativo
      if (isOverlayOpen) {
        closeOverlay();
        return;
      }

      // ETAPA 2: Verifica se o usuário NÃO está no Dashboard
      if (pathname !== '/dashboard') {
        router.push('/dashboard');
        return;
      }

      // ETAPA 3: Se estiver no Dashboard, mostra o diálogo de confirmação
      if (pathname === '/dashboard') {
        openExitModal();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [pathname, isOverlayOpen, closeOverlay, openExitModal, router]); // Adicionamos as props à lista de dependências
};