import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // 1. Recebe TODOS os dados do novo profissional vindos do formulário
  const { nome, email, cpf, cref, is_estagiario } = await request.json();

  if (!email || !nome) {
    return NextResponse.json({ error: 'Nome e E-mail são obrigatórios.' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // 2. Etapa 1: Convidar o usuário no sistema de autenticação
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

  if (inviteError) {
    console.error('Erro ao convidar usuário (API):', inviteError);
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  if (inviteData.user) {
    // 3. Etapa 2: Inserir o perfil na tabela 'profiles'
    const { error: insertError } = await supabaseAdmin.from('profiles').insert({
      id: inviteData.user.id, // Usa o ID do usuário recém-criado
      nome,
      cpf,
      cref: is_estagiario ? null : cref,
      is_estagiario,
      roles: ['pef'], // Define uma role padrão
      status: 'ativo'
    });

    if (insertError) {
      // Se a inserção do perfil falhar, idealmente deveríamos deletar o usuário convidado
      // para não deixar lixo no banco. Por ora, retornamos o erro.
      console.error("Erro ao inserir perfil (API):", insertError);
      return NextResponse.json({ error: `Usuário convidado, mas falha ao criar perfil: ${insertError.message}` }, { status: 500 });
    }
  }

  // 4. Retorna sucesso
  return NextResponse.json({ message: 'Profissional convidado e perfil criado com sucesso!', user: inviteData.user });
}