// ARQUIVO: app/api/validate-cpf/route.ts (VERSÃO BLINDADA)

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { cpf } = await request.json();

    if (!cpf || typeof cpf !== 'string' || cpf.trim() === '') {
      return NextResponse.json({ error: 'CPF é obrigatório e deve ser válido.' }, { status: 400 });
    }

    // Cria um cliente admin seguro que só existe no servidor
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Faz a busca na tabela de perfis pelo CPF fornecido
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('cpf', cpf.trim())
      .single();

    // Verificação explícita de erro da consulta
    if (error && error.code !== 'PGRST116') { // PGRST116 = 'not found', que não é um erro para nós
      console.error("Erro na consulta do Supabase ao validar CPF:", error);
      // Garantimos que estamos retornando um objeto de erro JSON válido
      return NextResponse.json({ error: "Erro ao consultar o banco de dados." }, { status: 500 });
    }

    // Resposta de sucesso (mesmo se 'exists' for false)
    return NextResponse.json({ exists: !!data });

  } catch (error: any) {
    console.error("Erro inesperado na API /api/validate-cpf:", error);
    // O 'catch' global garante uma resposta JSON em caso de falhas inesperadas
    // (ex: falha ao fazer o parse do request.json())
    return NextResponse.json({ error: error.message || 'Erro inesperado no servidor.' }, { status: 500 });
  }
}