// ARQUIVO FINAL E DEFINITIVO: app/api/invite/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { nome, email, cpf, cref, is_estagiario } = await request.json();

    if (!email || !nome || !cpf || (!is_estagiario && !cref)) {
      return NextResponse.json({ errors: [{ error: 'Dados incompletos.' }] }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // --- VALIDAÇÃO PARALELA CORRIGIDA ---
    const validationErrors = [];

    const checkCpfPromise = supabaseAdmin.from('profiles').select('id').eq('cpf', cpf).single();
    // Chamamos nossa nova função customizada 'email_exists' via RPC (Remote Procedure Call)
    const checkEmailPromise = supabaseAdmin.rpc('email_exists', { email_to_check: email });

    const [cpfResult, emailResult] = await Promise.all([checkCpfPromise, checkEmailPromise]);

    if (cpfResult.data) {
      validationErrors.push({ field: 'cpf', error: 'Este CPF já está cadastrado.' });
    }
    if (emailResult.data === true) {
      validationErrors.push({ field: 'email', error: 'Este e-mail já está em uso.' });
    }
    
    if (validationErrors.length > 0) {
      return NextResponse.json({ errors: validationErrors }, { status: 409 });
    }
    
    // --- FIM DA VALIDAÇÃO ---

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (inviteError || !inviteData.user) { throw new Error(inviteError?.message || 'Falha ao convidar usuário.'); }

    const { error: insertError } = await supabaseAdmin.from('profiles').insert({
      id: inviteData.user.id, nome, cpf, cref: is_estagiario ? null : cref, is_estagiario, roles: ['pef'], status: 'ativo'
    });
    if (insertError) { throw new Error(insertError.message); }

    return NextResponse.json({ message: 'Profissional convidado e perfil criado com sucesso!' });

} catch (error) { // Removido o tipo 'any'
  // Verificamos se o que foi capturado é um objeto de Erro padrão
  if (error instanceof Error) {
    console.error("ERRO GERAL NA API:", error.message);
    // Usamos a mensagem do erro que foi lançado
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Se, por algum motivo, não for um Erro, usamos uma mensagem genérica
  console.error("ERRO GERAL E INESPERADO NA API:", error);
  return NextResponse.json({ error: "Ocorreu um erro inesperado no servidor." }, { status: 500 });
}
}