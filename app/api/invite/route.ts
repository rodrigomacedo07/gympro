// ARQUIVO FINAL E DEFINITIVO: app/api/invite/route.ts (VERSÃO SEGURA)

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isValidCPF } from '@/app/utils/validators'; // <-- PASSO 1: Importar nossa ferramenta

export async function POST(request: Request) {
  try {
    const { nome, email, cpf, cref, is_estagiario } = await request.json();

    // Validação de campos básicos
    if (!email || !nome || !cpf || (!is_estagiario && !cref)) {
      return NextResponse.json({ errors: [{ error: 'Dados incompletos.' }] }, { status: 400 });
    }

    // =======================================================================
    // PASSO 2: VALIDAÇÃO MATEMÁTICA DO CPF
    // Nossa nova linha de defesa principal.
    // =======================================================================
    if (!isValidCPF(cpf)) {
      return NextResponse.json(
        { errors: [{ field: 'cpf', error: 'O CPF fornecido é inválido.' }] },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // --- VALIDAÇÃO PARALELA (seu código original, já ótimo) ---
    const validationErrors = [];
    const checkCpfPromise = supabaseAdmin.from('profiles').select('id').eq('cpf', cpf).single();
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

  } catch (error) {
    if (error instanceof Error) {
      console.error("ERRO GERAL NA API de Convite:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.error("ERRO GERAL E INESPERADO NA API de Convite:", error);
    return NextResponse.json({ error: "Ocorreu um erro inesperado no servidor." }, { status: 500 });
  }
}