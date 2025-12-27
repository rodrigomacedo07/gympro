// ARQUIVO FINAL E SEGURO: app/contexts/AuthContext.tsx

"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import supabase from '../lib/supabaseClient';
import { Session, User, AuthError } from '@supabase/supabase-js'; 
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  completeRecoveryFlow: () => void;
  signOut: () => Promise<{ error: AuthError | null; }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInRecoveryFlow, setIsInRecoveryFlow] = useState(false);
  
  const router = useRouter();
  const pathname = usePathname();

  // Função para a página update-password nos avisar que o fluxo terminou
  const completeRecoveryFlow = () => {
    setIsInRecoveryFlow(false);
  };

    const signOut = async () => {
    return await supabase.auth.signOut();
  };

useEffect(() => {
    // 1. Buscamos a sessão inicial para saber se o usuário já está logado.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false); // Finaliza o carregamento inicial
    });

    // 2. Criamos o "ouvinte" (listener) para eventos de autenticação.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log(`Supabase auth event: ${event}`);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Se o evento for de recuperação de senha, ativamos nosso estado de fluxo
        if (event === 'PASSWORD_RECOVERY') {
          setIsInRecoveryFlow(true);
        }
      }
    );

    // 3. Função de limpeza: Quando o componente for desmontado, removemos o "ouvinte".
    // Isso é crucial para evitar memory leaks.
    return () => {
      subscription?.unsubscribe();
    };
  }, []); // O array vazio [] garante que este efeito rode apenas uma vez.

 // GUARDA DE ROTA FINAL E COMPLETO
useEffect(() => {
    // Só executamos a guarda de rotas APÓS o loading inicial terminar.
    if (loading) return;

    const publicRoutes = ['/login', '/forgot-password'];
    // Adicionamos a página de update-password às rotas "não-protegidas" para evitar loop
    const isProtectedRoute = !publicRoutes.includes(pathname) && pathname !== '/update-password' && pathname !== '/auth/callback';

    // REGRA 1: Usuário em recuperação só pode estar em /update-password.
    if (isInRecoveryFlow && pathname !== '/update-password') {
      router.replace('/update-password');
      return;
    }

    // REGRA 2: Usuário logado e fora do fluxo de recuperação não pode acessar páginas públicas.
    if (user && !isInRecoveryFlow && publicRoutes.includes(pathname)) {
        router.replace('/');
        return;
    }

    // REGRA 3: Usuário deslogado não pode acessar rotas protegidas.
    if (!user && isProtectedRoute) {
      router.replace('/login');
    }

  }, [user, isInRecoveryFlow, pathname, loading, router]);




  const value = {
    user,
    session,
    loading,
    completeRecoveryFlow, // Expondo a nova função
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};