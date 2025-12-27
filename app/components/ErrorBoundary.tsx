// /app/components/ErrorBoundary.tsx
"use client";

import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Atualiza o estado para que a próxima renderização mostre a UI de fallback.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Você também pode logar o erro para um serviço de monitoramento
    console.error("--- ERRO CAPTURADO PELO ERROR BOUNDARY ---", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Você pode renderizar qualquer UI de fallback
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>Algo deu errado.</h1>
          <p>Um erro inesperado ocorreu na aplicação.</p>
          <pre style={{ whiteSpace: 'pre-wrap', textAlign: 'left', background: '#fcecec', border: '1px solid red', padding: '1rem', margin: '1rem 0' }}>
            {this.state.error?.toString()}
          </pre>
          <button onClick={() => window.location.reload()}>Recarregar a Página</button>
        </div>
      );
    }

    return this.props.children;
  }
}