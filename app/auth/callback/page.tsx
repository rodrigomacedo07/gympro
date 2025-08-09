// ARQUIVO REVISADO: app/auth/callback/page.tsx

'use client';

// Hooks do React e Next.js para efeitos e navegação
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Helper do Supabase para criar um cliente no lado do navegador (client-side)
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Este é o componente da nossa página de callback
export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const hash = window.location.hash;

      if (!hash) {
        console.error('Callback chamado sem um fragmento de token na URL.');
        router.replace('/login?error=token_missing');
        return;
      }

      const params = new URLSearchParams(hash.substring(1));
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      if (!access_token || !refresh_token) {
        console.error('Tokens não encontrados no hash da URL.');
        router.replace('/login?error=missing_tokens');
        return;
      }
        
      console.log('Tokens extraídos da URL. Tentando criar a sessão...');

      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (sessionError) {
        console.error('Erro ao tentar definir a sessão do usuário:', sessionError.message);
        router.replace(`/login?error=${sessionError.message}`);
        return;
      }

      console.log('Sessão do usuário criada com sucesso! Redirecionando...');

      // O AuthContext será responsável por identificar que esta é uma sessão de
      // recuperação e garantir que o usuário só possa acessar /update-password.
      // Por isso, a flag manual no sessionStorage é desnecessária.

      router.replace('/update-password');
    };

    handleAuthCallback();
  }, [router, supabase.auth]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
      <h2>GymPro</h2>
      <p>Autenticando, por favor aguarde...</p>
    </div>
  );
}