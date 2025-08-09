// ARQUIVO CORRIGIDO: app/forgot-password/page.tsx

"use client";

import { useState, useEffect } from 'react';
// O ideal é não importar o cliente supabase diretamente aqui,
// mas sim usar o cliente que já está no seu AuthContext para evitar múltiplas instâncias.
// Por enquanto, manteremos para focar na lógica principal.
import supabase from '../lib/supabaseClient'; 
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter(); 

  
  // ADICIONADO: Novo useEffect com a lógica correta de redirecionamento.
  // Esta é a única verificação de sessão necessária nesta página.
  useEffect(() => {
    // A regra é simples: se existe um objeto 'user', o usuário está autenticado.
    // Um usuário autenticado não deve estar nesta página.
    if (user) {
      console.log('Usuário autenticado detectado em /forgot-password. Redirecionando para a área principal...');
      // Redirecionamos para a página principal da aplicação.
      // O AuthContext garantirá que, se for uma sessão de recuperação,
      // o usuário seja direcionado para /update-password.
      router.replace('/'); 
    }
  }, [user, router]); // Dependências corretas: user e router.

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    // A URL de redirectTo está correta.
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Se existir uma conta com este e-mail, um link para redefinição de senha será enviado.');
    }
  };

  // OTIMIZADO: A verificação de 'user' aqui não é mais necessária,
  // pois o useEffect acima já cuida do redirecionamento de forma mais eficaz.
  if (loading) {
    return <div>Carregando...</div>;
  }
  
  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '2rem', backgroundColor: 'white', borderRadius: '16px' }}>
      <h1 className="title-page" style={{ textAlign: 'center', marginBottom: '1rem' }}>Redefinir Senha</h1>
      <p className="modal-intro" style={{textAlign: 'center', margin: '0 0 var(--space-lg) 0'}}>
        Digite seu e-mail para receber as instruções.
      </p>
      <form onSubmit={handlePasswordReset}>
        <div className="input-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {message && <p style={{ color: 'green', textAlign: 'center' }}>{message}</p>}
        {error && <p style={{ color: '#ff4444', textAlign: 'center' }}>{error}</p>}
        <button type="submit" className="action-btn" style={{ width: '100%', marginTop: '1rem' }}>
          Enviar link de redefinição
        </button>
      </form>
    </div>
  );
}