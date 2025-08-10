// ARQUIVO FINAL E CORRIGIDO: app/lib/supabaseClient.ts

import { createClient } from '@supabase/supabase-js'

// As variáveis de ambiente lidas do seu arquivo .env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// 1. Verificação "Fail-Fast" com a lógica correta (!) e o nome da variável corrigido
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key are required in .env.local')
}

// 2. Usando o nome correto da variável 'supabaseAnonKey' na criação do cliente
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 3. Usando 'export default' para ser compatível com o resto do seu projeto
export default supabase