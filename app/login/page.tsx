// ARQUIVO: app/login/page.tsx

"use client"; // Marca este como um Componente de Cliente

import { useState } from 'react';
import supabase from '../lib/supabaseClient'; // Importa nosso cliente Supabase
import { useRouter } from 'next/navigation';


export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null); // Limpa erros antigos
 
  // Chama a função de login do Supabase com o e-mail и a senha do estado
  const { error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    // Se o Supabase retornar um erro (ex: senha errada), o mostramos para o usuário.
    setError("E-mail ou senha inválidos."); // Usamos uma mensagem genérica por segurança
    console.error("Erro no login:", error.message); // Mostramos o erro real no console para debug
  } else {
    // Se o login for bem-sucedido, o usuário está logado!
router.push('/');
  }
};


  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '2rem', backgroundColor: 'white', borderRadius: '16px' }}>
      <h1 className="title-app" style={{ textAlign: 'center', marginBottom: '2rem' }}>GymPro</h1>
      <form onSubmit={handleLogin}>
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
        <div className="input-group">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p style={{ color: '#ff4444', textAlign: 'center' }}>{error}</p>}
        <button type="submit" className="action-btn" style={{ width: '100%', marginTop: '1rem' }}>
          Entrar
        </button>
        <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
          <a href="/forgot-password" style={{ color: 'var(--primary-action-color)', fontWeight: '600', fontSize: '0.9rem' }}>
            Esqueci minha senha
          </a>
        </div>
      </form>
    </div>
  );
}