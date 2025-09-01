// ARQUIVO FINAL: app/api/admin-reset-password/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Busca o usuário pelo ID para obter o e-mail
    const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (getUserError) {
      return NextResponse.json({ error: `Usuário não encontrado: ${getUserError.message}` }, { status: 404 });
    }
    if (!user || !user.email) {
      return NextResponse.json({ error: 'Usuário encontrado, mas não possui um e-mail cadastrado.' }, { status: 400 });
    }

    // 2. Usa o e-mail do usuário para gerar o link de recuperação e disparar
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
      user.email
    );

    if (resetError) {
      return NextResponse.json({ error: resetError.message }, { status: 500 });
    }
     
    return NextResponse.json({ message: 'Um link de recuperação foi enviado para o e-mail do usuário.' });
    
} catch (error) { // Removendo o tipo 'any'
  // Verificamos se o erro é uma instância de Error para acessar a propriedade 'message' com segurança
  if (error instanceof Error) {
    console.error("Erro inesperado na API de reset:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Se não for um objeto de Erro, registramos o que quer que seja
  console.error("Erro inesperado na API de reset:", error);
  return NextResponse.json({ error: 'Ocorreu um erro inesperado no servidor.' }, { status: 500 });
}
}