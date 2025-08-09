// ARQUIVO CORRIGIDO: app/update-password/page.tsx

"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from '../contexts/AuthContext'; // Vamos usar nosso contexto

export default function UpdatePasswordPage() {
  const { user, loading } = useAuth(); // Usamos o contexto como fonte da verdade
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { completeRecoveryFlow } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // REMOVIDO: O useEffect que lia os tokens da URL foi removido.
  // Essa responsabilidade agora é exclusivamente da página /auth/callback e do AuthContext.

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setIsSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setIsSubmitting(false);
      return;
    } else {
  // AVISAMOS AO CONTEXTO QUE A RECUPERAÇÃO ACABOU
  completeRecoveryFlow();

  setMessage("Senha atualizada com sucesso! Redirecionando...");
  setTimeout(() => {
    router.replace("/");
  }, 2000);
  };
  }

  // Proteção de Rota Simples
  // O AuthContext é o guarda principal, mas podemos adicionar uma camada de feedback.
  if (loading) {
    return <p style={{ textAlign: "center", marginTop: "3rem" }}>Carregando...</p>;
  }

  // Se, por algum motivo, não houver usuário, não mostra o formulário.
  // O AuthContext já deve ter redirecionado, mas esta é uma segurança extra.
  if (!user) {
    return <p style={{ textAlign: "center", marginTop: "3rem" }}>Sessão inválida. Redirecionando...</p>;
  }

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '2rem', backgroundColor: 'white', borderRadius: '16px' }}>
      <h1 className="title-page" style={{ textAlign: 'center', marginBottom: '1rem' }}>Crie uma nova senha</h1>
      <p className="modal-intro" style={{textAlign: 'center', margin: '0 0 var(--space-lg) 0'}}>
        Digite e confirme a sua nova senha de acesso.
      </p>
      
      <form onSubmit={handleUpdatePassword}>
        <div className="input-group">
          <label htmlFor="password">Nova Senha</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="confirm-password">Confirmar Nova Senha</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        {message && <p style={{ color: 'green', textAlign: 'center' }}>{message}</p>}
        {error && <p style={{ color: '#ff4444', textAlign: 'center' }}>{error}</p>}
        
        <button type="submit" className="action-btn" style={{ width: '100%', marginTop: '1rem' }} disabled={isSubmitting}>
          {isSubmitting ? 'A atualizar...' : 'Atualizar Senha'}
        </button>
      </form>
    </div>
  );
}