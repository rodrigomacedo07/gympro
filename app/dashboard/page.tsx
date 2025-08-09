// Arquivo: app/dashboard/page.tsx
"use client";

import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
  const { user, signOut } = useAuth();

  return (
    <div style={{ padding: '2rem', color: 'Grey' }}>
      <h1>Bem-vindo ao GymPro!</h1>
      {user && <p>Você está logado como: {user.email}</p>}
      <button onClick={signOut} style={{ marginTop: '1rem' }}>
        Sair
      </button>
    </div>
  );
}