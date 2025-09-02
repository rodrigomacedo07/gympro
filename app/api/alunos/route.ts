import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { id, nome, cpf, observacao, matricula_status } = await request.json();

    // Criação de um cliente Supabase com privilégios de administrador
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // --- LÓGICA DE EDIÇÃO ---
    if (id) {
        // Validação básica para edição
        if (!nome || !cpf) {
            return NextResponse.json({ error: 'Nome e CPF são obrigatórios para a edição.' }, { status: 400 });
        }
        
if (matricula_status === 'inativo') {
    const { count, error: checkError } = await supabaseAdmin
        .from('sessoes_ativas')
        .select('id', { count: 'exact', head: true }) // Apenas verifica a existência, muito eficiente
        .eq('aluno_id', id);

    if (checkError) {
        console.error("Erro ao checar sessão ativa:", checkError);
        throw checkError;
    }

    // Se a contagem for maior que 0, significa que o aluno tem uma sessão ativa
    if (count && count > 0) {
        return NextResponse.json(
            { error: 'Este aluno está em uma sessão de treino ativa e não pode ser inativado.' },
            { status: 409 } // 409 Conflict
        );
    }
}

        // Verificação de CPF duplicado (se o CPF foi alterado)
        const cpfLimpo = cpf.replace(/[.\-]/g, '');
        const { data: existingAluno, error: checkError } = await supabaseAdmin
            .from('alunos')
            .select('id')
            .eq('cpf', cpfLimpo)
            .neq('id', id) // Ignora o próprio aluno
            .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
            console.error('Erro ao verificar CPF duplicado durante a edição:', checkError);
            return NextResponse.json({ error: 'Erro no servidor ao validar CPF.' }, { status: 500 });
        }
        
        if (existingAluno) {
            return NextResponse.json({ 
              errors: [{ field: 'cpf', error: 'Este CPF já está cadastrado em outro perfil.' }]
            }, { status: 409 });
        }
        
        // Atualiza os dados do aluno
        const { data, error } = await supabaseAdmin
            .from('alunos')
            .update({ 
              nome, 
              cpf: cpfLimpo, 
              observacao, 
              matricula_status 
            })
            .eq('id', id)
            .select()
            .single();
            
        if (error) {
            console.error('Erro ao atualizar aluno:', error);
            return NextResponse.json({ error: 'Falha ao atualizar o aluno.' }, { status: 500 });
        }

        return NextResponse.json({ message: 'Aluno atualizado com sucesso!', aluno: data });
    }
    
    // --- LÓGICA DE CRIAÇÃO (EXISTENTE) ---
    // (A lógica de criação que já havíamos implementado, inalterada)
    
    if (!nome || !cpf) {
      return NextResponse.json({ error: 'Nome e CPF são obrigatórios.' }, { status: 400 });
    }
    
    const cpfLimpo = cpf.replace(/[.\-]/g, '');

    const { data: existingPef, error: pefError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('cpf', cpfLimpo)
      .single();

    if (pefError && pefError.code !== 'PGRST116') {
      console.error('Erro ao verificar CPF de PEF:', pefError);
      return NextResponse.json({ error: 'Erro no servidor ao validar CPF.' }, { status: 500 });
    }
    
    if (existingPef) {
      return NextResponse.json({ 
        errors: [{ field: 'cpf', error: 'Este CPF já está cadastrado como PEF.' }]
      }, { status: 409 });
    }

    const { data: existingAluno, error: alunoError } = await supabaseAdmin
      .from('alunos')
      .select('id')
      .eq('cpf', cpfLimpo)
      .single();

    if (alunoError && alunoError.code !== 'PGRST116') {
      console.error('Erro ao verificar CPF de Aluno:', alunoError);
      return NextResponse.json({ error: 'Erro no servidor ao validar CPF.' }, { status: 500 });
    }
    
    if (existingAluno) {
      return NextResponse.json({ 
        errors: [{ field: 'cpf', error: 'Este CPF já está cadastrado como aluno.' }]
      }, { status: 409 });
    }

    const { data, error } = await supabaseAdmin
      .from('alunos')
      .insert({
        nome: nome,
        cpf: cpfLimpo,
        observacao: observacao,
        matricula_status: 'ativo',
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao inserir novo aluno:', error);
      return NextResponse.json({ error: 'Falha ao cadastrar o aluno.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Aluno cadastrado com sucesso!', aluno: data }, { status: 201 });

  } catch (err) {
    console.error('Erro inesperado na API de alunos:', err);
    return NextResponse.json({ error: 'Ocorreu um erro interno no servidor.' }, { status: 500 });
  }
}