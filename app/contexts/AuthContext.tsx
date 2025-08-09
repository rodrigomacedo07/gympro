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
  // ESTADO EXPLÍCITO: A fonte da verdade para o nosso fluxo de recuperação
  const [isInRecoveryFlow, setIsInRecoveryFlow] = useState(false);
  
  const router = useRouter();
  const pathname = usePathname();

  // Função para a página update-password nos avisar que o fluxo terminou
  const completeRecoveryFlow = () => {
    setIsInRecoveryFlow(false);
  };

  useEffect(() => {
    // 1. Configura o listener que reage a todos os eventos do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`📣 [onAuthStateChange] Evento: ${event}`);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // 2. ATIVA NOSSA FLAG: Se o evento for de recuperação, ativamos nosso estado
      if (event === 'PASSWORD_RECOVERY') {
        console.log("✅ Fluxo de recuperação ATIVADO.");
        setIsInRecoveryFlow(true);
      }
    });

    // 3. Pega a sessão inicial para evitar a tela de "Carregando..."
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

 // GUARDA DE ROTA FINAL E COMPLETO
  useEffect(() => {
    if (loading) return;
    
    const publicRoutes = ['/login', '/forgot-password'];
    const isProtectedRoute = !publicRoutes.includes(pathname) && pathname !== '/auth/callback';

    // REGRA 1: Usuário em recuperação só pode estar em /update-password.
    if (isInRecoveryFlow && pathname !== '/update-password') {
      console.log('🔒 Guarda 1: Forçando para /update-password.');
      router.replace('/update-password');
      return;
    }

    // REGRA 2 (ADICIONADA): Usuário normal logado não pode estar em páginas públicas ou de update.
    if (user && !isInRecoveryFlow && (publicRoutes.includes(pathname) || pathname === '/update-password')) {
        console.log('🔒 Guarda 2: Usuário logado em página inadequada. Redirecionando para a inicial.');
        router.replace('/');
        return;
    }

    // REGRA 3: Usuário deslogado não pode acessar rotas protegidas.
    if (!user && isProtectedRoute) {
      console.log('🔒 Guarda 3: Usuário deslogado em rota protegida. Redirecionando para /login.');
      router.replace('/login');
      return;
    }

  }, [user, isInRecoveryFlow, pathname, loading, router]);




  const value = {
    user,
    session,
    loading,
    completeRecoveryFlow, // Expondo a nova função
    signOut: async () => await supabase.auth.signOut(),
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