// ARQUIVO: page.tsx - VERSÃO COM O LAYOUT FINAL DA TELA DE GERENCIAMENTO

// =======================================================
// 1. IMPORTAÇÕES
// =======================================================

"use client";

import React, {
  useState,
  useEffect,
  useRef,
  UIEvent,
  useCallback,
  useMemo,
} from "react";
import Papa from 'papaparse';
import { FixedSizeList as List } from 'react-window';
import { useRouter } from 'next/navigation';
import { useAuth } from './contexts/AuthContext';
import supabase from './lib/supabaseClient';


/*import debounce from 'lodash.debounce';*/




// =======================================================
// 2. DEFINIÇÕES DE TIPOS (INTERFACES)
// =======================================================

// --- Modelos de Dados Principais ---

interface Aluno {
  id: string;
  nome: string;
  cpf: string;
  matricula_status: "ativo" | "inativo";
  ritmo?: "no_ritmo" | "atrasado";
  matricula_status_timestamp: string; // Mantido como string, representa um ISO Date
  treino: Treino[];
  historico?: HistoricoItem[];
  observacao: string;
}
interface PEF {
  email: string;
  id: string;
  nome: string;
  is_estagiario: boolean;
  cref: string | null;
  roles: ('admin' | 'pef')[];
  status: 'ativo' | 'inativo';
  cpf: string;
}
interface Exercicio {
  id: string;
  nome: string;
  grupo_muscular?: string | null;
}
interface Treino {
  id: string;
  aluno_id: string;
  nome: string;
  descricao?: string | null;
  status: 'ativo' | 'inativo';
  pef_criador_id?: string | null;
  pef_ultima_alteracao_id?: string | null;
  created_at?: string;
  updated_at?: string;
  exercicios: TreinoExercicio[];
}
interface TreinoExercicio {
  id: string;
  treino_id: string;
  exercicio_id: string;
  ordem?: number;
  series: number | string;
  repeticoes: number | string;
  carga: number | string;
  observacoes?: string;
  exercicio?: Exercicio; // <-- CORREÇÃO: Propriedade adicionada para o JOIN
}
interface CsvRow {
  Nome?: string; // Coluna obrigatória
  CPF?: string; // Coluna obrigatória
  // Adicione outras colunas se necessário
}
interface LiveExercise {
  id: string;
  status: "nao-iniciado" | "executando" | "finalizado";
}
interface ActiveSession {
  id: string;
  alunoId: string;
  treinoId: string;
  pef_responsavel_id?: string | null;
  startTime: string; // Mantido como string, representa um ISO Date
  exercises: LiveExercise[];
  totalPlanejados?: number; 
}

// --- 2. Tipos de Estado (Para uso em Formulários e UI) ---

interface ExercicioParaFormulario {
  id?: string; // ID da 'treino_exercicios' se for um exercício existente
  tempId?: string;
  exercicio_id: string;
  nome: string;
  series: number | string; // CORREÇÃO: Unificado
  repeticoes: string | number; // CORREÇÃO: Unificado
  carga: string | number; // CORREÇÃO: Unificado
  observacoes?: string;
  isEditing?: boolean;
}
// Representa o estado completo de um treino enquanto está sendo editado
interface TreinoParaFormulario extends Omit<Treino,  'exercicios'> { // Omitimos aluno_id pois já temos o contexto do aluno
  exercicios: ExercicioParaFormulario[];
}
type ExercicioParaModal = {
  id: string; // ID da tabela 'treino_exercicios'
  exercicio_id: string;
  nome: string;
  series: string | number;
  repeticoes: string | number;
  carga: string | number;
  observacoes: string;
};

interface ExercicioJoin {
  id: string;
  nome: string;
}
interface TreinoExercicioComJoin {
  exercicio_id: string;
  series: number;
  repeticoes: string;
  carga: string;
  observacoes: string;
  ordem: number;
  exercicios: ExercicioJoin;
}
// --- 3. Tipos de Props (Para Componentes) ---

interface ExercicioCardProps {
  index: number;
  exercicio: ExercicioParaFormulario; // ATUALIZADO
  isExpanded: boolean;
  showActions: boolean;
  onToggleExpansion: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isEditable?: boolean;
  onExercicioChange?: (campo: keyof ExercicioParaFormulario, valor: string | number) => void; // ATUALIZADO
  onSuggestionSelect?: (suggestion: Exercicio) => void; // ATUALIZADO
  validationErrors?: Record<string, string>;
  suggestions: Exercicio[]; // ATUALIZADO
  isSearchActive: boolean;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
type ExercicioEditavel = {
  nome?: string;
  series: number | string;
  repeticoes: string | number;
  carga: string | number;
  observacoes?: string;
};
// A interface agora usa um "Tipo Genérico" <T>
interface EditExerciseModalProps<T extends ExercicioEditavel> {
  exercicio: T | null;
  onClose: () => void;
  onSave: (exercicioAtualizado: T) => void;
}
interface TreinoEditViewProps {
  aluno: Aluno;
  treino: TreinoParaFormulario; // ATUALIZADO para usar o tipo de estado
  onBack: () => void;
  onSave: (treino: TreinoParaFormulario) => void; // ATUALIZADO para usar o tipo de estado
  onTreinoChange: (campo: keyof Omit<TreinoParaFormulario, 'exercicios'>, valor: string) => void;
  onExercicioChange: (
    exercicioIndex: number, // Usando índice para segurança
    campo: keyof ExercicioParaFormulario,
    valor: string | number
  ) => void;
  onExercicioSelect: (exercicioIndex: number, suggestion: Exercicio) => void;
  onAddExercicio: () => void;
  onExcluirExercicio: (exercicioId: string) => void; // Usando ID
  validationErrors: Record<string, string>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}
interface HistoricoItem {
  id: number; // ID único para cada entrada do histórico
  data: string; // Data do treino no formato ISO (ex: new Date().toISOString())
  treinoId: string; // ID do Treino que foi executado
  nomeTreino: string; // Nome do Treino executado (ou "Não houve treino")
  status: 'completo' | 'incompleto' | 'nao_realizado'; // O status do "farol"
}
// NOVO TIPO: Representa um exercício com todos os detalhes para a tela de workout
interface ExercicioDeSessao extends TreinoExercicio {
  nome: string;
}
type ViewState = {
  type: "dashboard" | "select_plan"| "workout" | "gerenciar_treinos" | "editar_treino" |"gerenciar_perfis"|"gerenciar_alunos";
  alunoId: string | null;
  treinoId?: string;
};
type ExercicioError = {
  series?: string;
  repeticoes?: string;
};
type NovoPefData = {
  nome: string;
  email: string;
  cpf: string;
  cref: string;
  is_estagiario: boolean;
};
type ExercicioComStatus = ExercicioDeSessao & { status: LiveExercise["status"] };
type Ritmo = 'no_ritmo' | 'atrasado';
type HistoricoRow = {
  session_date: string;
  treino_nome: string;
  status: 'completo' | 'incompleto' | 'nao_realizado';
  ritmo?: 'no_ritmo' | 'atrasado';
};
type HistoricoDbRow = {
  session_date: string;
  status: 'completo' | 'incompleto' | 'nao_realizado';
  ritmo_final: 'no_ritmo' | 'atrasado' | null;
  treinos: { nome: string } | null;
};
type SessaoAtivaDbRow = {
  id: string;
  aluno_id: string;
  treino_id: string;
  pef_responsavel_id?: string | null;
  start_time: string;
  exercises: LiveExercise[];
};
type TreinoExercicioComNome = TreinoExercicio & {
  exercicios: {
    nome: string;
  } | null; // O exercício pode ser nulo se houver algum problema de dados
};
type NovoAlunoData = {
  nome: string;
  cpf: string;
  observacao: string;
};


// Forçando um novo deploy na Verce
// =======================================================
// 3. CONSTANTES E FUNÇÕES AUXILIARES
// =======================================================

/* --- ÍCONES (SVG) --- */
const treinoIcon = (
  <svg
    viewBox="-5 -10 110 135"
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    overflow="hidden"
    width="30"
    height="30"
    className="plan-icon"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M83.789 36.82 77.7382 30.7692 80.1366 28.3708C82.3983 26.1091 82.3983 22.4294 80.1366 20.1716 77.8749 17.9099 74.1952 17.9099 71.9374 20.1716L69.539 22.57 63.4882 16.5192C62.5585 15.5895 61.3085 15.07 59.9882 15.07 58.6679 15.07 57.4179 15.5817 56.4882 16.5192L55.7773 17.2301C55.1171 17.8903 54.6992 18.6989 54.4882 19.5504L54.16 19.2223C53.1288 18.1911 51.7616 17.6325 50.3006 17.6325 48.8397 17.6325 47.4725 18.2028 46.4412 19.2223 45.41 20.2535 44.8514 21.6207 44.8514 23.0817 44.8514 24.5426 45.4217 25.9098 46.4412 26.9411L55.8123 36.3122 36.6323 55.4922 27.2612 46.1211C25.1323 43.9922 21.6714 43.9922 19.5424 46.1211 17.4135 48.25 17.4135 51.7109 19.5424 53.8399L19.8706 54.168C18.9995 54.379 18.1909 54.8087 17.5503 55.4571L16.8393 56.1681C14.9096 58.0978 14.9096 61.2462 16.8393 63.1798L22.8901 69.2306 20.4917 71.629C18.23 73.8907 18.23 77.5704 20.4917 79.8282 21.6206 80.9571 23.1011 81.5274 24.5933 81.5274 26.0816 81.5274 27.5621 80.9688 28.6949 79.8282L31.0933 77.4298 37.1441 83.4806C38.1129 84.4493 39.3746 84.9298 40.6441 84.9298 41.9136 84.9298 43.1832 84.4493 44.1441 83.4806L44.8551 82.7696C45.5152 82.1095 45.9332 81.3008 46.1442 80.4493L46.4723 80.7775C47.5035 81.8087 48.8707 82.3673 50.3317 82.3673 51.7926 82.3673 53.1598 81.797 54.1911 80.7775 55.2223 79.7463 55.7809 78.3791 55.7809 76.9181 55.7809 75.4572 55.2106 74.09 54.1911 73.0587L44.82 63.6876 64 44.5076 73.3711 53.8787C74.4297 54.9373 75.832 55.4803 77.2305 55.4803 78.6289 55.4803 80.0313 54.949 81.0899 53.8787 82.1211 52.8475 82.6797 51.4803 82.6797 50.0193 82.6797 48.5584 82.1094 47.1912 81.0899 46.1599L80.7618 45.8317C81.6329 45.6208 82.4337 45.1911 83.0821 44.5426L83.793 43.8317C84.7227 42.902 85.2422 41.652 85.2422 40.3317 85.2422 39.0114 84.7305 37.7614 83.793 36.8317ZM26.969 78.14C25.6487 79.4603 23.4885 79.4603 22.1682 78.14 20.8479 76.8197 20.8479 74.6595 22.1682 73.3392L24.5666 70.9408 29.3674 75.7416ZM43.141 81.0775 42.4301 81.7884C41.4301 82.7884 39.809 82.7884 38.8207 81.7884L18.5237 61.4914C17.5237 60.4914 17.5237 58.8703 18.5237 57.882L19.2346 57.1711C19.7151 56.6906 20.3557 56.4328 21.0432 56.4328 21.7346 56.4328 22.3713 56.6945 22.8518 57.1711L43.1608 77.4801C44.1608 78.4801 44.1491 80.1012 43.1608 81.0895ZM53.371 76.9213C53.371 77.7416 53.0507 78.5111 52.4804 79.0815 51.9101 79.6518 51.1406 79.9721 50.3202 79.9721 49.4999 79.9721 48.7304 79.6518 48.16 79.0815L21.234 52.1555C20.0426 50.9641 20.0426 49.0266 21.234 47.8274 21.8355 47.2258 22.6129 46.9368 23.3942 46.9368 24.1755 46.9368 24.9645 47.2376 25.5544 47.8274L52.4844 74.7574C53.0547 75.3277 53.375 76.0972 53.375 76.9176ZM62.3007 42.8083 43.1207 61.9883 38.3199 57.1875 57.4999 38.0075ZM79.3787 52.1794C78.1873 53.3708 76.2498 53.3708 75.0506 52.1794L48.1206 25.2494C47.5503 24.6791 47.23 23.9096 47.23 23.0892 47.23 22.2689 47.5503 21.4994 48.1206 20.929 48.6909 20.3587 49.4604 20.0384 50.2808 20.0384 51.1012 20.0384 51.8706 20.3587 52.441 20.929L79.371 47.859C79.9413 48.4293 80.2616 49.1988 80.2616 50.0192 80.2616 50.8395 79.9413 51.609 79.371 52.1794ZM73.6404 21.8594C74.9607 20.5391 77.1209 20.5391 78.4412 21.8594 79.7615 23.1797 79.7615 25.3399 78.4412 26.6602L76.0428 29.0586 71.242 24.2578ZM82.0896 42.1294 81.3787 42.8403C80.8982 43.3208 80.2576 43.5786 79.5701 43.5786 78.8786 43.5786 78.242 43.3169 77.7615 42.8403L57.4605 22.5393C56.4605 21.5393 56.4605 19.9182 57.4605 18.9299L58.1714 18.219C58.6714 17.719 59.3198 17.469 59.98 17.469 60.6402 17.469 61.2886 17.719 61.7886 18.219L82.0856 38.516C82.5661 38.9965 82.8239 39.6371 82.8239 40.3246 82.8239 41.016 82.5622 41.6527 82.0856 42.1332Z" />
  </svg>
);
const editIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);
const deleteIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);
const deactivateIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </svg>
);
const activateIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </svg>
);
const backIcon = (
  <svg fill="currentColor" viewBox="0 0 24 24">
    <path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z" />
  </svg>
);
const optionsIcon = (
  <svg fill="currentColor" viewBox="0 0 24 24">
    <path d="M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z" />
  </svg>
);
const chevronIcon = (
  <svg fill="currentColor" viewBox="0 0 24 24">
    <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" />
  </svg>
);
const addIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);
const resetIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11.88V12a8 8 0 1 1-2.9-6.32" />
      <path d="M22 4L12 14.01l-3-3" />
    </svg>
  );
const spinnerIcon = (
<svg
        className="loading-page-spinner-svg"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          style={{ opacity: 0.2 }}
        ></circle>
        <path
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
);



/* --- FUNÇÕES UTILITÁRIAS PURAS --- */

function calculateTimeAgo(timestamp: string): string {
  if (!timestamp) return "";
  const now = Date.now();
  const past = new Date(timestamp).getTime();
  const diffSec = Math.floor((now - past) / 1000);
  if (diffSec < 0 || Number.isNaN(diffSec)) return "";

  const minutes = Math.floor(diffSec / 60);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `há ${hours}h${rest ? ` ${rest}m` : ""}`;
}
const normalizeString = (str: string) => {
  return str
    .normalize("NFD") // Separa acentos e caracteres base
    .replace(/[\u0300-\u036f]/g, "") // Remove todos os acentos
    .toLowerCase() // Padroniza para minúsculas
    .trim() // Remove espaços no início/fim
    .replace(/\s+/g, " "); // Substitui múltiplos espaços por um único
};
const formatarDataHistorico = (data: Date): string => {
  const dia = data.getDate();
  const mes = data.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
  const diaSemana = data.toLocaleString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${dia}.${mes} ${diaSemana}`;
};


/* --- FUNÇÕES DE VALIDAÇÃO PURAS --- */
function dedupSessionsByAluno<T extends { alunoId: string; startTime?: string | Date }>(sessions: T[]): T[] {
  const latestByAluno = new Map<string, T>();

  for (const s of sessions || []) {
    const prev = latestByAluno.get(s.alunoId);
    if (!prev) {
      latestByAluno.set(s.alunoId, s);
      continue;
    }
    const prevTs = prev.startTime ? new Date(prev.startTime).getTime() : -Infinity;
    const currTs = s.startTime ? new Date(s.startTime).getTime() : -Infinity;
    if (currTs >= prevTs) latestByAluno.set(s.alunoId, s);
  }

  return Array.from(latestByAluno.values());
}
const validateExercicio = (): { isValid: boolean; errors: ExercicioError } => {
  const errors: ExercicioError = {};

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
const validateTreino = (treino: TreinoParaFormulario): { isValid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};

  // Regra 1: Nome do treino é obrigatório
  if (!treino.nome?.trim()) {
    errors.treinoNome = "Nome do treino é obrigatório";
  }

  // Regra 2: Treino deve ter pelo menos um exercício
  if (!treino.exercicios || treino.exercicios.length === 0) {
    errors.form = "O treino deve ter pelo menos um exercício.";
  } else {
    // Regra 3: Validar cada exercício da lista
    treino.exercicios.forEach((ex, index) => {
      const prefix = `exercicios[${index}]`;

      // Garante que o nome do exercício não está vazio
      if (!ex.nome?.trim()) {
        errors[`${prefix}.nome`] = "Nome do exercício é obrigatório";
      }
      
      // Validação moderna: Garante que um exercício foi selecionado da busca (verificando o exercicio_id)
      if (!ex.exercicio_id) {
        errors[`${prefix}.nome`] = "Selecione um exercício válido da lista de sugestões.";
      }
   
      // --- VALIDAÇÃO ADICIONADA ---
      if (String(ex.series).trim() === '') {
        errors[`${prefix}.series`] = "Séries é obrigatório.";
      }
   
      if (String(ex.repeticoes).trim() === '') {
        errors[`${prefix}.repeticoes`] = "Reps é obrigatório.";
      }
    });
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
// Função para validar os dados do formulário de NOVO PEF
const validateNewPefData = (pefData: NovoPefData): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!pefData.nome.trim()) {
    errors.nome = "O nome completo é obrigatório.";
  }
  if (!pefData.email.trim()) {
    errors.email = "O e-mail é obrigatório.";
  } else if (!/\S+@\S+\.\S+/.test(pefData.email)) {
    // Validação simples de formato de e-mail
    errors.email = "O formato do e-mail parece inválido.";
  }
    // Validação do CPF
  if (!pefData.cpf.trim()) {
    errors.cpf = "O CPF é obrigatório."
  }
    // Validação condicional do CREF
  if (!pefData.is_estagiario && !pefData.cref.trim()) {
    errors.cref = "O CREF é obrigatório para profissionais formados."
  }
  return errors;
};
const validateNewAlunoData = (data: NovoAlunoData): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!data.nome.trim()) {
    errors.nome = "O nome é obrigatório.";
  }
  if (!data.cpf.trim()) {
    errors.cpf = "O CPF é obrigatório.";
  }
  return errors;
};
const validateAlunoData = (data: Aluno): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!data.nome.trim()) {
    errors.nome = "O nome é obrigatório.";
  }
  if (!data.cpf.trim()) {
    errors.cpf = "O CPF é obrigatório.";
  }
  return errors;
};
// Substitua sua função searchExercicios inteira por esta
async function searchExercicios(searchTerm: string) {
  // Retorna uma lista vazia se o termo for muito curto
  if (!searchTerm || searchTerm.length < 2) {
    return [];
  }

  // AGORA: usa .rpc() para chamar nossa função customizada no Supabase
  const { data, error } = await supabase.rpc('buscar_exercicios_sem_acento', {
    p_search_term: searchTerm
  });

  if (error) {
    console.error('Erro ao buscar exercícios:', error);
    return []; // Retorna um array vazio em caso de erro
  }
  return data as Exercicio[];
}

// Esta função salva o treino e seus exercícios
async function createTreinoCompleto(treinoData: Partial<Treino>, exerciciosDoTreino: ExercicioParaFormulario[], pefId: string) {
  // 1. Prepara os dados do treino, incluindo quem criou/alterou
  const dadosParaSalvar = {
    ...treinoData,
    pef_criador_id: pefId,
    pef_ultima_alteracao_id: pefId
  };

  
  // 2. Insere na tabela 'treinos' e pega o registro criado de volta
  const { data: novoTreino, error: erroTreino } = await supabase
    .from('treinos')
    .insert(dadosParaSalvar)
    .select()
    .single();

  if (erroTreino) {
    console.error('Erro ao criar o treino:', erroTreino);
    throw erroTreino; // Lança o erro para ser tratado na UI
  }

  // 3. Prepara os dados dos exercícios, adicionando o ID do novo treino
  const exerciciosParaInserir = exerciciosDoTreino.map(ex => ({
    treino_id: novoTreino.id,
    exercicio_id: ex.exercicio_id, // Assumindo que o ID do exercício selecionado está aqui
    series: ex.series === '' ? null : Number(ex.series),
    repeticoes: ex.repeticoes,
    carga: ex.carga,
    observacoes: ex.observacoes,
    // ordem: ex.ordem // Se você tiver um campo de ordem
  }));

  // 4. Insere todos os exercícios na tabela 'treino_exercicios'
  const { error: erroExercicios } = await supabase
    .from('treino_exercicios')
    .insert(exerciciosParaInserir);

  if (erroExercicios) {
    console.error('Erro ao salvar os exercícios do treino:', erroExercicios);
    // Limpeza: Deleta o treino que foi criado para não deixar dados órfãos
    await supabase.from('treinos').delete().eq('id', novoTreino.id);
    throw erroExercicios;
  }

  return novoTreino; // Sucesso!
}

async function updateTreinoCompleto(treinoId: string, treinoData: Partial<Treino>, exerciciosDoTreino: ExercicioParaFormulario[], pefId: string) {
  try {
    // 1. Atualiza o registro principal na tabela 'treinos'
    const { data: treinoAtualizado, error: erroTreino } = await supabase
      .from('treinos')
      .update({
        ...treinoData,
        pef_ultima_alteracao_id: pefId
      })
      .eq('id', treinoId)
      .select()
      .single();

    if (erroTreino) {
      console.error('Erro ao atualizar o treino:', erroTreino);
      throw erroTreino;
    }

    // 2. Prepara os dados dos exercícios para a inserção
    const exerciciosParaInserir = exerciciosDoTreino.map(ex => ({
      treino_id: treinoId,
      exercicio_id: ex.exercicio_id,
      series: ex.series === '' ? null : Number(ex.series),
      repeticoes: ex.repeticoes,
      carga: ex.carga,
      observacoes: ex.observacoes,
    }));

    // 3. Deleta todos os exercícios antigos do treino
    const { error: erroDelete } = await supabase
      .from('treino_exercicios')
      .delete()
      .eq('treino_id', treinoId);

    if (erroDelete) {
      console.error('Erro ao deletar exercícios antigos:', erroDelete);
      throw erroDelete;
    }

    // 4. Insere os novos exercícios
    const { error: erroInsert } = await supabase
      .from('treino_exercicios')
      .insert(exerciciosParaInserir);

    if (erroInsert) {
      console.error('Erro ao inserir novos exercícios:', erroInsert);
      throw erroInsert;
    }

    return treinoAtualizado; // Retorna o treino atualizado
  } catch (error) {
    console.error('Erro na função updateTreinoCompleto:', error);
    throw error;
  }
}

async function deleteTreino(treinoId: string) {
  const { error } = await supabase
    .from('treinos')
    .delete()
    .eq('id', treinoId);

  if (error) {
    console.error('Erro ao deletar o treino:', error);
    throw error;
  }
}

// Esta função busca um treino e todos os seus exercícios detalhados
async function fetchTreinoComExercicios(treinoId: string) {
  const { data: treinoData, error: treinoError } = await supabase
    .from('treinos')
    .select('*')
    .eq('id', treinoId)
    .single();

  if (treinoError) throw treinoError;

  const { data: exerciciosDoTreinoData, error: exerciciosError } = await supabase
    .from('treino_exercicios')
    .select(`
      exercicio_id, series, repeticoes, carga, observacoes, ordem,
      exercicios!inner ( id, nome )
    `)
    .eq('treino_id', treinoId)
    .order('ordem');

  if (exerciciosError) throw exerciciosError;

  const exerciciosData = exerciciosDoTreinoData as unknown as TreinoExercicioComJoin[];

  const TreinoParaFormulario = {
    ...treinoData,
    exercicios: exerciciosData.map(item => ({
      tempId: item.exercicio_id,
      exercicio_id: item.exercicios.id,
      nome: item.exercicios.nome,
      series: item.series ?? '',
      repeticoes: item.repeticoes ?? '',
      carga: item.carga ?? '',
      observacoes: item.observacoes ?? '',
      orden: item.ordem ?? '',
    }))
  };

  return TreinoParaFormulario;
}

async function fetchHistoricoUltimos30(alunoId: string): Promise<HistoricoRow[]> {
  const hoje = new Date();

  // Criamos uma data inicial para a query, 29 dias atrás.
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - 29);
  
  // Formatamos a data inicial para o formato YYYY-MM-DD
  const ano = inicio.getFullYear();
  const mes = String(inicio.getMonth() + 1).padStart(2, '0');
  const dia = String(inicio.getDate()).padStart(2, '0');
  const minISO = `${ano}-${mes}-${dia}`;
  
  const { data, error } = await supabase
    .from('treino_historico')
    .select(`session_date, status, ritmo_final, treino_id, treinos:treino_id(nome)`)
    .eq('aluno_id', alunoId)
    .gte('session_date', minISO)
    .order('session_date', { ascending: false })
    .overrideTypes<HistoricoDbRow[]>();

  if (error) {
    console.error('[historico] erro no select:', error);
    return [];
  }

  const porData = new Map<string, HistoricoDbRow>(data.map((r) => [r.session_date, r]));

  const rows: HistoricoRow[] = [];


  for (let i = 0; i < 30; i++) {
    const dt = new Date(hoje);
    dt.setDate(hoje.getDate() - i);

    // --- CORREÇÃO: Gerando a chave de data de forma segura, sem toISOString() ---
    const keyAno = dt.getFullYear();
    const keyMes = String(dt.getMonth() + 1).padStart(2, '0');
    const keyDia = String(dt.getDate()).padStart(2, '0');
    const key = `${keyAno}-${keyMes}-${keyDia}`;

    const r = porData.get(key);
    if (r) {
      let treino_nome = '-';
      if (r.treinos) {
        if (Array.isArray(r.treinos)) {
          treino_nome = String(r.treinos[0]?.nome ?? '-');
        } else {
          treino_nome = String((r.treinos as { nome?: string })?.nome ?? '-');
        }
      }
      const status = r.status as 'completo' | 'incompleto' | 'nao_realizado';
      const ritmo = r.ritmo_final as 'no_ritmo' | 'atrasado' | undefined;
      rows.push({ session_date: key, treino_nome, status, ...(ritmo ? { ritmo } : {}) });
    } else {
      rows.push({ session_date: key, treino_nome: 'Não houve treino', status: 'nao_realizado' });
    }
  }

  return rows;
}
/**
 * Busca a lista completa de perfis de PEFs.
 */
const fetchAllPefs = async () => {
  // A chamada RPC agora busca na nossa nova função que já faz o JOIN
  const { data, error } = await supabase.rpc('get_all_pef_profiles_with_email');
  
  if (error) {
    console.error("Erro ao buscar PEFs:", error);
    return [];
  }
  return data || [];
};

/** * Busca todas as sessões de treino atualmente ativas.*/
const fetchActiveSessions = async () => {
  const { data, error } = await supabase.from('sessoes_ativas').select('*');
  if (error) {
    console.error('Erro ao buscar Sessões Ativas:', error);
    return [];
  }

  const formattedData = (data as SessaoAtivaDbRow[] ?? []).map((session: SessaoAtivaDbRow) => ({
    id: session.id,
    alunoId: session.aluno_id,          // normaliza para camelCase
    treinoId: session.treino_id,
    pef_responsavel_id: session.pef_responsavel_id,
    startTime: session.start_time,      // normaliza para camelCase
    exercises: (session.exercises ?? []) as LiveExercise[], // garante array
  }));

  // 🔑 evita duplicidade por aluno
  return dedupSessionsByAluno(formattedData);
};

/**
 * Busca a lista completa de alunos e "hidrata" cada um com seus treinos e exercícios.
 * Esta é a função mais complexa e importante.
 */
const fetchAllAlunosCompletos = async () => {
  // 1. Busca a base de alunos
  const { data: alunosBase, error: alunosError } = await supabase.from('alunos').select('id, nome, cpf, matricula_status, matricula_status_timestamp, observacao');
  if (alunosError || !alunosBase) {
    console.error("Erro ao buscar Alunos:", alunosError);
    return [];
  }

  // 2. Hidrata cada aluno com seus treinos e exercícios
  const alunosCompletos = await Promise.all(
    alunosBase.map(async (aluno) => {
      const { data: treinos, error: treinosError } = await supabase
        .from('treinos')
        .select('*, treino_exercicios(*, exercicio:exercicios(id, nome))') // Busca aninhada de exercícios
        .eq('aluno_id', aluno.id)
        

      if (treinosError) {
        console.error(`Erro ao buscar treinos para o aluno ${aluno.id}`, treinosError);
       return {
        ...aluno,
        observacao: aluno.observacao || '', // Garante que observacao seja string
        treino: [],
        historico: [],
      };
      }

      const treinosHidratados = treinos.map(t => ({...t, exercicios: t.treino_exercicios || []}));
    // 2. Retorna o objeto final do aluno com todas as propriedades, incluindo observacao corrigida
    return {
      ...aluno,
      treino: treinosHidratados,
      observacao: aluno.observacao || '', // Garante que observacao seja string
      historico: [], // Assumindo que o histórico também é populado
    };
  })
  );
  return alunosCompletos;
};



// =======================================================
// 4. COMPONENTE PRINCIPAL (PAGE)
// =======================================================
export default function Page() {
  /* --- ESTADOS PRINCIPAIS DE DADOS --- */
const router = useRouter();
const {user, loading, signOut } = useAuth();
const [profile, setProfile] = useState<PEF | null>(null);

/*const [alunos, setAlunos] = useState<Aluno[]>([]);*/

const [treinadores, setTreinadores] = useState<PEF[]>([]);
const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);

const [masterAlunosList, setMasterAlunosList] = useState<Aluno[]>([]); // Nossa lista mestra, com TODOS os alunos.
const [displayedAlunos, setDisplayedAlunos] = useState<Aluno[]>([]); // A lista que será exibida na tela.
const [viewState, setViewState] = useState<ViewState>({ type: 'dashboard', alunoId: null });

/* --- ESTADOS DE UI (Controle de Visão e Filtros) --- */

const [statusFilter, setStatusFilter] = useState("todos");
const [nameFilter, setNameFilter] = useState("");
const [pefFilter, setPefFilter] = useState('ativo');
const [pefSearch, setPefSearch] = useState('')
const [isWorkoutLoading, setWorkoutLoading] = useState(false);
const [alunoFilter, setAlunoFilter] = useState<'todos' | 'ativo' | 'inativo'>('ativo');
const [alunoSearch, setAlunoSearch] = useState('');

/* --- ESTADOS DE UI (Controle de Modais e Menus) --- */
const [treinoEmEdicao, setTreinoEmEdicao] = useState<TreinoParaFormulario | null>(null);
const [pefEmEdicao, setPefEmEdicao] = useState<PEF | null>(null);
const [openAlunoMenuId, setOpenAlunoMenuId] = useState<string | null>(null);
const [isHeaderMenuOpen, setHeaderMenuOpen] = useState(false);// Controla a visibilidade do menu de 3 pontos no cabeçalho
const [isUploadModalOpen, setUploadModalOpen] = useState(false);// Controla a visibilidade do modal de upload de CSV
const [alunoParaVerHistorico, setAlunoParaVerHistorico] = useState<Aluno | null>(null);
const [historicoOpen, setHistoricoOpen] = useState<{ alunoId: string | null; loading: boolean } | null>(null);
const [historicoRows, setHistoricoRows] = useState<HistoricoRow[]>([]);
const [isGerenciarTreinoModalOpen, setGerenciarTreinoModalOpen] = useState(false);
const [exercicioEmEdicao, setExercicioEmEdicao] = useState<ExercicioParaModal | null>(null);
const [isAddAlunoModalOpen, setAddAlunoModalOpen] = useState(false);
const [alunoEmEdicao, setAlunoEmEdicao] = useState<Aluno | null>(null)


const [timeAgoToDisplay, setTimeAgoToDisplay] = useState<Record<string, string>>({});
const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
const headerMenuRef = useRef<HTMLDivElement>(null);
const [isAddPefModalOpen, setAddPefModalOpen] = useState(false); 
const [perfisCarregando, setPerfisCarregando] = useState(true);
const [tempoDeTreino, setTempoDeTreino] = useState("00:00:00");
const [exerciciosDoTreino, setExerciciosDoTreino] = useState<ExercicioDeSessao[]>([]);
const [treinoAtivo, setTreinoAtivo] = useState<Treino | null>(null);
const [ritmosByAluno, setRitmosByAluno] = useState<Record<string, Ritmo>>({});

    
  /* --- ESTADOS DERIVADOS E Refs --- */
const activeAluno = viewState.alunoId ? masterAlunosList.find((a) => a.id === viewState.alunoId) : null;
const activeSession = activeAluno ? activeSessions.find((s) => s.alunoId === activeAluno.id) : null;

const sessionsRef = useRef<ActiveSession[]>([]);
useEffect(() => {
  sessionsRef.current = activeSessions;
}, [activeSessions]);

const iniciandoSessaoRef = useRef<string | null>(null);

const finishingRef = useRef(false);

const statusById = useMemo(() => {
  // Ajuste: use 'activeSession' que é a variável disponível no Page
  if (!activeSession) return new Map();
  const m = new Map<string, LiveExercise["status"]>();
  for (const ex of activeSession.exercises ?? []) m.set(ex.id, ex.status);
  return m;
}, [activeSession]);

const exerciciosBase: ExercicioComStatus[] = useMemo(
  () =>
    (exerciciosDoTreino ?? []).map((ex) => ({
      ...ex,
      status: statusById.get(ex.exercicio_id) ?? "nao-iniciado",
    })),
  [exerciciosDoTreino, statusById]
);

const exerciciosParaRenderizar = useMemo(() => {
  const statusOrder: Record<LiveExercise["status"], number> = {
    executando: 1, "nao-iniciado": 2, finalizado: 3,
  };
  return [...exerciciosBase].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
}, [exerciciosBase]);

const sortedDisplayedAlunos = useMemo(() => {
  // Criamos uma cópia para não modificar o estado original
  return [...displayedAlunos].sort((a, b) => {
    const ritmoA = ritmosByAluno[a.id];
    const ritmoB = ritmosByAluno[b.id];
    const sessionA = activeSessions.find(s => s.alunoId === a.id);
    const sessionB = activeSessions.find(s => s.alunoId === b.id);

    // REGRA 1: Prioridade máxima para quem está "Atrasado".
    if (ritmoA === 'atrasado' && ritmoB !== 'atrasado') return -1;
    if (ritmoA !== 'atrasado' && ritmoB === 'atrasado') return 1;

    // REGRA GERAL: Alunos em treinamento sempre vêm antes dos disponíveis.
    if (sessionA && !sessionB) return -1;
    if (!sessionA && sessionB) return 1;

    // REGRA 2: Se ambos estão treinando, ordena pelo mais antigo (FIFO).
    if (sessionA && sessionB) {
      const timeA = new Date(sessionA.startTime).getTime();
      const timeB = new Date(sessionB.startTime).getTime();
      return timeA - timeB;
    }

    // REGRA 3: Se nenhum está treinando, ordena por nome.
    return a.nome.localeCompare(b.nome);
  });
}, [displayedAlunos, ritmosByAluno, activeSessions]); // <-- Dependências

const carregarDadosIniciais = useCallback(async () => {
  setPerfisCarregando(true);

  try {
    if (!user) {
      return;
    }

    console.log("--- DEBUG: Iniciando busca de todos os dados iniciais...");
    
    const [
      treinadoresData,
      sessoesData,
      alunosData
    ] = await Promise.all([
      fetchAllPefs(),
      fetchActiveSessions(),
      fetchAllAlunosCompletos()
    ]);

    
    setTreinadores(treinadoresData);
    setActiveSessions(sessoesData);
    setMasterAlunosList(alunosData);
    console.log("--- DEBUG: TODOS os dados foram carregados e o estado foi atualizado.");
    

  } catch (error) {
    console.error("--- DEBUG: Falha ao carregar dados iniciais:", error);
  } finally {
    setPerfisCarregando(false);
  }
}, [user]);

const shallowEqual = (a: Record<string, Ritmo>, b: Record<string, Ritmo>) => {
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
};

// Resolve quantos exercícios o plano tem (fonte “treino_exercicios” – estável)
const getTotalExerciciosPlano = useCallback((alunoId: string, treinoId: string) => {
  const aluno = masterAlunosList.find(a => a.id === alunoId);
  const treino = aluno?.treino.find(t => t.id === treinoId);
  return treino?.exercicios.length ?? 0;
}, [masterAlunosList]);

const computeRitmos = useCallback((sessions: ActiveSession[]) => {
  const map: Record<string, 'no_ritmo' | 'atrasado'> = {};
  for (const s of sessions) {
    const total = getTotalExerciciosPlano(s.alunoId, s.treinoId);
    if (!total || !s.startTime) continue;

    const finalizados = s.exercises?.filter(ex => ex.status === 'finalizado').length ?? 0;
    const ritmo = calcularRitmo(String(s.startTime), finalizados, total);
    map[String(s.alunoId)] = ritmo;
  }
  return map;
}, [getTotalExerciciosPlano]);

// 2) Função única de refresh, com override opcional
const refreshRitmos = useCallback((reason: string, overrides?: Record<string, ActiveSession>) => {
  setRitmosByAluno(prev => {
    // GUARD: se não há sessões, mantém o estado anterior (não zera)
    if (!activeSessions || activeSessions.length === 0) return prev;

    // aplica overrides (se vieram) e calcula com a rotina PÚRA já existente
    const base: ActiveSession[] = overrides
      ? activeSessions.map(s => overrides[s.alunoId] ?? s)
      : activeSessions;

    const next = computeRitmos(base);

    if (!shallowEqual(prev, next)) {
      console.info('[RITMO] atualização', { reason, next });
      return next;
    }
    return prev;
  });
}, [activeSessions, computeRitmos]);

const updateRitmos = useCallback((reason: string, override?: ActiveSession[]) => {
  if (override && override.length) {
    const map = Object.fromEntries(override.map(s => [String(s.alunoId), s]));
    refreshRitmos(reason, map);
  } else {
    refreshRitmos(reason);
  }
}, [refreshRitmos]);

const recomputeTimeAgo = useCallback((reason: string) => {
  setTimeAgoToDisplay(prev => {
    const next: Record<string, string> = {};
    for (const s of activeSessions) {
      if (!s.startTime) continue;
      next[String(s.alunoId)] = calculateTimeAgo(String(s.startTime));
    }

    // dedupe para evitar re-render desnecessário
    const pk = Object.keys(prev), nk = Object.keys(next);
    let changed = pk.length !== nk.length;
    if (!changed) for (const k of nk) { if (prev[k] !== next[k]) { changed = true; break; } }

    if (changed) {
      console.log("[TIMEAGO] atualização", { reason, next });
      return next;
    } else {
      console.log("[TIMEAGO] sem mudanças", { reason });
      return prev;
    }
  });
}, [activeSessions]);

const refetchActiveSessionsDedup = async () => {
  const rows = await fetchActiveSessions();            // já normaliza { alunoId, startTime, ... }
  const unique = dedupSessionsByAluno(rows as ActiveSession[]);
  setActiveSessions(unique);                           // usa o setter do seu useState
  return unique;
};

const handleCloseHistorico = () => {
  setHistoricoOpen(null);
  setHistoricoRows([]);
  setAlunoParaVerHistorico(null);
};

// A função que vai chamar a API de cadastro de aluno
const handleAddAluno = async (novoAluno: NovoAlunoData) => {
  try {
    const response = await fetch('/api/alunos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(novoAluno),
    });

    const result = await response.json();

    if (!response.ok) {
      if (result.errors && Array.isArray(result.errors)) {
        // Mapeia o array de erros para um objeto Record<string, string>
        const newErrors: Record<string, string> = {};
        result.errors.forEach((err: { field: string; error: string }) => {
          newErrors[err.field] = err.error;
        });
        return newErrors;
      } else {
        // Para erros genéricos, use uma chave padrão como 'apiError'
        return { apiError: result.error || 'Ocorreu um erro inesperado.' };
      }
    }

    // Adiciona o novo aluno à lista
    setMasterAlunosList(prevAlunos => {
      const alunoComId = result.aluno;
      return [...prevAlunos, alunoComId];
    });
    setAddAlunoModalOpen(false);

    // Retorna null para indicar que não houve erro
    return null;
  } catch (error) {
    console.error("Erro ao cadastrar novo aluno:", error);
    return { apiError: 'Falha na comunicação com o servidor.' };
  }
};

// Função para abrir o modal de edição.
const handleOpenEditAlunoModal = (aluno: Aluno) => {
  setAlunoEmEdicao(aluno);
};

// Função que será passada para o AlunoEditModal, responsável por salvar os dados.
const handleSaveEditAluno = async (alunoAtualizado: Aluno) => {
  try {
    const response = await fetch('/api/alunos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alunoAtualizado), // Envia os dados atualizados (incluindo o ID)
    });

    const result = await response.json();

    if (!response.ok) {
      if (result.errors) {
        return result.errors;
      } else {
        return { apiError: result.error || 'Ocorreu um erro inesperado.' };
      }
    }

    // Atualiza a lista de alunos com os dados editados
    setMasterAlunosList(prevAlunos => 
      prevAlunos.map(aluno =>
        aluno.id === result.aluno.id ? {...aluno, ...result.aluno} : aluno
      )
    );
    setAlunoEmEdicao(null); // Fecha o modal de edição
    return null;
  } catch (error) {
    console.error("Erro ao salvar alterações do aluno:", error);
    return { apiError: 'Falha na comunicação com o servidor.' };
  }
};


  /* --- EFEITOS COLATERAIS (useEffect) --- */

useEffect(() => {
function handleClickOutside(event: MouseEvent) {
if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
setHeaderMenuOpen(false);
}
}
document.addEventListener("mousedown", handleClickOutside);
return () => {
document.removeEventListener("mousedown", handleClickOutside);
};

}, []);
useEffect(() => {
    console.log("Estado 'alunos' foi atualizado:", masterAlunosList);
}, [masterAlunosList]);
useEffect(() => {
  // Se o usuário da autenticação estiver disponível, buscamos seu perfil
  if (user) {
    const fetchProfile = async () => {
      // Faz uma chamada à tabela 'profiles' buscando a linha
      // onde a coluna 'id' é igual ao user.id do usuário logado
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(); // .single() pega apenas um resultado

      if (error) {
        console.error("Erro ao buscar perfil:", error);
      } else if (data) {
        setProfile(data); // Armazena os dados do perfil no nosso novo estado
      }
    };

    fetchProfile();
  }
}, [user]); // Este efeito roda sempre que o 'user' mudar
useEffect(() => {
  carregarDadosIniciais();
}, [carregarDadosIniciais]); // As dependências de setters de estado podem ser removidas, pois são estáveis.
useEffect(() => {
  // Se não há uma sessão ativa, simplesmente limpa a lista de exercícios e encerra.
  if (!activeSession?.treinoId) {
    setExerciciosDoTreino([]);
    setTreinoAtivo(null);
    return;
  }

  const fetchDetalhesDoTreino = async () => {
    setWorkoutLoading(true); // 1. LIGA o estado de carregamento

    try {
      // --- ETAPA 1: BUSCAR OS DADOS DO TREINO (NOME, ETC.) ---
      const { data: treinoData, error: treinoError } = await supabase
        .from('treinos')
        .select('*')
        .eq('id', activeSession.treinoId)
        .single();

      if (treinoError) throw treinoError;
      setTreinoAtivo(treinoData); // <-- ARMAZENA O NOME DO TREINO NO ESTADO

      // --- ETAPA 2: BUSCAR OS EXERCÍCIOS DO TREINO ---
      const { data: exerciciosData, error: exerciciosError } = await supabase
        .from('treino_exercicios')
        .select(`*, exercicios ( nome )`)
        .eq('treino_id', activeSession.treinoId)
        .order('ordem');

      if (exerciciosError) throw exerciciosError;

      const dadosFormatados: ExercicioDeSessao[] = (exerciciosData as TreinoExercicioComNome[] ?? []).map((item: TreinoExercicioComNome) => ({
            id: item.id,
            treino_id: item.treino_id,
            exercicio_id: item.exercicio_id,
            ordem: item.ordem,
            series: item.series,
            repeticoes: item.repeticoes,
            carga: item.carga,
            observacoes: item.observacoes,
            nome: item.exercicios?.nome || 'Exercício não encontrado',
          }));

      setExerciciosDoTreino(dadosFormatados); // 2. Preenche o estado com os dados

    } catch (error) {
      console.error("Erro ao buscar detalhes do treino:", error);
      setExerciciosDoTreino([]); // Limpa a lista em caso de erro
      setTreinoAtivo(null);
    } finally {
      setWorkoutLoading(false); // 3. DESLIGA o estado de carregamento (sempre, com sucesso ou erro)
    }
  };

  fetchDetalhesDoTreino();
}, [activeSession?.treinoId]); // A única dependência necessária é a sessão ativa
// Bloco 2: O Cronômetro de 1s que cuida do TEMPO para a tela de treino ao vivo
useEffect(() => {
  if (viewState.type !== 'workout' || !activeSession) {
    setTempoDeTreino("00:00:00");
    return;
  }

  const updateClock = () => {
    const startTime = new Date(activeSession.startTime);
    const tempoDecorrridoEmSegundos = Math.round((Date.now() - startTime.getTime()) / 1000);
    const horas = Math.floor(tempoDecorrridoEmSegundos / 3600).toString().padStart(2, '0');
    const minutos = Math.floor((tempoDecorrridoEmSegundos % 3600) / 60).toString().padStart(2, '0');
    const segundos = (tempoDecorrridoEmSegundos % 60).toString().padStart(2, '0');
    setTempoDeTreino(`${horas}:${minutos}:${segundos}`);
  };

  updateClock(); // Roda imediatamente
  const timerId = setInterval(updateClock, 1000); // Roda a cada segundo
  
  return () => clearInterval(timerId);
}, [activeSession, viewState.type]); // Depende da sessão e da view
useEffect(() => {
  // Este ticker agora roda continuamente em segundo plano,
  // atualizando tanto o ritmo quanto o tempo "há xxx".
  
  // Ticker de 15 segundos para o ritmo
  refreshRitmos('initial-load');
  recomputeTimeAgo('initial-load');


  // Em seguida, agendamos as atualizações contínuas (tickers).
  const ritmoIntervalId = setInterval(() => {
    refreshRitmos('interval/15s');
  }, 15000);

  const timeAgoIntervalId = setInterval(() => {
    recomputeTimeAgo('interval/60s');
  }, 60000);

  // Limpa os dois intervalos quando o componente é desmontado
  return () => {
    clearInterval(ritmoIntervalId);
    clearInterval(timeAgoIntervalId);
  };

}, [refreshRitmos, recomputeTimeAgo]);
// Em page.tsx, substitua o useEffect de filtragem por este:

useEffect(() => {
  // --- LÓGICA PARA A VISÃO DO DASHBOARD ---
  if (viewState.type === 'dashboard') {
    // Começa com a lista completa
    let alunosFiltrados = masterAlunosList;

    // REGRA DO DASHBOARD: Mostrar APENAS alunos com matrícula ativa
    alunosFiltrados = alunosFiltrados.filter(
      aluno => aluno.matricula_status === 'ativo'
    );

    // Aplica o filtro dos botões de status (em_treinamento, meus_alunos, etc.)
    alunosFiltrados = alunosFiltrados.filter(aluno => {
      const sessaoAtiva = activeSessions.find(s => s.alunoId === aluno.id);
      const statusReal = sessaoAtiva ? 'em_treinamento' : 'disponivel';

      if (statusFilter === 'todos') return true;
      if (statusFilter === 'meus_alunos') {
        return sessaoAtiva?.pef_responsavel_id === profile?.id;
      }
      return statusReal === statusFilter;
    });

    // Aplica o filtro de busca por nome
    if (nameFilter) {
      alunosFiltrados = alunosFiltrados.filter(aluno =>
        normalizeString(aluno.nome).includes(normalizeString(nameFilter))
      );
    }
    
    setDisplayedAlunos(alunosFiltrados);
  } 
  
  // --- LÓGICA PARA A VISÃO DE GERENCIAR ALUNOS ---
  else if (viewState.type === 'gerenciar_alunos') {
    let alunosParaGerenciar = masterAlunosList; // Começa com a lista COMPLETA

    // Aplica o filtro dos botões (ativo/inativo/todos)
    if (alunoFilter !== 'todos') {
      alunosParaGerenciar = alunosParaGerenciar.filter(
        aluno => aluno.matricula_status === alunoFilter
      );
    }

    // Aplica o filtro de busca por nome
    if (alunoSearch) {
      alunosParaGerenciar = alunosParaGerenciar.filter(aluno =>
        aluno.nome.toLowerCase().includes(alunoSearch.toLowerCase())
      );
    }
    
    setDisplayedAlunos(alunosParaGerenciar);
  }

  // --- LÓGICA PADRÃO PARA TODAS AS OUTRAS TELAS ---
  else {
    // Para qualquer outra tela (workout, editar_treino, etc.),
    // garantimos que a lista exibida seja a lista mestra completa.
    setDisplayedAlunos(masterAlunosList);
  }
  
}, [
  masterAlunosList, 
  viewState, 
  activeSessions,
  profile,
  // Filtros do Dashboard
  statusFilter, 
  nameFilter, 
  // Filtros de Gerenciamento
  alunoFilter, 
  alunoSearch
]);


/* --- HANDLERS E CALLBACKS (useCallback) --- */
const onExcluirTreino = useCallback(async (alunoId: string, treinoId: string) => {
    if (confirm("Tem certeza que deseja excluir este treino? Esta ação não pode ser desfeita.")) {
        try {
            await deleteTreino(treinoId);
            await carregarDadosIniciais();
            alert("Treino excluído com sucesso!");
            } catch (error) {
                console.error("Erro ao excluir o treino:", error);
                // Adicionamos uma verificação de tipo para segurança
                if (error instanceof Error) {
                    alert(`Ocorreu um erro ao excluir o treino: ${error.message}`);
                } else {
                    alert("Ocorreu um erro desconhecido ao excluir o treino.");
                }
            }
    }
}, [carregarDadosIniciais]);
const onEditarTreino = useCallback(async (treinoId: string) => {
  if (!activeAluno) {
    console.error("Erro: Nenhum aluno ativo para editar o treino.");
    return;
  }
  
  console.log("Iniciando edição de treino com ID:", treinoId);
  try {
    // 1. Usa o novo serviço para buscar os dados completos do treino
    const treinoCompleto = await fetchTreinoComExercicios(treinoId);

    // 2. Carrega os estados de edição com os dados vindos do backend
    setTreinoEmEdicao(treinoCompleto); // Carrega o treino completo no estado de edição

    // 3. Navega para a tela de edição
    setViewState({ type: 'editar_treino', alunoId: activeAluno.id });

} catch (error: unknown) { // Usamos 'unknown' para mais segurança
  console.error("Erro ao buscar detalhes do treino para edição:", error);
  // Agora usamos a mensagem do erro capturado no alert
  if (error instanceof Error) {
    alert(`Não foi possível carregar o treino para edição: ${error.message}`);
  } else {
    alert("Não foi possível carregar o treino para edição devido a um erro desconhecido.");
  }
}
}, [activeAluno]); // Dependências
const handleNavigateToWorkout = useCallback((alunoId: string) => {
  // 1. A primeira coisa a fazer é verificar se JÁ EXISTE uma sessão ativa para este aluno.
  const sessaoExistente = activeSessions.find(s => s.alunoId === alunoId);

  if (sessaoExistente) { // <<< LÓGICA CORRIGIDA
    console.log("Aluno já em treinamento. Navegando para a sessão existente.");
    // Se já existe, vai direto para a tela de treino, passando o treinoId da sessão
    setViewState({ type: "workout", alunoId: alunoId, treinoId: sessaoExistente.treinoId });
    return;
  }

  // 2. Se NÃO há sessão, continuamos com a lógica original para iniciar um NOVO treino.
  const aluno = masterAlunosList.find((a) => a.id === alunoId);
  if (!aluno) return; // Guarda de segurança caso o aluno não seja encontrado

  const treinosDisponiveis = aluno.treino.filter((t) => t.status === 'ativo');

  if (treinosDisponiveis.length > 0) {
    // Se tem treinos disponíveis, vai para a tela de seleção
    setViewState({ type: "select_plan", alunoId: alunoId });
  } else {
    // Se não tem, avisa o usuário
    alert("Este aluno não possui um treino ativo para iniciar.");
  }
}, [masterAlunosList, activeSessions, setViewState]); // <-- MUDANÇA: Adicionar 'activeSessions' e 'setViewState' às dependências
const handleUpdateExerciseStatus = useCallback(
  async (alunoId: string, exercicioId: string, newStatus: LiveExercise["status"]) => {
    const session = activeSessions.find(s => s.alunoId === alunoId);
    if (!session) return;

    // 1) Base tipada corretamente
    const base: LiveExercise[] = Array.isArray(session.exercises)
      ? (session.exercises as LiveExercise[])
      : [];

    // 2) Atualização tipada como LiveExercise[]
    const updated: LiveExercise[] = base.some((ex: LiveExercise) => ex.id === exercicioId)
      ? base.map<LiveExercise>((ex: LiveExercise) =>
          ex.id === exercicioId
            ? { ...ex, status: newStatus }
            : newStatus === "executando" && ex.status === "executando"
              ? { ...ex, status: "nao-iniciado" as const }
              : ex
        )
      : [...base, { id: exercicioId, status: newStatus }];

    // 3) Persistir no DB
    const { error } = await supabase
      .from("sessoes_ativas")
      .update({ exercises: updated })
      .eq("id", session.id);

    if (error) {
      console.error(error);
      alert("Não foi possível atualizar o exercício.");
      return;
    }

    // 4) Espelhar na UI: array tipado como ActiveSession[]
    const nextSessions: ActiveSession[] = activeSessions.map(s =>
      s.id === session.id ? { ...s, exercises: updated } : s
    );
    setActiveSessions(nextSessions);

    // 5) Recalcular ritmos
    updateRitmos("update-exercise-status", nextSessions);
  },
  [activeSessions, updateRitmos]
);
const handleBackToDashboard = useCallback(
  () => setViewState({ type: "dashboard", alunoId: null }),
  []
); // <-- Array de dependências vazio
const handleGerenciarTreinos = useCallback((alunoId: string) => {
  setViewState({ type: "gerenciar_treinos", alunoId });
}, []); // <-- Array de dependências
const handleAddExercicio = useCallback(() => {
  // Garante que só funciona se houver um treino em edição
  if (!treinoEmEdicao) return;

  // Cria um novo objeto de exercício com valores padrão
  const novoExercicio: ExercicioParaFormulario = {
    exercicio_id: '',
    nome: "",
    series: "",
    repeticoes: "",
    carga: "",
    observacoes: "",
    isEditing: true,
  };

  // Atualiza o estado, adicionando o novo exercício ao final da lista existente
  setTreinoEmEdicao((treinoAtual) => {
    if (!treinoAtual) return null; // Trava de segurança
    return {
      ...treinoAtual,
      exercicios: [...treinoAtual.exercicios, novoExercicio],
    };
  });
}, [treinoEmEdicao]);
// Função para ABRIR o modal de edição
  const handleEditExercicio = useCallback((treinoId: string, treinoExercicioId: string) => {
    console.log(`Abrindo modal para editar o exercício ${treinoExercicioId} do treino ${treinoId}`);

    const alunoSource = masterAlunosList.find(a => a.treino.some(t => t.id === treinoId));
    if (!alunoSource) {
      console.error("Aluno não encontrado para editar exercício.");
      return;
    }

    const treinoSource = alunoSource.treino.find(t => t.id === treinoId);
    if (!treinoSource) {
      console.error("Treino não encontrado para editar exercício.");
      return;
    }

    const treinoExercicioSource = treinoSource.exercicios.find(ex => ex.id === treinoExercicioId)

    // CORREÇÃO: Acessando a propriedade 'exercicio' que agora existe no tipo
    if (!alunoSource || !treinoSource || !treinoExercicioSource || !treinoExercicioSource.exercicio) {
      console.error(`FALHA AO ABRIR MODAL: Não foi possível encontrar todos os dados para o exercício ID: ${treinoExercicioId}`);
      alert("Ocorreu um erro ao tentar editar o exercício. Tente recarregar a página.");
      return;
    }

    const exercicioParaModal: ExercicioParaModal = {
      id: treinoExercicioSource.id,
      exercicio_id: treinoExercicioSource.exercicio_id,
      nome: treinoExercicioSource.exercicio.nome, // CORREÇÃO: Acessando a propriedade aninhada
      series: treinoExercicioSource.series,
      repeticoes: treinoExercicioSource.repeticoes,
      carga: treinoExercicioSource.carga,
      observacoes: treinoExercicioSource.observacoes || "",
    };

    setExercicioEmEdicao(exercicioParaModal);
    setGerenciarTreinoModalOpen(true);

  }, [masterAlunosList]);
// Função para FECHAR o modal de edição
const handleFinishWorkout = useCallback(async () => {
  // Guardas rápidos
  const alunoId = viewState.type === 'workout' ? viewState.alunoId : null;
  if (!alunoId || finishingRef.current) return;
  finishingRef.current = true;

  // Snapshot mais recente da sessão do aluno
  const latest = sessionsRef.current.find(s => s.alunoId === alunoId) ?? null;

  console.info('[FINISH] iniciando', {
    alunoId,
    latestSessionId: latest?.id ?? '(nenhuma encontrada)',
  });

  try {

if (latest?.startTime) {
  // 1) calcula total a partir do snapshot
let total = (latest.totalPlanejados ?? latest.exercises?.length ?? 0) || 0;

// 1.1) FALLBACK: se ainda ficou 0, tenta pegar do plano de treino
if (total === 0 && latest.treinoId) {
  const planejados = getTotalExerciciosPlano(latest.alunoId, latest.treinoId);
  if (typeof planejados === 'number') total = planejados;
}

  const finalizados = latest.exercises?.filter(ex => ex.status === 'finalizado').length ?? 0;

  // mantém sua regra: só grava se houver total>0
  if (total > 0) {
    const ritmo = calcularRitmo(String(latest.startTime), finalizados, total);
    const statusHist: 'completo' | 'incompleto' =
      finalizados >= total ? 'completo' : 'incompleto';

    // 🚩 nomes alinhados ao schema
    const payload = {
      aluno_id: alunoId,
      treino_id: latest.treinoId ?? null,
      start_time: new Date(latest.startTime).toISOString(), // ok
      end_time: new Date().toISOString(),                   // ok
      session_date: new Date(latest.startTime).toISOString().slice(0, 10), // 'YYYY-MM-DD'
      total_planejados: total,
      finalizados,
      status: statusHist,
      ritmo_final: ritmo,                                    // ok
      pef_responsavel_id: profile?.id ?? null,
    };

    const { error: histErr, data: histData, status: histStatus } = await supabase
      .from('treino_historico')
      .upsert(payload, { onConflict: 'aluno_id,session_date' }) // 1 por dia por aluno
      .select('id')
      .maybeSingle();

    if (histErr) {
      console.warn('[HIST upsert] falhou', histStatus, histErr, payload);
    } else {
      console.info('[HIST upsert] ok', histStatus, histData);
    }
  } else {
    console.info('[FINISH] histórico: ignorado (total_planejados=0)');
  }
} else {
  console.info('[FINISH] histórico: ignorado (sem startTime no snapshot)');
}// --- SEMPRE rodar o delete + atualizações de estado ---
console.info('[FINISH] going to delete', { alunoId });

const { data, error, status } = await supabase
  .from('sessoes_ativas')
  .delete()
  .eq('aluno_id', alunoId)
  .select('id')     // força retorno 0/1 linha
  .maybeSingle();

console.info('[FINISH] delete-by-aluno resp', { status, ok: !!data && !error, error, data });
if (error) throw error;

// Estado local idempotente: remove a sessão desse aluno
const nextSessions = sessionsRef.current.filter(s => s.alunoId !== alunoId);
setActiveSessions(nextSessions);

// (opcional) limpa o ritmo do aluno no array de alunos, se você exibe isso no card
setMasterAlunosList(prev => prev.map(a => a.id === alunoId ? { ...a, ritmo: undefined } : a));

// Recalcula ritmos do dashboard já com a sessão removida
updateRitmos('finalizar-treino', nextSessions);

// Volta para o dashboard preservando o resto do ViewState
setViewState(prev => ({ ...prev, type: 'dashboard' }));

console.info('[FINISH] concluído com sucesso');
} catch (e) { // Removido o tipo 'any'
    console.error('[FINISH] erro ao finalizar treino', e);
    
    // Adicionamos uma verificação para extrair a mensagem de forma segura
    if (e instanceof Error) {
        alert(`Não foi possível finalizar o treino: ${e.message}`);
    } else {
        alert('Não foi possível finalizar o treino. Veja o console para detalhes.');
    }
} finally {
    finishingRef.current = false;
  }
}, [viewState, setActiveSessions, setMasterAlunosList, updateRitmos, setViewState, profile, getTotalExerciciosPlano]);
const handleCloseEditModal = useCallback(() => {
  setExercicioEmEdicao(null); // Limpa o estado, o que vai fechar o modal
}, []); // <-- Array de dependências com 'alunos'
// Esta é a nova instrução de salvamento que você perguntou
const handleSaveExercicio = async (exercicioAtualizado: ExercicioParaModal) => {
    if (!exercicioAtualizado || !exercicioAtualizado.id) {
      console.error("Tentativa de salvar um exercício inválido.");
      return;
    }

    try {
      // 1. Atualiza no banco de dados (seu código, já correto)
const { error } = await supabase
  .from('treino_exercicios')
  .update({
    series: Number(exercicioAtualizado.series),
    repeticoes: String(exercicioAtualizado.repeticoes),
    carga: String(exercicioAtualizado.carga || ''),
    observacoes: String(exercicioAtualizado.observacoes || ''),
  })
  .eq('id', exercicioAtualizado.id);

      if (error) throw error;

      // 2. Atualiza a masterAlunosList (seu código, já correto)
      const novosAlunos = masterAlunosList.map(aluno => ({
        ...aluno,
        treino: aluno.treino.map(treino => ({
          ...treino,
          exercicios: treino.exercicios.map(ex => {
            if (ex.id === exercicioAtualizado.id) {
              return {
                ...ex,
                series: exercicioAtualizado.series,
                repeticoes: exercicioAtualizado.repeticoes,
                carga: exercicioAtualizado.carga,
                observacoes: exercicioAtualizado.observacoes,
              };
            }
            return ex;
          }),
        })),
      }));
      setMasterAlunosList(novosAlunos);

      // =======================================================
      // --- PASSO 3: ATUALIZAR O ESTADO DA TELA DE WORKOUT ---
      // =======================================================
      setExerciciosDoTreino(currentExercicios =>
        currentExercicios.map(ex => {
          if (ex.id === exercicioAtualizado.id) {
            // Se encontrarmos o exercício, atualizamos seus detalhes
            return {
              ...ex, // Mantém o que já tinha (id, nome, status, etc)
              series: exercicioAtualizado.series,
              repeticoes: exercicioAtualizado.repeticoes,
              carga: exercicioAtualizado.carga,
              observacoes: exercicioAtualizado.observacoes,
            };
          }
          // Se não for o exercício que mudou, retorna ele como estava
          return ex;
        })
      );


      // 4. Fecha o modal
      setGerenciarTreinoModalOpen(false);
      setExercicioEmEdicao(null);
      alert('Exercício atualizado com sucesso!');

  } catch (error) {
    if (error instanceof Error) {
      console.error("Erro ao salvar as alterações do exercício:", error.message);
      alert("Não foi possível salvar as alterações. " + error.message);
    } else {
      console.error("Erro desconhecido ao salvar as alterações do exercício:", error);
      alert("Não foi possível salvar as alterações. Verifique o console para mais detalhes.");
    }
  }
};
// Esta função agora recebe o ÍNDICE do exercício a ser removido
const handleDeleteExercicio = useCallback ((treinoId: string, exercicioId: string)  => {
    // 1. Confirmação com o usuário (boa prática que você já tinha)
    if (!confirm("Tem certeza que deseja remover este exercício do treino?")) {
        return;
    }

    // 2. Garante que temos um treino em edição
    if (!treinoEmEdicao) {
        console.error("Não há treino em edição para remover um exercício.");
        return;
    }

    // 3. Atualiza o estado 'treinoEmEdicao', removendo o exercício pelo seu índice
    setTreinoEmEdicao(treinoAtual => {
        if (!treinoAtual) return null;

        // Cria uma nova lista de exercícios, filtrando para remover o item no índice desejado
        const exerciciosAtualizados = treinoAtual.exercicios.filter(
            (ex) => ex.exercicio_id !== exercicioId);

        // Retorna o novo estado do treino com a lista de exercícios atualizada
        return {
            ...treinoAtual,
            exercicios: exerciciosAtualizados,
        };
    });

}, [treinoEmEdicao]); // A única dependência necessária é o treino em edição
// Adicione esta nova função dentro do seu componente Page
const handleExcluirExercicioDoGerenciamento = useCallback(async (treinoId: string, exercicioId: string) => {
    if (!confirm("Tem certeza que deseja excluir este exercício permanentemente?")) {
        return;
    }

    try {
        // 1. Deleta o exercício diretamente da tabela 'treino_exercicios' no Supabase
        const { error } = await supabase
            .from('treino_exercicios')
            .delete()
            .eq('id', exercicioId); // O 'exercicioId' aqui é o ID único da linha

        if (error) throw error;

        // 2. Atualiza o estado local 'alunos' para remover o exercício da UI instantaneamente
        const novosAlunos = masterAlunosList.map(aluno => {
            const treinosAtualizados = aluno.treino.map(treino => {
                if (treino.id === treinoId) {
                    // Se encontrarmos o treino correto, filtramos a lista de exercícios
                    const exerciciosFiltrados = treino.exercicios.filter(ex => ex.id !== exercicioId);
                    return { ...treino, exercicios: exerciciosFiltrados };
                }
                return treino;
            });
            return { ...aluno, treino: treinosAtualizados };
        });

        setMasterAlunosList(novosAlunos);
        alert('Exercício excluído com sucesso!');

    } catch (error) {
        console.error("Erro ao excluir o exercício:", error);
        alert("Não foi possível excluir o exercício. Tente novamente.");
    }
}, [masterAlunosList]); // Depende do estado 'alunos' para poder atualizá-lo
// Handler para os campos do próprio treino (ex: nome do treino)
const handleTreinoInputChange = useCallback((
  campo: keyof Omit<TreinoParaFormulario, 'exercicios'>, valor: string) => {
    if (!treinoEmEdicao) return;
  if (validationErrors.treinoNome) {
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.treinoNome;
      return newErrors;
    });
  }
    // Atualiza o estado do treino em edição com o novo valor do campo
    setTreinoEmEdicao((treinoAtual) => ({
      ...treinoAtual!,
      [campo]: valor,
    }));
  },
[treinoEmEdicao, validationErrors]);
// Handler para os campos de um exercício específico dentro do treino
const handleExercicioInputChange = useCallback(
(exercicioIndex: number, campo: keyof ExercicioParaFormulario, valor: string | number) => {
    if (!treinoEmEdicao) return;
  const errorKey = `exercicios[${exercicioIndex}].${campo}`;
  if (validationErrors[errorKey]) {
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[errorKey];
      return newErrors;
    });
  }

  const exerciciosAtualizados = treinoEmEdicao.exercicios.map((ex, index) => {
    if (index === exercicioIndex) { // << Correção aplicada
      return { ...ex, [campo]: valor };
    }
    return ex;
  });

  setTreinoEmEdicao((treinoAtual) => ({
    ...treinoAtual!,
    exercicios: exerciciosAtualizados,
  }));
},
[treinoEmEdicao, validationErrors]);
const handleCriarNovoTreino = useCallback((aluno: Aluno) => {
  // 1. Cria um novo objeto de treino em branco, já no formato de formulário
  // Usando nosso tipo TreinoParaFormulario
  const novoTreino: TreinoParaFormulario = {
    // Campos da tabela 'treinos'
    id: `temp-${Date.now()}`, // Usamos um ID temporário com um prefixo para clareza
    aluno_id: aluno.id,
    nome: "", // Começa com o nome em branco
    status: 'ativo', // Valor padrão para o novo campo 'status'
    descricao: "",

    // Array de exercícios, que é obrigatório em TreinoParaFormulario
    exercicios: [{
      tempId: `temp-${Date.now()}`, // Use um ID temporário e único
      exercicio_id: '',
      nome: "",
      series: "",
      repeticoes: "",
      carga: "",
      observacoes: "",
    }],
};

  // 2. Coloca este novo treino no estado de edição.
  // Agora os tipos são compatíveis.
  setTreinoEmEdicao(novoTreino);
  
  // 3. Guarda o aluno em edição e navega para a tela
  setViewState({ type: 'editar_treino', alunoId: aluno.id });

}, []); // Dependências podem ser adicionadas se necessário, como setViewState, etc.
const handleAlunosImported = useCallback((novosAlunos: Aluno[]) => {
// Adiciona os novos alunos à lista existente, evitando duplicatas por ID
setMasterAlunosList(alunosAtuais => {
  const alunosExistentesIds = new Set(alunosAtuais.map(a => a.id));
  const alunosFiltrados = novosAlunos.filter(a => !alunosExistentesIds.has(a.id));
  return [...alunosAtuais, ...alunosFiltrados];
});
setUploadModalOpen(false); // Fecha o modal após a importação
}, []);
const handleVerHistorico = useCallback(async (alunoId: string) => {
  // define o aluno mostrado no cabeçalho do modal
  const alunoSelecionado = masterAlunosList.find(a => a.id === alunoId) || null;
  setAlunoParaVerHistorico(alunoSelecionado);

  // abre modal em “loading”
  setHistoricoOpen({ alunoId, loading: true });

  try {
    const rows = await fetchHistoricoUltimos30(alunoId); // sua função já criada
    setHistoricoRows(rows);
  } catch (e) {
    console.error('[Historico] erro ao carregar', e);
    setHistoricoRows([]);
  } finally {
    // tira o loading, mantendo o modal aberto
    setHistoricoOpen(prev => (prev ? { ...prev, loading: false } : prev));
  }
}, [masterAlunosList]);
const handleSaveTreino = useCallback(async () => {
  // 1. Trava de segurança e Validação
  if (!treinoEmEdicao || !activeAluno || !profile) {
    console.error("Faltam dados essenciais para salvar: treino, aluno ou perfil.");
    return;
  }

  const { isValid, errors } = validateTreino(treinoEmEdicao);
  setValidationErrors(errors);

  if (!isValid) {
    const mensagens = Object.values(errors).map((msg) => `• ${msg}`);
    const listaDeErros = mensagens.join('\n');
    alert(`🚫 O treino contém erro(s) e não pode ser salvo:\n\n${listaDeErros}`);
    return;
  }
  
  // 2. Lógica de Criação ou Edição no Backend (Lógica nova)
  try {
    const { id, exercicios, ...dadosDoTreino } = treinoEmEdicao;
    const pefId = profile.id;

    // VERIFICAMOS SE O ID É TEMPORÁRIO PARA DECIDIR SE VAMOS CRIAR OU ATUALIZAR
    if (String(id).startsWith('temp-')) {
      // É um novo treino: criamos um novo registro no banco de dados.
      await createTreinoCompleto(dadosDoTreino, exercicios, pefId);
      alert('Treino criado com sucesso!');
      await carregarDadosIniciais();
    } else {
      // É um treino existente: atualizamos o registro no banco de dados.
      // Você precisará criar a função updateTreinoCompleto no seu serviço.
      await updateTreinoCompleto(id, dadosDoTreino, exercicios, pefId);
      alert('Treino atualizado com sucesso!');
      await carregarDadosIniciais();
    }

    // 3. Limpeza de Estado e Navegação
    const alunoIdParaNavegar = activeAluno.id;
    setTreinoEmEdicao(null);
    setViewState({ type: 'gerenciar_treinos', alunoId: alunoIdParaNavegar });
  } catch (error) {
    alert('Ocorreu um erro ao salvar o treino no banco de dados. Tente novamente.');
    console.error(error);
  }
  
}, [treinoEmEdicao, activeAluno, profile, setValidationErrors, carregarDadosIniciais]);
const handleExercicioSelect = useCallback((exercicioIndex: number, suggestion: Exercicio) => { // TIPO CORRIGIDO AQUI
  if (!treinoEmEdicao) return;

  const errorKey = `exercicios[${exercicioIndex}].nome`;

  // Verifica se o exercício já foi adicionado (ignora o índice atual)
  const isDuplicado = treinoEmEdicao.exercicios.some((ex, idx) => {
    // CORREÇÃO: Compara ex.exercicio_id com suggestion.id
    return idx !== exercicioIndex && ex.exercicio_id === suggestion.id;
  });

  if (isDuplicado) {
    setValidationErrors((prev) => ({
      ...prev,
      [errorKey]: `${suggestion.nome} já está em outro card. Escolha outro exercício ou exclua o card.`,
    }));
    return; // Não atualiza o exercício duplicado
  }

  // Se não for duplicado, remove o erro (caso exista) e atualiza
  if (validationErrors[errorKey]) {
    setValidationErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[errorKey];
      return newErrors;
    });
  }

  // Atualiza o exercício no estado treinoEmEdicao com os dados da sugestão selecionada
  const exerciciosAtualizados = treinoEmEdicao.exercicios.map((ex, index) => {
    if (index === exercicioIndex) {
      return {
        ...ex,
        exercicio_id: suggestion.id, // Guarda o ID do exercício selecionado
        nome: suggestion.nome,       // Atualiza o nome no formulário
      };
    }
    return ex;
  });

  setTreinoEmEdicao(prevTreino => {
      if (!prevTreino) return null;
      return {
          ...prevTreino,
          exercicios: exerciciosAtualizados
      }
  });

}, [treinoEmEdicao, validationErrors]);
const handleOpenEditPefModal = useCallback((pef: PEF) => {
  setPefEmEdicao(pef);
}, []);
const handleUpdatePef = useCallback(async (pefAtualizado: PEF) => {
  try {
    // 1. Envia a atualização para a tabela 'profiles' no Supabase
    const { error } = await supabase
      .from('profiles')
      .update({
        nome: pefAtualizado.nome,
        cpf: pefAtualizado.cpf,
        cref: pefAtualizado.cref,
        is_estagiario: pefAtualizado.is_estagiario
        // O e-mail não é atualizado aqui, pois geralmente é fixo
      })
      .eq('id', pefAtualizado.id);

    if (error) {
      throw error; // Lança o erro se a atualização no banco falhar
    }

    // 2. Se o salvamento no banco for bem-sucedido, atualiza o estado local
    setTreinadores(treinadoresAtuais =>
      treinadoresAtuais.map((p: PEF) => (p.id === pefAtualizado.id ? pefAtualizado : p))
    );
    
    setPefEmEdicao(null); // Fecha o modal
    alert('Perfil atualizado com sucesso!');

  } catch (error) {
    console.error("Erro ao atualizar o perfil do PEF:", error);
    alert("Não foi possível salvar as alterações no perfil.");
  }
}, []);
const handleTogglePefStatus = useCallback(async (pefId: string, statusAtual: 'ativo' | 'inativo') => {
  // 1. Determina o novo status
  const novoStatus = statusAtual === 'ativo' ? 'inativo' : 'ativo';

  try {
    // 2. Envia a atualização para o banco de dados Supabase
    const { error } = await supabase
      .from('profiles')
      .update({ status: novoStatus }) // Atualiza a coluna 'status'
      .eq('id', pefId);              // Para o PEF com o ID correspondente

    if (error) {
      throw error; // Lança o erro se a atualização falhar
    }

    // 3. Se a atualização no banco for bem-sucedida, atualiza o estado local
    setTreinadores(treinadoresAtuais =>
      treinadoresAtuais.map((pef: PEF) => {
        if (pef.id === pefId) {
          return { ...pef, status: novoStatus };
        }
        return pef;
      })
    );

  } catch (error) {
    console.error("Erro ao alterar o status do PEF:", error);
    alert("Não foi possível alterar o status do profissional.");
  }
}, []);
const handleResetPassword = useCallback(async (pef: PEF) => {
  if (window.confirm(`Deseja enviar um link de recuperação de senha para o e-mail de '${pef.nome}'?`)) {
    try {
      const response = await fetch('/api/admin-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pef.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Falha ao enviar o link.');
      }

      alert(result.message);

} catch (error) { // Removido o tipo 'any'
  console.error("Erro ao resetar senha:", error);
  // Adicionamos a verificação de tipo para segurança
  if (error instanceof Error) {
    alert(`Erro: ${error.message}`);
  } else {
    alert(`Erro desconhecido ao resetar senha.`);
  }
}
  }
},[]);
const handlePefSubmit = useCallback(async (novoPef: NovoPefData): Promise<Record<string, string> | null> => {
  try {
    const response = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoPef),
    });

    const result: { message?: string; error?: string } = await response.json();

    if (!response.ok) {
      throw result; // Lança o corpo do erro (que pode ser { errors: [...] } ou { error: '...' })
    }

    alert(`Sucesso! ${result.message}`);
    setAddPefModalOpen(false);
    fetchAllPefs();
    return null; // Retorna null em caso de sucesso

  } catch (error) { // Removido o tipo 'any'
    console.error("Erro capturado para repassar ao modal:", error);
    
    // Verificamos se o erro tem a estrutura esperada da nossa API
    if (error && typeof error === 'object') {
      return error as Record<string, string>;
    }
    
    // Se não, retornamos um erro genérico
    return { general: "Ocorreu um erro inesperado." };
  }
}, [setAddPefModalOpen]);
const handleIniciarSessaoDeTreino = useCallback(
  async (alunoId: string, treinoId?: string) => {
    if (!alunoId) {
      alert("Aluno inválido.");
      return;
    }

    // TRAVA contra clique duplo / StrictMode
    if (iniciandoSessaoRef.current === alunoId) return;
    iniciandoSessaoRef.current = alunoId;

    try {
      // 1) Verifica se já existe sessão ativa no DB
      const { data: existente, error: errCheck } = await supabase
        .from('sessoes_ativas')
        .select('*')
        .eq('aluno_id', alunoId)
        .maybeSingle();

      if (errCheck) {
        console.error("Erro ao checar sessão ativa:", errCheck);
      }

if (existente) {
  // 1) Troca de view imediata (navegação otimista)
setViewState((prev: ViewState) => ({
  ...prev,
  type: 'workout',
  alunoId,
  treinoId: existente.treino_id ?? null,
}));

// monta uma sessão local mínima só para o cálculo do ritmo
const sessLocal: ActiveSession = {
  id: existente.id,
  alunoId,                                 // já está no escopo da função
  treinoId: existente.treino_id ?? null,
  startTime: existente.start_time ?? new Date().toISOString(),
  exercises: [],                            // deixa 0 finalizados; total virá do plano
  pef_responsavel_id: existente.pef_responsavel_id ?? null
};
refreshRitmos('start-session/existente', { [alunoId]: sessLocal });
void refetchActiveSessionsDedup();        // atualiza do DB em background
return;

}

      // 2) Não existe -> criar uma nova
        const payload = {
          aluno_id: alunoId,
          treino_id: treinoId ?? null,
          start_time: new Date().toISOString(),
          pef_responsavel_id: profile?.id ?? null, // se quiser gravar quem iniciou
          exercises: [],                            // opcional; default já é []
        };

      // upsert ajuda se existir índice único em aluno_id; se não existir, ainda estamos protegidos pela checagem acima
      const { data: inserida, error: errInsert } = await supabase
        .from('sessoes_ativas')
        .upsert(payload, { onConflict: 'aluno_id' })
        .select('*')
        .single();

      if (errInsert) {
        console.error("Erro ao iniciar sessão:", errInsert);
        alert("Não foi possível iniciar o treino.");
        return;
      }

      // 3) Recarrega do DB para manter estado ≡ DB (sem empurrar manualmente)
      // 3) Navegação otimista: troca a tela já
setViewState((prev: ViewState) => ({
  ...prev,
  type: 'workout',
  alunoId,
  treinoId: inserida.treino_id ?? treinoId ?? null,
}));

const sessLocal: ActiveSession = {
  id: inserida.id,
  alunoId: String(alunoId),
  treinoId: inserida.treino_id ?? treinoId ?? null,
  pef_responsavel_id: inserida.pef_responsavel_id ?? profile?.id ?? null,
  startTime: inserida.start_time ?? new Date().toISOString(),
  exercises: Array.isArray(inserida.exercises) ? inserida.exercises : [],
  totalPlanejados: getTotalExerciciosPlano(
    alunoId,
    inserida.treino_id ?? treinoId ?? null
  ) ?? undefined,
};

// Atualiza o mapa de ritmos sem depender do refetch
refreshRitmos('start-session/inserida', { [alunoId]: sessLocal });

// Atualiza as sessões do DB em background (não bloqueia a navegação)
void refetchActiveSessionsDedup();

return; // evita executar qualquer coisa depois daqui

      
    } finally {
      iniciandoSessaoRef.current = null;
    }
  },
  [refreshRitmos, profile, getTotalExerciciosPlano]);
const handleAssumirTreino = useCallback(async (sessionId: string) => {
  // Garante que temos o perfil do usuário logado
  if (!profile) return;

  try {
    // 1. Atualiza a linha correspondente na tabela sessoes_ativas do Supabase
    const { error } = await supabase
      .from('sessoes_ativas')
      .update({ pef_responsavel_id: profile.id }) // Define o novo PEF
      .eq('id', sessionId); // Para a sessão com o ID específico

    if (error) {
      throw error;
    }

    // 2. Atualiza o nosso estado local para refletir a mudança instantaneamente na UI
    setActiveSessions(currentSessions =>
      currentSessions.map(session =>
        session.id === sessionId
          ? { ...session, pef_responsavel_id: profile.id }
          : session
      )
    );

  } catch (error) {
    console.error("Erro ao assumir o treino:", error);
    alert("Não foi possível assumir o treino. Tente novamente.");
  }
}, [profile, setActiveSessions]); // Adicione setActiveSessions às dependências
const handleToggleTreinoStatus = useCallback(async (treinoId: string) => {
  // 1. Encontra o treino específico dentro do estado 'alunos'
  let treinoAtual;
  let alunoId: string | undefined;

  for (const aluno of masterAlunosList) {
    const treinoEncontrado = aluno.treino.find(t => t.id === treinoId);
    if (treinoEncontrado) {
      treinoAtual = treinoEncontrado;
      alunoId = aluno.id;
      break;
    }
  }

  if (!treinoAtual) {
    console.error("Treino não encontrado para alterar o status.");
    return;
  }

  // 2. Determina o novo status
  const novoStatus: 'ativo' | 'inativo' = treinoAtual.status === 'ativo' ? 'inativo' : 'ativo';

  try {
    // 3. Atualiza o status no Supabase
    const { error } = await supabase
      .from('treinos')
      .update({ status: novoStatus })
      .eq('id', treinoId);

    if (error) throw error;

    // 4. Atualiza o estado local para a UI refletir a mudança instantaneamente
    const novosAlunos = masterAlunosList.map(aluno => {
      if (aluno.id === alunoId) {
        return {
          ...aluno,
          treino: aluno.treino.map(t =>
            t.id === treinoId ? { ...t, status: novoStatus } : t
          ),
        };
      }
      return aluno;
    });
    setMasterAlunosList(novosAlunos);

  } catch (error) {
    console.error("Erro ao alterar o status do treino:", error);
    alert("Não foi possível alterar o status do treino.");
  }
}, [masterAlunosList]); // A função depende do estado 'alunos'
const handleToggleAlunoStatus = useCallback(async (alunoId: string, statusAtual: 'ativo' | 'inativo') => {
  
  
  
  const alunoParaAtualizar = masterAlunosList.find(a => a.id === alunoId);
    if (!alunoParaAtualizar) return; // Medida de segurança
  
  const novoStatus = statusAtual === 'ativo' ? 'inativo' : 'ativo';

  try {
    const response = await fetch('/api/alunos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...alunoParaAtualizar, matricula_status: novoStatus }),
    });

    if (!response.ok) {
      // Se a requisição falhar, lança um erro com a mensagem da API
      const errorData = await response.json();
      throw new Error(errorData.error || 'Falha ao atualizar o status do aluno.');
    }

    // Se a requisição for bem-sucedida, atualiza o estado local
    setMasterAlunosList(prevAlunos => 
      prevAlunos.map(aluno =>
        aluno.id === alunoId ? { ...aluno, matricula_status: novoStatus } : aluno
      )
    );

  } catch (error) {
  const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
  
  console.error("Erro ao alternar status do aluno:", errorMessage);
  
  // ADICIONADO: Exibe o alerta para o usuário
  alert(`🚫 Erro ao alterar status:\n\n${errorMessage}`);
  }
}, [masterAlunosList]);
  // 3. Adicione a lógica de proteção de rota
  useEffect(() => {
    // Espera a verificação da sessão terminar (loading === false)
    // E então verifica se NÃO HÁ um usuário logado.
    if (!loading && !user) {
      router.push('/login'); // Redireciona para a página de login
    }
  }, [user, loading, router]); // O efeito roda sempre que esses valores mudarem



  // 5. Garanta que a página só seja renderizada para usuários logados
  if (!user) {
    // Pode parecer redundante, mas garante que nada seja renderizado antes do redirecionamento do useEffect acontecer.
    return null;
  }  

  let pageContent;
  if (perfisCarregando || loading) {
    return <LoadingSpinner message="Carregando dados do GymPro..." />;
  }

  // 5. Garanta que a página só seja renderizada para usuários logados
  if (!user || !profile) {
    // O seu useEffect de redirecionamento já cuida disso.
    // Retornar null aqui mostra uma tela em branco enquanto redireciona.
    return null;
  } else {
  // Se não estiver carregando, então montamos o conteúdo normal da página
  switch (viewState.type) {
    case "gerenciar_treinos":
      pageContent  = activeAluno ? (
        <GerenciarTreinosPage
          aluno={activeAluno}
          activeSession={activeSessions.find(s => s.alunoId === activeAluno.id) || null}
          onExcluirTreino={(treinoId: string) => onExcluirTreino(activeAluno.id, treinoId)} // Garante que treinoId é string
          onIniciarTreino={(treinoId: string) => handleIniciarSessaoDeTreino(activeAluno.id, treinoId)}
          onEditarTreino={onEditarTreino} // onEditarTreino já espera string
          onEditarExercicio={(treinoId: string, exercicioId: string) => handleEditExercicio(treinoId, exercicioId)}
          onExcluirExercicio={handleExcluirExercicioDoGerenciamento}
          onCriarTreino={() => handleCriarNovoTreino(activeAluno)}
          onBack={handleBackToDashboard}
          onToggleTreinoStatus={handleToggleTreinoStatus}
        />
      ) : null;
      break;
    case "editar_treino":
      pageContent = activeAluno && treinoEmEdicao ? (
        <TreinoEditView
          aluno={activeAluno}
          treino={treinoEmEdicao}
          onTreinoChange={handleTreinoInputChange}
          onExercicioChange={handleExercicioInputChange}
          onExercicioSelect={handleExercicioSelect}
          onBack={() => setViewState({ type: 'gerenciar_treinos', alunoId: activeAluno.id })}
          onSave={handleSaveTreino}
          onAddExercicio={handleAddExercicio}
          onExcluirExercicio={(exercicioId) => {handleDeleteExercicio(treinoEmEdicao.id, exercicioId)}}
          validationErrors={validationErrors}
          setValidationErrors={setValidationErrors}
        />
      ) : null;
      break;
    case "workout":
      console.log("Dados enviados para LiveWorkoutView:", { exercicios: exerciciosDoTreino });
      pageContent =
        activeAluno && activeSession ? (
          <LiveWorkoutView
            session={activeSession!}
            aluno={activeAluno}
            timeInTraining={tempoDeTreino}
            ritmo={activeAluno ? ritmosByAluno[activeAluno.id] : 'no_ritmo'}
            onBack={handleBackToDashboard}
            onFinishWorkout={handleFinishWorkout}
            onUpdateExercise={(exercicioId, status) => handleUpdateExerciseStatus(activeAluno.id, exercicioId, status)}
            onEditarExercicio={handleEditExercicio}
            exerciciosDoTreino={exerciciosDoTreino}
            treinoAtivo={treinoAtivo}
            exerciciosParaRenderizar={exerciciosParaRenderizar}
            isWorkoutLoading={isWorkoutLoading}

          />
        ) : null;
      break;
    case "select_plan":
      pageContent = activeAluno ? (
        <SelectPlanView
          aluno={activeAluno}
          onSelectPlan={(event) => {
    const treinoId = event.currentTarget.value;
    handleIniciarSessaoDeTreino(activeAluno.id, treinoId);
    }}
          onCancel={handleBackToDashboard}
        />
      ) : null;
      break;
    case "dashboard":
    default:
          if (!profile) {
            return <div>Carregando perfil do usuário...</div>; // Ou um spinner
        }
          pageContent = (
            <div className="container">
            <div id="dashboard-view">
          <header>
                  <h1 className="title-app">GymPro</h1>
      
                  {/* Container para o menu e as informações do PEF */}
                  <div style={{ position: 'relative' }} ref={headerMenuRef}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                      <div id="pef-info">
                        <span>{profile.nome}</span> <br />
                        <small>
                          {profile.is_estagiario ? "Estagiário" : `CREF: ${profile.cref}`}
                        </small>
                      </div>
                      
                      {/* Botão de 3 pontos que abre o menu */}
                      <button className="options-icon" onClick={() => setHeaderMenuOpen(!isHeaderMenuOpen)}>
                        {optionsIcon}
                      </button>
                    </div>

                    {/* O menu dropdown, que só aparece se 'isHeaderMenuOpen' for true */}
                    {isHeaderMenuOpen && (
                      <div className="options-menu">
                      <button
                          className="menu-item"
                          onClick={() => {
                            setUploadModalOpen(true); // Abre o modal
                            setHeaderMenuOpen(false); // Fecha o menu
                          }}
                        >
                          {/* Opcional: Adicionar um ícone de upload aqui */}
                          Incluir Aluno via CSV
                      </button>
                     {profile.roles.includes('admin') && (
                  <>
                    <button
                      className="menu-item"
                      onClick={() => {
                        // Corrected: Pass a full ViewState object
                        setViewState({ type: "gerenciar_alunos", alunoId: null, treinoId: undefined });
                        setHeaderMenuOpen(false);
                      }}
                    >
                      Gerenciar Alunos
                    </button>
                    <button
                      className="menu-item"
                      onClick={() => {
                        setViewState({ type: 'gerenciar_perfis', alunoId: null });
                        setHeaderMenuOpen(false);
                      }}
                    >
                      Gerenciar Perfis
                    </button>
                  </>
                )}
                  <button
                    className="menu-item"
                    onClick={signOut} // Chama a função do nosso contexto
                    >
                    Sair
                  </button>
                  </div>
                )}
            </div>
          </header>
          <main>
          {/* TRAVA DE CARREGAMENTO ADICIONADA AQUI */}
          {perfisCarregando ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>Carregando dados...</div> // Ou um componente de Spinner
          ) : (
            <>
          <div className="controls">
            <div className="filters">
              <button
                className={`btn btn-sm filter-btn ${
                  statusFilter === "todos" ? "active" : ""
                }`}
                onClick={() => setStatusFilter("todos")}
              >
                Todos
              </button>
              <button
                className={`btn btn-sm filter-btn ${
                  statusFilter === "disponivel" ? "active" : ""
                }`}
                onClick={() => setStatusFilter("disponivel")}
              >
                Disponíveis
              </button>
              <button
                className={`btn btn-sm filter-btn ${
                  statusFilter === "em_treinamento" ? "active" : ""
                }`}
                onClick={() => setStatusFilter("em_treinamento")}
              >
                Em Treinamento
              </button>
              <button
                className={`btn btn-sm filter-btn ${
                  statusFilter === "meus_alunos" ? "active" : ""
                }`}
                onClick={() => setStatusFilter("meus_alunos")}
              >
                Meus Alunos
              </button>
            </div>
            <div className="search-wrapper">
              <input
                type="text"
                id="name-filter"
                placeholder="Filtrar por nome..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
              {nameFilter && (
                <button
                  className="clear-btn"
                  onClick={() => setNameFilter("")}
                >
                  &times;
                </button>
              )}
            </div>
          </div>
          <div id="aluno-list-container">
            <div className="aluno-list">
              {sortedDisplayedAlunos.length > 0 ? (
                sortedDisplayedAlunos.map(aluno => (
                  <AlunoCard
                    key={aluno.id}
                    aluno={aluno}
                    activeSessions={activeSessions}
                    timeInStatus={timeAgoToDisplay[aluno.id] || ''}
                    treinadores={treinadores}
                    profile={profile}
                    onAssumirTreino={handleAssumirTreino}
                    isMenuOpen={openAlunoMenuId === aluno.id} // <<< CONECTADO
                    onToggleMenu={() => setOpenAlunoMenuId(prevId => prevId === aluno.id ? null : aluno.id)} // <<< CONECTADO
                    onNavigateToWorkout={handleNavigateToWorkout}
                    onGerenciarTreinos={handleGerenciarTreinos}
                    onVerHistorico={handleVerHistorico} 
                    ritmo={ritmosByAluno[aluno.id]}
                  />
                ))
              ) : (
                  <div className="nenhum-aluno">Nenhum aluno encontrado.</div>
                )}
              </div>
            </div>
            </>
          )}
        </main>
        </div>
      </div>
    );
          break;
    case "gerenciar_perfis":
  pageContent = (
    <div className="container">
      {/* Usando o page-header padrão para telas secundárias */}
      <header className="page-header">
        <button onClick={handleBackToDashboard} className="back-button">
          {backIcon}
        </button>
        <div className="header-text-container">
          <h1 className="title-page">Gerenciar Perfis</h1>
          <h2 className="subtitle-page">Gerir Lista de Profissionais</h2>
        </div>
      </header>

<main>
  <div className="controls">
    <div className="filters">
      <button
        className={`btn btn-sm filter-btn ${pefFilter === 'todos' ? 'active' : ''}`}
        onClick={() => setPefFilter('todos')}
      >
        Todos
      </button>
      <button
        className={`btn btn-sm filter-btn ${pefFilter === 'ativo' ? 'active' : ''}`}
        onClick={() => setPefFilter('ativo')}
      >
        Ativos
      </button>
      <button
        className={`btn btn-sm filter-btn ${pefFilter === 'inativo' ? 'active' : ''}`}
        onClick={() => setPefFilter('inativo')}
      >
        Inativos
      </button>
    </div>
    <div className="search-wrapper">
      <input
        type="text"
        id="pef-name-filter"
        placeholder="Filtrar por nome..."
        value={pefSearch}
        onChange={(e) => setPefSearch(e.target.value)}
      />
      {pefSearch && (
        <button
          className="clear-btn"
          onClick={() => setPefSearch('')}
        >
          &times;
        </button>
      )}
    </div>
     <button 
       onClick={() => setAddPefModalOpen(true)} // <<< CONECTE A AÇÃO AQUI
       className="btn-primary-new"
      >
       + Adicionar Profissional
     </button>
  </div>

  <div id="pef-list-container">
    <div className="pef-list">
      {treinadores
        .sort((a, b) => {
        // Regra 1: Ordenar por status ('ativo' vem antes de 'inativo')
        if (a.status === 'ativo' && b.status === 'inativo') {
          return -1; // 'a' vem primeiro
        }
        if (a.status === 'inativo' && b.status === 'ativo') {
          return 1; // 'b' vem primeiro
        }

        // Regra 2: Se os status forem iguais, ordenar por nome (ordem alfabética)
        // localeCompare é o método ideal para comparar strings alfabeticamente
        return a.nome.localeCompare(b.nome);
        })
        .filter(pef => {
          if (pefFilter === 'todos') return true;
          return pef.status === pefFilter;
        })
        .filter(pef =>
          pef.nome.toLowerCase().includes(pefSearch.toLowerCase())
        )
        .map(pef => (
          <PefCard
            key={pef.id}
            pef={pef}
            onEdit={() => handleOpenEditPefModal(pef)}
            onToggleStatus={() => handleTogglePefStatus(pef.id, pef.status)}
            onResetPassword={() => handleResetPassword(pef)}
          />
        ))}
    </div>
  </div>
</main>
    </div>
  );
  break;
    case "gerenciar_alunos":
        pageContent = (
          <div className="container">
            <header className="page-header">
              <button onClick={handleBackToDashboard} className="back-button">
                {backIcon}
              </button>
              <div className="header-text-container">
                <h1 className="title-page">Gerenciar Alunos</h1>
                <h2 className="subtitle-page">Gerir Lista de Alunos</h2>
              </div>
            </header>
            <main>
              <div className="controls">
                <div className="filters">
                  <button className={`btn btn-sm filter-btn ${alunoFilter === 'todos' ? 'active' : ''}`} onClick={() => setAlunoFilter('todos')}>Todos</button>
                  <button className={`btn btn-sm filter-btn ${alunoFilter === 'ativo' ? 'active' : ''}`} onClick={() => setAlunoFilter('ativo')}>Ativos</button>
                  <button className={`btn btn-sm filter-btn ${alunoFilter === 'inativo' ? 'active' : ''}`} onClick={() => setAlunoFilter('inativo')}>Inativos</button>
                </div>
                <div className="search-wrapper">
                  <input type="text" id="aluno-name-filter" placeholder="Filtrar por nome..." value={alunoSearch} onChange={(e) => setAlunoSearch(e.target.value)} />
                  {alunoSearch && (<button className="clear-btn" onClick={() => setAlunoSearch('')}>&times;</button>)}
                </div>
                <button onClick={() => setAddAlunoModalOpen(true)} className="btn-primary-new">+ Adicionar Aluno</button>
              </div>
              <div id="aluno-list-container">
                <div className="aluno-list">
                {[...displayedAlunos] // <-- Lendo da variável correta, já filtrada
                  .sort((a, b) => { // A ordenação pode continuar aqui
                    if (a.matricula_status === 'ativo' && b.matricula_status === 'inativo') return -1;
                    if (a.matricula_status === 'inativo' && b.matricula_status === 'ativo') return 1;
                    return a.nome.localeCompare(b.nome);
                  })
                  .map(aluno => {
                    const isEmTreinamento = activeSessions.some(sessao => sessao.alunoId === aluno.id);
                    return (
                      <AlunoManagementCard 
                        key={aluno.id} 
                        aluno={aluno}
                        onEdit={() => handleOpenEditAlunoModal(aluno)} 
                        onToggleStatus={handleToggleAlunoStatus} 
                        isEmTreinamento={isEmTreinamento} // <-- Passando a prop calculada
                      />
                    );
                  })
                }
                </div>
              </div>
            </main>
          </div>
        );
        break;
    }}
    if (!profile) {
    return (
      <div>
        Usuário não autenticado. Por favor, entre em contato com o administrador do sistema.
      </div>
    );
  } //trava de segurança para o caso de não haver pef com login válido
    return (
      <>
        {pageContent}
        {exercicioEmEdicao && (
          <EditExerciseModal
            exercicio={exercicioEmEdicao} // Passamos apenas o objeto do exercício
            onClose={handleCloseEditModal}
            onSave={handleSaveExercicio}
          />
        )}
        {isGerenciarTreinoModalOpen && exercicioEmEdicao && (
          <EditExerciseModal
            exercicio={exercicioEmEdicao}
            onClose={() => {
              setGerenciarTreinoModalOpen(false);
              setExercicioEmEdicao(null);
            }}
            onSave={handleSaveExercicio}
          />
        )}
        {isUploadModalOpen && (
          <CsvUploadModal
            onClose={() => setUploadModalOpen(false)} 
            onImportSuccess={handleAlunosImported}
          />
        )}
        {alunoParaVerHistorico && historicoOpen && (
          <HistoricoModal
            aluno={alunoParaVerHistorico}
            rows={historicoRows}
            loading={historicoOpen.loading}
            onClose={handleCloseHistorico}
          />
        )}
        {pefEmEdicao && (
          <PefEditModal
            pef={pefEmEdicao}
            onClose={() => setPefEmEdicao(null)}
            onSave={handleUpdatePef}
          />
        )}
        {isAddPefModalOpen && (
          <PefAddModal
            onClose={() => setAddPefModalOpen(false)}
            onSave={handlePefSubmit}
          />
        )}
        {isAddAlunoModalOpen && (
          <AlunoAddModal
            onClose={() => setAddAlunoModalOpen(false)}
            onSave={handleAddAluno} // Aqui a função é passada para o modal
          />
        )}
        {alunoEmEdicao && (
          <AlunoEditModal
            aluno={alunoEmEdicao}
            onClose={() => setAlunoEmEdicao(null)}
            onSave={handleSaveEditAluno}
          />
        )}
      </>
    );
}
// =======================================================
// 5. SUB-COMPONENTES DE APRESENTAÇÃO
// =======================================================

function AlunoCard({
  aluno,
  ritmo,
  activeSessions,
  timeInStatus,
  treinadores,
  profile,
  isMenuOpen,
  onToggleMenu,
  onNavigateToWorkout,
  onGerenciarTreinos,
  onVerHistorico,
  onAssumirTreino,
}: {
  aluno: Aluno;
  ritmo: 'no_ritmo' | 'atrasado' | undefined;
  activeSessions: ActiveSession[];
  timeInStatus: string;
  treinadores: PEF[];
  profile: PEF;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onNavigateToWorkout: (alunoId: string) => void;
  onGerenciarTreinos: (alunoId: string) => void;
  onVerHistorico: (alunoId: string) => void;
  onAssumirTreino: (sessionId: string) => void;
}) {

  useEffect(() => {
    // A função que será chamada em qualquer clique na página
    function handleClickOutside(event: MouseEvent) {
      // Se o menu existe E o clique NÃO foi dentro dele...
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onToggleMenu(); // ...chama a função para fechar o menu.
      }
    }

    // Só adicionamos o "escutador" de cliques se o menu estiver aberto
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    // Função de limpeza: remove o "escutador" quando não for mais necessário
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen, onToggleMenu]); // Dependências do efeito

const sessaoAtiva = activeSessions.find(s => {
  // --- CÓDIGO DE DEPURAÇÃO ---
  if (aluno.nome === "Ana Júlia Ribeiro" || aluno.nome === "Clara Dias") {
    console.log(`--- Verificando para ${aluno.nome} ---`);
    console.log(`ID do Aluno no Card: ${aluno.id} (Tipo: ${typeof aluno.id})`);
    console.log(`ID do Aluno na Sessão: ${s.alunoId} (Tipo: ${typeof s.alunoId})`);
    console.log('------------------------------------');
  }
  // --- FIM DO CÓDIGO DE DEPURAÇÃO ---

  return s.alunoId === aluno.id; 
});
const menuRef = useRef<HTMLDivElement>(null);
const isEmTreinamento = !!sessaoAtiva;

/*  const statusExibicao = isEmTreinamento ? 'em_treinamento' : aluno.matricula_status; */
  
const pefDaSessao = isEmTreinamento ? treinadores.find(p => p.id === sessaoAtiva.pef_responsavel_id) : null;
  
const getPefFullNameById = (id: string | null | undefined) => {
  // Guarda de segurança: verifica se o id existe e se 'treinadores' é de fato um array
  if (!id || !Array.isArray(treinadores)) {
    return "N/A"; // Retorna um valor padrão seguro
  }
  const pef = treinadores.find(p => p.id === id); // A comparação agora funciona (string vs string)

  return pef
    ? `${pef.nome.split(" ")[0]} ${pef.nome.split(" ").slice(-1)[0]}`
    : "PEF não encontrado";
};
/*const statusMatriculaMap = {
  ativo: "Matrícula Ativa",
  inativo: "Matrícula Inativa",
  trancado: "Matrícula Trancada",
};*/
const statusSessaoTexto = "Em Treinamento";

const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
if (isEmTreinamento) {onNavigateToWorkout(aluno.id);
    }
  };

const renderActions = () => {
  if (isEmTreinamento) {
    // Se está em treinamento COM OUTRO PEF, mostra "Assumir Treino"
    if (sessaoAtiva && sessaoAtiva.pef_responsavel_id !== profile.id) {
      return (
        <button className="action-btn"
        onClick={() => onAssumirTreino(sessaoAtiva.id)}>
          Assumir Treino
        </button>
      );
    }
    // Se estiver em treinamento com o PEF atual, não mostra nada.
    return null;
  } else {
    // Se NÃO está em treinamento, está disponível. Mostra "Iniciar Treino".
    return (
      <button className="action-btn" onClick={() => onNavigateToWorkout(aluno.id)}>
        Iniciar Treino
      </button>
    );
  }
};



  return (
    <div
      className="info-card"
      onClick={handleCardClick}
      style={{cursor: isEmTreinamento ? "pointer" : "default"}}
    >
      {" "}
      <div className="card-header">
        {" "}
        <h3 className="title-card">{aluno.nome}</h3>{" "}
        <div className="card-options-wrapper" ref={menuRef}>
          <button
            className="options-icon"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu();
            }}
          >
            {optionsIcon}
          </button>
          {isMenuOpen && (
            <div className="options-menu">
              <button
                className="menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onGerenciarTreinos(aluno.id);
                  onToggleMenu();
                  }}
              >
                Gerenciar Sessões de Treino
              </button>
              <button
                className="menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onVerHistorico(aluno.id);
                  onToggleMenu();
                }}
              >
                Ver Histórico de Treinos
              </button>
            </div>
          )}
        </div>
      </div>{" "}
      <div className="card-body">
        <div className="status-line">
          {isEmTreinamento ? (
            <span className="status-tag status-tag-em-treinamento">
              {statusSessaoTexto}
            </span>
          ) : (
            <span className={`status-tag status-tag-disponivel`}>
              Disponível
            </span>
          )}
              <span className="status-timer">
              {isEmTreinamento && (
              <span className="status-timer">⏰ {timeInStatus}</span>
          )}</span>
          {isEmTreinamento && ritmo && (
            <div className={`ritmo-treino ritmo-${ritmo}`}>
              <span className="ritmo-dot"></span>
              {ritmo === 'atrasado' ? 'Atrasado' : 'No ritmo'}
            </div>
          )}
        </div>

        {isEmTreinamento && ( // <-- MUDANÇA: Lógica para exibir PEF agora usa pefDaSessao
          <div className="pef-resp">
            Com: <strong>{getPefFullNameById(pefDaSessao?.id)}</strong>
          </div>
        )}
      </div>
      <div className="actions">{renderActions()}</div>
    </div>
  );
}
function PefCard({
  pef,
  onEdit,
  onToggleStatus,
  onResetPassword,
}: {
  pef: PEF;
  onEdit: () => void;
  onToggleStatus: (pefId: string, statusAtual: 'ativo' | 'inativo') => void;
  onResetPassword: () => void;
}) {
  const isAtivo = pef.status === 'ativo';

  return (
    <div className="info-card">
      <div className="card-header">
        <h3 className="title-card">{pef.nome}</h3>

        {/* Adicionamos este wrapper para espelhar a estrutura do AlunoCard.
          Ele serve como o segundo item que o flexbox precisa para alinhar
          o título à esquerda corretamente.
        */}
        <div className="card-options-wrapper">
          {/* Futuramente, se o PefCard precisar de um menu, ele virá aqui. */}
        </div>
      </div>

      <div className="card-body">
        <div className="status-line">
          {/* Tag de Status: Ativo/Inativo */}
          <span className={`status-tag ${isAtivo ? 'status-tag-disponivel' : 'status-tag-inativo'}`}>
            {isAtivo ? 'Ativo' : 'Inativo'}
          </span>

          {/* Tag de Admin (se aplicável) */}
          {pef.roles.includes('admin') && (
            <span className="status-tag status-tag-admin">Admin</span>
          )}

          {/* Tag de Estagiário (se aplicável) */}
          {pef.is_estagiario && (
            <span className="status-tag status-tag-estagiario">Estagiário</span>
          )}
        </div>

        <div className="pef-details">
          <span>CREF: {pef.cref || 'N/A'}</span>
        </div>
      </div>

      <div className="actions">
        <button onClick={onEdit} className="btn btn-icon" title="Editar PEF">
          {editIcon} {/* <<< ÍCONE PADRÃO */}
        </button>
        <button onClick={() => onToggleStatus(pef.id, pef.status)}
                className="btn btn-icon"
                title={isAtivo ? 'Desativar PEF' : 'Ativar PEF'}
                >
                {isAtivo ? deactivateIcon : activateIcon} {/* <<< ÍCONES PADRÃO */}
        </button>
        <button onClick={onResetPassword} className="btn btn-icon" title="Resetar Senha">
          {resetIcon} {/* <<< ÍCONE NOVO/PADRÃO */}
        </button>
      </div>
    </div>
  );
}
function PefEditModal({
  pef,
  onClose,
  onSave,
}: {
  pef: PEF;
  onClose: () => void;
  onSave: (pefAtualizado: PEF) => void;
}) {
  const [dadosEditados, setDadosEditados] = useState(pef);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [crefTemporario, setCrefTemporario] = useState<string | null>(null);
  const handleChange = (campo: keyof PEF, valor: string | boolean) => {
    setDadosEditados(dadosAtuais => ({ ...dadosAtuais, [campo]: valor }));
  };
const validatePefData = (pefData: PEF): Record<string, string> => {
    const validationErrors: Record<string, string> = {};

    if (!pefData.cpf?.trim()) {
      validationErrors.cpf = "CPF é obrigatório.";
    }

    if (pefData.roles.includes('pef') && !pefData.is_estagiario && !pefData.cref?.trim()) {
      validationErrors.cref = "CREF é obrigatório para PEFs formados.";
    }

    return validationErrors;
  };
// Em app/page.tsx, dentro do componente PefAddModal

const handleSaveClick = () => {
  // 1. Roda a função de validação que já existe dentro do PefEditModal
  const validationErrors = validatePefData(dadosEditados);
  // 2. Atualiza o estado de erros para este modal
  setErrors(validationErrors);

  // 3. Se os dados forem válidos, chama a função onSave para salvar as edições
  if (Object.keys(validationErrors).length === 0) {
    onSave(dadosEditados);
  }
};
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>&times;</button>
        {/* 1. Usando o Header Unificado */}
        <div className="modal-header">
          <h2 className="title-modal">Editar Perfil</h2>
          <p className="subtitle-modal">{pef.nome}</p>
        </div>

        {/* 2. Usando o Body Unificado */}
        <div className="modal-body">
           <div className="input-group">
              <label htmlFor="pef-nome">Nome Completo</label>
              <input
                id="pef-nome"
                type="text"
                value={dadosEditados.nome}
                onChange={(e) => handleChange('nome', e.target.value)}
              />
           </div>
          <div className="input-group">
            <label htmlFor="pef-cpf">CPF</label>
            <input
              id="pef-cpf"
              type="text"
              value={dadosEditados.cpf || ''}
              onChange={(e) => handleChange('cpf', e.target.value)}
              placeholder="000.000.000-00"
              className={errors.cpf ? 'invalid' : ''} // Reutilização do padrão de erro
            />
            {errors.cpf && <span className="error-message">{errors.cpf}</span>}
          </div>
           <div className="input-group">
              <label htmlFor="pef-email">E-mail</label>
              <input
                id="pef-email"
                type="email"
                value={dadosEditados.email || ''} 
                disabled // O atributo 'disabled' torna o campo não editável
              />
            </div>
           <div className="input-group-checkbox">
            <input
              id="pef-estagiario"
              type="checkbox"
              checked={dadosEditados.is_estagiario}
              onChange={(e) => {
                const isChecked = e.target.checked;
                handleChange('is_estagiario', isChecked);
                // Se o PEF for marcado como estagiário, limpamos o campo CREF.
                if (isChecked) {
                  // Se marcou como estagiário, guardamos o CREF atual
                  // e limpamos o campo.
                  setCrefTemporario(dadosEditados.cref);
                  handleChange('cref', '');
                } else {
                  // Se desmarcou, restauramos o CREF que guardamos.
                  handleChange('cref', crefTemporario || '');
                }
              }}
            />
            <label htmlFor="pef-estagiario">Este profissional é um estagiário</label>
          </div>
          <div className="input-group">
            <label htmlFor="pef-cref">CREF</label>
            <input
              id="pef-cref"
              type="text"
              value={dadosEditados.cref || ''}
              onChange={(e) => handleChange('cref', e.target.value)}
              className={errors.cref ? 'invalid' : ''}
              disabled={dadosEditados.is_estagiario} // <<< LÓGICA CONDICIONAL
              placeholder={
                dadosEditados.is_estagiario 
                  ? 'Não aplicável para estagiários' 
                  : 'Ex: 012345-G/RJ'
              } // <<< UX MELHORADO
            />
            {errors.cref && <span className="error-message">{errors.cref}</span>}
          </div>
          {/* Futuros campos irão aqui dentro do modal-body */}
        </div>

        {/* 3. Usando as Actions Unificadas */}
        <div className="modal-actions">
          {/* Opcional: Adicionar um espaço para futuros erros de API */}
          <div className="button-group">
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSaveClick}>Salvar</button>
          </div>
        </div>

      </div>
    </div>
  );
}
function SelectPlanView({
  aluno,
  onSelectPlan,
  onCancel,
}: {
  aluno: Aluno;
  onSelectPlan: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onCancel: () => void;
}) {
  const treinosAtivos = aluno.treino.filter((p) => p.status === 'ativo');
return (
  <div className="modal-overlay" onClick={onCancel}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>

      {/* Adicionando o botão de fechar padrão */}
      <button className="modal-close-btn" onClick={onCancel}>&times;</button>

      <div className="modal-header">
        <h2 className="title-modal">Iniciar Treino</h2>
        <p className="subtitle-modal">{aluno.nome}</p>
      </div>

      <div className="modal-body">
        {/* Adicionamos um parágrafo de instrução com o texto revisado */}
        <p className="modal-intro">
          Selecione o treino para a sessão de hoje:
        </p>

        <div className="plan-selection-list">
          {treinosAtivos.map((treino) => (
            <button key={treino.id} value={treino.id} onClick={onSelectPlan}>
              {treino.nome}
            </button>
          ))}
          {treinosAtivos.length === 0 && (
            <p className="nenhum-treino" style={{textAlign: 'center'}}>Nenhum treino ativo encontrado.</p>
          )}
        </div>
      </div>

      {/* Este modal não precisa de um rodapé .modal-actions, então o omitimos. */}

    </div>
  </div>
);
}
function LiveWorkoutView({
  session,
  aluno,
  ritmo,
  treinoAtivo,
  onBack,
  timeInTraining,
  exerciciosDoTreino,
  onFinishWorkout,
  onUpdateExercise,
  onEditarExercicio,
  exerciciosParaRenderizar,
  isWorkoutLoading,
}: {
  session: ActiveSession;
  aluno: Aluno;
  ritmo: 'no_ritmo' | 'atrasado';
  treinoAtivo: Treino | null; 
  onBack: () => void;
  onFinishWorkout: () => void;
  timeInTraining: string;
  exerciciosDoTreino: ExercicioDeSessao[];
  onUpdateExercise: (
    exercicioId: string,
    status: LiveExercise["status"]
  ) => void;
  onEditarExercicio: (treinoId: string, exercicioId: string) => void;
  exerciciosParaRenderizar: ExercicioComStatus[];
  isWorkoutLoading: boolean;
}) {

    if (isWorkoutLoading) {
return <LoadingSpinner message="Carregando detalhes do treino..." />;
  }
  
  // Contadores/percentual do header
  const totalExercicios = exerciciosDoTreino.length;
  const finishedCount = session.exercises.filter((ex) => ex.status === "finalizado").length;
  const percentage = totalExercicios > 0 ? ((finishedCount / totalExercicios) * 100).toFixed(0) : "0";

  // --- NOVO: combinamos "detalhes" (exerciciosDoTreino) com "status" (session.exercises)


  // Você já recebe 'ritmo' por props; se preferir o aluno.ritmo, troque aqui.
  const rhythmStatus = ritmo || "no_ritmo";
console.log("LISTA FINAL PARA RENDERIZAÇÃO:", exerciciosParaRenderizar);
  return (
    <>
    <div className="container workout-view">
      <header className="page-header">
        <div className="header-left">
          <button onClick={onBack} className="back-button">
            {backIcon}
          </button>
        </div>

        <div className="header-text-container">
          <h1 className="title-page">{aluno.nome}</h1>
          <h2 className="subtitle-page">{treinoAtivo?.nome}</h2>
        </div>
      </header>

      <main className="workout-session-details">
        <div className="header-row-2">
          <div className="time-info-group">
            <span className="label">Início:</span>
            <span className="value">
              {new Date(session.startTime).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="time-info-group">
            <span className="label">Tempo de treino:</span>
            <span className="value">{timeInTraining.replace("há ", "")}</span>
          </div>
        </div>

        <div className="header-row-3">
          <span className="progress-label">
            {finishedCount}/{totalExercicios}
          </span>
          <div className="progress-bar-container">
            <div
              className={`progress-bar-fill ritmo-${rhythmStatus}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className={`progress-label ritmo-treino ritmo-${rhythmStatus}`}>
            <span className="ritmo-dot"></span> {rhythmStatus.replace("_", " ")}
          </span>
        </div>
      </main>

      {/* --- NOVO: iteração passa a usar 'exerciciosParaRenderizar' --- */}
      <div className="exercise-list">
        {exerciciosParaRenderizar.map((exercicio) => {
          const detailsParts: React.ReactNode[] = [];
          if (exercicio.series) detailsParts.push(<span key="series"><strong>Séries:</strong> {exercicio.series}</span>);
          if (exercicio.repeticoes) detailsParts.push(<span key="reps"><strong>Reps:</strong> {exercicio.repeticoes}</span>);
          if (exercicio.carga) detailsParts.push(<span key="carga"><strong>Carga:</strong> {exercicio.carga}</span>);
          if (exercicio.observacoes) detailsParts.push(<span key="obs"><strong>Obs:</strong> {exercicio.observacoes}</span>);

          return (
            <div
              key={exercicio.exercicio_id}
              className={`exercise-item status-${exercicio.status.replace("_", "-")}`}
            >
              <div className="exercise-header">
                <h4>{exercicio.nome}</h4>
                <div className="icons">
                  <button
                    className="btn btn-icon"
                    title="Editar"
                    onClick={() => onEditarExercicio(treinoAtivo!.id, exercicio.id)}
                  >
                    {editIcon}
                  </button>
                  {/* O botão de excluir foi removido desta tela
                  <button
                    className="btn btn-icon btn-delete"
                    title="Excluir"
                    onClick={() => onExcluirExercicio(exercicio.exercicio_id)}
                  >
                    {deleteIcon}
                  </button>
                    */}
                </div>
              </div>

              <div className="exercise-details">
                {detailsParts.map((part, index) => (
                  <React.Fragment key={index}>
                    {part}{index < detailsParts.length - 1 && "; "}
                  </React.Fragment>
                ))}
              </div>

              <div className="exercise-controls">
                {exercicio.status === "nao-iniciado" && (
                  <button
                    className="btn-exercise-status start"
                    onClick={() => onUpdateExercise(exercicio.exercicio_id, "executando")}
                  >
                    Iniciar
                  </button>
                )}
                {exercicio.status === "executando" && (
                  <button
                    className="btn-exercise-status finish"
                    onClick={() => onUpdateExercise(exercicio.exercicio_id, "finalizado")}
                  >
                    Finalizar
                  </button>
                )}
                {exercicio.status === "finalizado" && (
                  <div className="exercise-details-finalizado">Finalizado</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="workout-actions">
        <button className="action-btn btn-finalizar-treino" onClick={onFinishWorkout}>
          Finalizar Treino
        </button>
      </div>
    </div>
    </>
  );
}
function ExerciseDetailsTable({ exercise }: { exercise: TreinoExercicio }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolledToEnd, setIsScrolledToEnd] = useState(false);
  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const isAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    if (isAtEnd !== isScrolledToEnd) {
      setIsScrolledToEnd(isAtEnd);
    }
  };
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      const hasScroll = el.scrollWidth > el.clientWidth;
      if (!hasScroll) {
        setIsScrolledToEnd(true);
      } else if (el.scrollLeft === 0) {
        setIsScrolledToEnd(false);
      }
    }
  }, [exercise]);
  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className={`exercise-details-table-wrapper ${
        isScrolledToEnd ? "scrolled-to-end" : ""
      }`}
    >
      <table>
        <thead>
          <tr>
            <th>Séries</th>
            <th>Reps</th>
            <th>Carga</th>
            <th>Observação</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{exercise.series}</td>
            <td>{exercise.repeticoes}</td>
            <td>{exercise.carga || "-"}</td>
            <td>{exercise.observacoes || "-"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
function GerenciarTreinosPage({
  aluno,
  activeSession,
  onBack,
  onIniciarTreino,
  onEditarTreino,
  onEditarExercicio,
  onCriarTreino,
  onExcluirTreino,
  onExcluirExercicio,
  onToggleTreinoStatus,
}: {
  aluno: Aluno;
  activeSession: ActiveSession | null | undefined;
  onBack: () => void;
  onIniciarTreino: (treinoId: string) => void;
  onEditarTreino: (treinoId: string) => void;
  onEditarExercicio: (treinoId: string, exercicioId: string) => void;
  onCriarTreino: () => void;
  onExcluirTreino: (treinoId: string) => void;
  onExcluirExercicio: (treinoId: string, exercicioId: string) => void;
  onToggleTreinoStatus: (treinoId: string) => void;
}) {
  const [filtroAtivo, setFiltroAtivo] = useState(true);
  const [expandedItems, setExpandedItems] = useState<{ [key: string]: boolean }>({});

  const toggleExpansion = (id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const treinosFiltrados = aluno.treino.filter((p) => p.status === (filtroAtivo ? 'ativo' : 'inativo'));

  return (
    <div className="container manage-plans-page">
      <header className="page-header">
        <button onClick={onBack} className="back-button">
          {/* Substitua backIcon pelo seu SVG real se estiver definido fora */}
          <svg fill="currentColor" viewBox="0 0 24 24"><path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z" /></svg>
        </button>
        <div className="header-text-container">
          <h1 className="title-page">{aluno.nome}</h1>
          <h2 className="subtitle-page">Gerenciar Sessões de Treino</h2>
        </div>
      </header>
      <main>
        <div className="manage-plans-controls">
          <div className="filter-toggle-group">
            <button onClick={() => setFiltroAtivo(true)} className={filtroAtivo ? "active" : ""}>
              Treinos Ativos
            </button>
            <button onClick={() => setFiltroAtivo(false)} className={!filtroAtivo ? "active" : ""}>
              Treinos Inativos
            </button>
          </div>
        </div>

        <div className="management-plan-list">
          {treinosFiltrados.map((treino) => {
            const exercicios = treino.exercicios || [];
            let planStatus = "inativo";
            if (treino.status === 'ativo') {
              if (activeSession) {
                planStatus = activeSession.treinoId === treino.id ? "em-treinamento" : "indisponivel";
              } else {
                planStatus = "disponivel";
              }
            }
            return (
              <div key={treino.id} className={`management-plan-accordion plan-status-${planStatus}`}>
                <button className="accordion-header-manage" onClick={() => toggleExpansion(`treino-${treino.id}`)}>
                  <div className="accordion-title-group">
                    <span>{treinoIcon}</span>
                    <h3>{treino.nome}</h3>
                  </div>
                  <span className={`chevron ${expandedItems[`treino-${treino.id}`] ? "expanded" : ""}`}>
                    {/* Substitua chevronIcon pelo seu SVG real */}
                    <svg fill="currentColor" viewBox="0 0 24 24"><path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" /></svg>
                  </span>
                </button>
                <div className="plan-meta-actions">
                  <span>{exercicios.length} {exercicios.length === 1 ? "exercício" : "exercícios"}</span>
                </div>
                <div className="card-action-icons">
                  {planStatus === "em-treinamento" ? (
                    <span className="status-tag status-tag-em-treinamento">Em Treinamento</span>
                  ) : (
                    (planStatus === "disponivel" || planStatus === "indisponivel") && (
                      <button
                        onClick={() => onIniciarTreino(treino.id)}
                        className="btn-start"
                        disabled={planStatus === "indisponivel"}
                        title={ planStatus === "indisponivel" ? "Finalize o treino em andamento para iniciar um novo" : "Iniciar Treino" }
                      >
                        Iniciar Treino
                      </button>
                    )
                  )}
                  <button onClick={(e) => { e.stopPropagation(); onEditarTreino(treino.id); }} className="btn btn-icon" title="Editar Treino">
                    {editIcon}
                  </button>

                  {/* Botão de Ativar/Desativar */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleTreinoStatus(treino.id);
                    }}
                    className="btn btn-icon"
                    title={treino.status === 'ativo' ? "Desativar Treino" : "Ativar Treino"}
                  >
                    {treino.status === 'ativo' ? deactivateIcon : activateIcon}
                  </button>

                  <button onClick={(e) => { e.stopPropagation(); onExcluirTreino(treino.id); }} className="btn btn-icon btn-delete" title="Excluir Treino">
                    {deleteIcon}
                  </button>
                </div>
                <div className={`accordion-content-manage${expandedItems[`treino-${treino.id}`] ? " expanded" : ""}`}>
                  {expandedItems[`treino-${treino.id}`] && (
                    <>
                      {treino.exercicios.map((ex, index) => {
                        const nomeExercicio = ex.exercicio?.nome || "Exercício";
                        const tempId = `ex-${treino.id}-${ex.id}`;

                        const exercicioParaCard: ExercicioParaFormulario = {
                          tempId: tempId,
                          exercicio_id: ex.exercicio_id,
                          nome: nomeExercicio,
                          series: ex.series,
                          repeticoes: ex.repeticoes,
                          carga: ex.carga,
                          observacoes: ex.observacoes || "",
                          isEditing: false,
                        };

                        return (
                          <ExercicioCard
                            key={tempId}
                            index={index}
                            exercicio={exercicioParaCard}
                            onEdit={() => onEditarExercicio(treino.id, ex.id)}
                            onDelete={() => onExcluirExercicio(treino.id, ex.id)}
                            isExpanded={!!expandedItems[tempId]}
                            onToggleExpansion={() => toggleExpansion(tempId)}
                            showActions={true}
                            suggestions={[]}
                            isSearchActive={false}
                            onSearchChange={() => { }}
                          />
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      <button onClick={onCriarTreino} className="fab-create-plan" title="Criar Nova Sessão de Treino">
        {addIcon}
      </button>
    </div>
  );
}
function ExercicioCard({
  index,
  exercicio,
  isExpanded,
  showActions,
  isEditable = false,
  validationErrors,
  suggestions,
  isSearchActive,
  onToggleExpansion,
  onEdit,
  onDelete,
  onExercicioChange = () => {},
  onSuggestionSelect,
  onSearchChange,
}: ExercicioCardProps) { 
  const errorKey = `exercicios[${index}].nome`;

console.log(errorKey, validationErrors)

  const handleSuggestionClick = (suggestion: Exercicio) => {

if (onSuggestionSelect) {
    onSuggestionSelect(suggestion); 
  }
};
  const SuggestionRow = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div
      style={style}
      className="suggestion-item"
      onMouseDown={() => handleSuggestionClick(suggestions[index])}
    >
      {suggestions[index].nome}
    </div>
  );
  if (isEditable) {
    return (
      <div className="exercise-edit-card">
        <button
          className="exercise-card-delete-btn"
          onClick={onDelete}
          title="Remover Exercício"
        >
          {deleteIcon}
        </button>
<div className="card-section">
  <div className="input-group" data-error="exercicioNome">
    <label>Nome do Exercício</label>
    <div className="autocomplete-wrapper">
      <input
      value={exercicio.nome}
      onChange={onSearchChange} // <<< USA A NOVA PROP
      placeholder="Busque um exercício (ex: Supino)"
      className={validationErrors?.[errorKey] ? "invalid" : ""}
      autoComplete="off"
    />
    {validationErrors?.[errorKey] && (
      <span className="error-message">{validationErrors[errorKey]}</span>
    )}
{/* CONDIÇÃO AJUSTADA: Só mostra o container se a busca estiver ativa E se NÃO houver erro de validação para este campo */}
{isSearchActive && !validationErrors?.[errorKey] && (
  <div className="suggestions-container">
    {suggestions.length > 0 ? (
      <List
        height={Math.min(200, suggestions.length * 36)}
        itemCount={suggestions.length}
        itemSize={36}
        width="100%"
      >
        {SuggestionRow}
      </List>
    ) : (
    // Adicionamos a verificação de "trim" para não mostrar a mensagem com o campo vazio
      exercicio.nome.trim().length > 1 && (
      <div className="no-results-placeholder">Nenhum exercício encontrado</div>
      )
    )}
  </div>
)}
    </div>
            {validationErrors?.nome && ( // Mensagem de erro
      <span className="error-message">{validationErrors.nome}</span>
    )}
          </div>
        </div>
        <div className="card-section">
          <div className="exercise-inputs">
            <div className="input-row">
              <div className="input-group">
                <label>Séries</label>
                <input
                  className={validationErrors?.series ? "invalid" : ""}
                  type="text"
                  value={exercicio.series}
                  onChange={(e) => onExercicioChange("series", e.target.value)}
                />
                  {validationErrors?.series && (
                  <span className="error-message">{validationErrors.series}</span>
                  )}
              </div>
              <div className="input-group">
                <label>Reps</label>
                <input
                  className={validationErrors?.repeticoes ? "invalid" : ""}
                  type="text"
                  value={exercicio.repeticoes}
                  onChange={(e) => onExercicioChange("repeticoes", e.target.value)}
                />
                  {validationErrors?.repeticoes && (
                  <span className="error-message">{validationErrors.repeticoes}</span>
                   )}
              </div>
              <div className="input-group">
                <label>Carga</label>
                <input
                  type="text"
                  value={exercicio.carga}
                  onChange={(e) => onExercicioChange("carga", e.target.value)}
                />
              </div>
            </div>
            <div className="input-group">
              <label>Observação</label>
              <textarea
                rows={2}
                value={exercicio.observacoes || ""}
                onChange={(e) => onExercicioChange("observacoes", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Modo visual
  return (
    <div className="exercise-edit-card">
      <div
        className="exercise-card-header"
        onClick={onToggleExpansion}
        style={{ cursor: "pointer" }}
      >
        <div className="accordion-title-group">
          <h4>{exercicio.nome}</h4>
        </div>
        <div className="card-action-icons">
          {showActions && (
            <>
              <button
                className="btn btn-icon"
                title="Editar Exercício"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onEdit) onEdit();
                }}
              >
                {editIcon}
              </button>
              <button
                className="btn btn-icon btn-delete"
                title="Excluir Exercício"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onDelete) onDelete();
                }}
              >
                {deleteIcon}
              </button>
            </>
          )}
          <button
            className={`chevron ${isExpanded ? "expanded" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleExpansion) onToggleExpansion();
            }}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Recolher detalhes" : "Expandir detalhes"}
          >
            {chevronIcon}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="exercise-card-body">
          <ExerciseDetailsTable 
            exercise={{
              // Mapeamos as propriedades do tipo 'ExercicioParaFormulario'
              // para o tipo 'TreinoExercicio' que o componente filho espera.
              id: exercicio.tempId || '', // Usamos o tempId como 'id' ou um valor padrão
              treino_id: '', // Não temos essa informação aqui, então passamos um valor padrão
              exercicio_id: exercicio.exercicio_id,
              series: exercicio.series,
              repeticoes: exercicio.repeticoes,
              carga: exercicio.carga,
              observacoes: exercicio.observacoes,
            }} 
          />
        </div>
      )}
    </div>
  );
}
function EditExerciseModal<T extends ExercicioEditavel>({
  exercicio,
  onClose,
  onSave,
}: EditExerciseModalProps<T>) {
  // 1. Estado interno para guardar as MUDANÇAS feitas pelo usuário.
  const [editedExercicio, setEditedExercicio] = useState(exercicio);
  const [errors, setErrors] = useState<ExercicioError>({});
    // Buscamos as informações do exercício na biblioteca para usar no cabeçalho.
  // Para exibir o nome do exercício no modal, você pode simplesmente usar:
  // <h2>{editedExercicio?.nome}</h2>
  // 2. Handler para atualizar o estado interno quando o usuário digita.
  const handleInputChange = (campo: keyof TreinoExercicio, valor: string) => {
    if (!editedExercicio) return;

    if (errors[campo as keyof ExercicioError]) {
        const newErrors = { ...errors };
        delete newErrors[campo as keyof ExercicioError];
        setErrors(newErrors);
    }
    setEditedExercicio({ ...editedExercicio, [campo]: valor });
  };
const handleSaveClick = () => {
  if (!editedExercicio) return;

  // --- VALIDAÇÃO ADICIONADA ---
  // Verificamos se os campos obrigatórios estão vazios ou contêm apenas espaços
  if (String(editedExercicio.series).trim() === '' || String(editedExercicio.repeticoes).trim() === '') {
    alert('Os campos "Séries" e "Repetições" são obrigatórios e não podem estar vazios.');
    return; // Impede a função de continuar e salvar
  }
  // --- FIM DA VALIDAÇÃO ---

  // O resto da função continua como antes
  onSave(editedExercicio);
};
  // 3. Verificação de segurança, como já tínhamos.
  if (!editedExercicio) {
    return null;
  }

return (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <button className="modal-close-btn" onClick={onClose}>&times;</button>
      <div className="modal-header">
        <h2 className="title-modal">Editar Exercício</h2>
        <p className="subtitle-modal">{editedExercicio?.nome}</p>
      </div>

      <div className="modal-body">
            <div className="exercise-inputs">
              <div className="input-row">
                {/* Inputs agora são 'controlados' pelo estado INTERNO 'editedExercicio' */}
                <div className="input-group">
                  <label htmlFor="edit-series">Séries</label>
                  <input
                    type="text"
                    id="edit-series"
                    value={editedExercicio.series}
                    onChange={(e) => handleInputChange("series", e.target.value)}
                    className={errors.series ? "invalid" : ""}
                  />
                  {errors.series && <span className="error-message">{errors.series}</span>}
                </div>
                <div className="input-group">
                  <label htmlFor="edit-reps">Reps</label>
                  <input
                    type="text"
                    id="edit-reps"
                    value={editedExercicio.repeticoes}
                    onChange={(e) => handleInputChange("repeticoes", e.target.value)}
                    className={errors.repeticoes ? "invalid" : ""}
                   />
                  {errors.repeticoes && <span className="error-message">{errors.repeticoes}</span>}
                </div>
                <div className="input-group">
                  <label htmlFor="edit-carga">Carga</label>
                  <input
                    type="text"
                    id="edit-carga"
                    value={editedExercicio.carga}
                    onChange={(e) => handleInputChange("carga", e.target.value)}
                  />
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="edit-obs">Observação</label>
                <textarea
                  id="edit-obs"
                  rows={2}
                  value={editedExercicio.observacoes || ""}
                  onChange={(e) =>
                    handleInputChange("observacoes", e.target.value)
                  }
                />
              </div>
            </div>
          </div>

      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSaveClick}
        >
          Salvar
        </button>
      </div>

    </div>
  </div>
);
}
function TreinoEditView({
  aluno,
  treino,
  onBack,
  onSave,
  onTreinoChange,
  onExercicioChange,
  onAddExercicio,
  onExcluirExercicio,
  onExercicioSelect,
  validationErrors,
  setValidationErrors,
}: TreinoEditViewProps) {

    const pageTitle = treino.nome ? "Editar Sessão de Treino" : "Criar Nova Sessão de Treino";

  // 3. ESTADO LOCAL PARA CONTROLAR OS CARDS EXPANDIDOS
  const [expandedItems, setExpandedItems] = useState<{
    [key: string]: boolean;
  }>({});

  const [activeSuggestionBoxIndex, setActiveSuggestionBoxIndex] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Exercicio[]>([]);
  const exerciseInputRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exerciseInputRef.current && !exerciseInputRef.current.contains(event.target as Node)) {
        setActiveSuggestionBoxIndex(null); // Fecha a caixa de sugestões
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [exerciseInputRef]);

  const toggleExpansion = (id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  if (!treino) {
    return <div>Carregando treino...</div>;
  }
  return (
    <div className="container treino-edit-page">
      <header className="page-header">
        <button onClick={onBack} className="back-button">
          {backIcon}
        </button>
        <div className="header-text-container">
          <h1 className="title-page">{aluno.nome}</h1>
          <h2 className="subtitle-page">{pageTitle}</h2>
        </div>
      </header>
      <main>
        {/* Input para o nome do treino */}
<div className="input-group" data-error="treinoNome">
  <label htmlFor="treino-nome">Nome do Treino</label>
  <input
    type="text"
    id="treino-nome"
    value={treino.nome}
    className={validationErrors.treinoNome ? "invalid" : ""}
    onChange={(e) => {
      if (validationErrors.treinoNome) {
        setValidationErrors(prev => ({ ...prev, treinoNome: '' }));
      }
      onTreinoChange("nome", e.target.value);
    }}
    placeholder='Ex: Treino A - Peito e Tríceps'
  />
  {validationErrors.treinoNome && (
    <span className="error-message">{validationErrors.treinoNome}</span>
  )}
</div>

        <h3 className="exercise-list-title">Exercícios do Treino</h3>

        <div className="exercise-edit-list">
  {treino.exercicios.map((ex, index) => (
    <div key={ex.tempId || `temp-add-${index}`}>
            <ExercicioCard
              index={index}
              exercicio={ex}
              isEditable={true}
              validationErrors={validationErrors}
              suggestions={activeSuggestionBoxIndex === index ? suggestions : []}
              isSearchActive={activeSuggestionBoxIndex === index}
              onSearchChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                  const value = e.target.value;
                  // 1. Atualiza o valor do input no estado principal
                  onExercicioChange(index, 'nome', value);
                  // 2. Define este card como o ativo para o autocomplete
                  setActiveSuggestionBoxIndex(index);
                  // 3. Busca as sugestões
                  const results = await searchExercicios(value);
                  setSuggestions(results);
                }}
              onSuggestionSelect={(suggestion) => {
                  onExercicioSelect(index, suggestion);
                  // Fecha a caixa de sugestões após a seleção
                  setActiveSuggestionBoxIndex(null);
                }}
              onExercicioChange={(campo, valor) => onExercicioChange(index, campo, valor)}
              onDelete={() => onExcluirExercicio(ex.exercicio_id)}
              isExpanded={!!expandedItems[`ex-${ex.exercicio_id}`]}
              onToggleExpansion={() => toggleExpansion(`ex-${ex.exercicio_id}`)}
              showActions={!ex.isEditing} // Mostra ações (editar/deletar do modo visualização) apenas se NÃO estiver em modo de edição
              onEdit={() => alert("Funcionalidade de editar um exercício existente a ser implementada")}
            />
            </div>
          ))}
        </div>
        <div className="actions-container">
          <button onClick={onAddExercicio} className="card-text-action">
            + Incluir Exercício
          </button>
        </div>
      </main>

 <footer className="form-actions">
<button className="btn btn-save-plan" onClick={() => onSave(treino)}>
  Salvar treino
</button>
</footer>
    </div>
  );
}
function CsvUploadModal({
  onClose,
  onImportSuccess
}: {
  onClose: () => void;
  onImportSuccess: (novosAlunos: Aluno[]) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleUploadButtonClick = () => {
    fileInputRef.current?.click();
  };

const handleStartImport = () => {
  if (!selectedFile) return;

  Papa.parse(selectedFile, {
    header: true,
    skipEmptyLines: true,
    delimiter: ";",
    transformHeader: header => header.trim(),
    complete: (results: Papa.ParseResult<CsvRow>) => {
      // Validação: Garante que as colunas Nome e CPF existem no arquivo
      if (!results.meta.fields || !results.meta.fields.includes("Nome") || !results.meta.fields.includes("CPF")) {
        alert("Erro: O arquivo deve conter as colunas 'Nome' e 'CPF' preenchidas");
        return;
      }

      const novosAlunos: Aluno[] = results.data
        .filter((row): row is { Nome: string; CPF: string } => 
          !!row.Nome?.trim() && !!row.CPF?.trim() // Ignora linhas sem nome ou sem CPF
        )
        .map((row, index) => ({
          id: String(Date.now() + index),
          nome: row.Nome.trim(),
          cpf: row.CPF.trim(), // <<< PROCESSA O NOVO CAMPO CPF
          matricula_status: "ativo",
          matricula_status_timestamp: new Date().toISOString(),
          treino: [],
          ritmo: undefined,
          historico: [],
          observacao: '',
        }));

      onImportSuccess(novosAlunos);
    },
    error: (error) => {
      console.error("Erro no CSV:", error);
      alert("Formato inválido. Baixe o modelo e tente novamente.");
    }
  });
};

return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>

        {/* Adicionando o botão de fechar padrão */}
        <button className="modal-close-btn" onClick={onClose}>&times;</button>

        <div className="modal-header">
          <h2 className="title-modal">Incluir Alunos via CSV</h2>
        </div>

        <div className="modal-body">
          <p className="modal-intro">
            Selecione um arquivo .csv com uma coluna chamada <code>Nome</code>.
            <br />
            <a href="/template_insert_aluno.csv" download="template_importacao_alunos.csv" style={{ color: 'var(--primary-action-color)', fontWeight: '600' }}>
              Baixe um modelo de arquivo aqui.
            </a>
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-lg) 0' }}>
            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
            <button className="btn btn-secondary" onClick={handleUploadButtonClick}>Escolher arquivo</button>
            <span>{selectedFile ? selectedFile.name : "Nenhum arquivo selecionado"}</span>
          </div>
        </div>

        <div className="modal-actions">
          {/* O botão agora está dentro do rodapé padrão, alinhado à direita */}
          <button className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={!selectedFile} onClick={handleStartImport}>
            Iniciar Importação
          </button>
        </div>

      </div>
    </div>
  );
}
function HistoricoModal({ 
  aluno,
  rows,
  loading = false,
  onClose,
}: {
  aluno: Aluno | null;
  rows: HistoricoRow[];
  loading?: boolean;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content historico-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>&times;</button>

        <div className="modal-header">
          <h2 className="title-modal">Histórico de Treinos</h2>
          <p className="subtitle-modal">{aluno?.nome ?? ''}</p>
        </div>
        <div className="modal-body">
          {loading ? (
            // Se estiver carregando, usamos a classe 'historico-loading' para
            // centralizar um spinner simples, sem usar o componente de tela cheia.
            <div className="historico-loading">
              {spinnerIcon}
              <p>Carregando histórico...</p>
            </div>
          ) : (
            // Se não estiver carregando, mostra a lista de resultados
            <ul className="historico-lista">
              {rows.map((item) => {
                const dataObj = new Date(item.session_date + 'T00:00:00');
                const dataFmt = formatarDataHistorico(dataObj);
                const statusLabel =
                  item.status === 'completo'
                    ? 'Completo'
                    : item.status === 'incompleto'
                    ? 'Incompleto'
                    : 'Nao Realizado';

                return (
                  <li key={item.session_date} className="historico-item">
                    <div className="col-data">{dataFmt}</div>
                    <div className="col-treino">{item.treino_nome}</div>
                    <div className="col-status">
                      <div className="status-line">
                        <StatusIcon status={item.status} />
                        <span className="status-text">{statusLabel}</span>
                      </div>
                      {item.ritmo && (
                        <div className={`ritmo-line ${item.ritmo === 'no_ritmo' ? 'ok' : 'late'}`}>
                          {item.ritmo === 'no_ritmo' ? 'No Ritmo' : 'Atrasado'}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
const StatusIcon = ({ status }: { status: HistoricoItem['status'] }) => {
  const styles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    color: 'white',
    fontSize: '12px',
    fontWeight: 'bold',
  };
  if (status === 'completo') return <div style={{ ...styles, backgroundColor: 'var(--status-disponivel)' }}>✓</div>;
  if (status === 'incompleto') return <div style={{ ...styles, backgroundColor: 'var(--status-em-treinamento)' }}>!</div>;
  return <div style={{ ...styles, backgroundColor: 'var(--text-secondary)' }}>-</div>;
};
function PefAddModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
    onSave: (novoPef: NovoPefData) => Promise<Record<string, string> | null>;
}) {
  // ESTADOS INTERNOS DO MODAL (O assistente tem suas próprias ferramentas)
  const [dadosPef, setDadosPef] = useState({
    nome: '',
    cpf: '',
    email: '',
    cref: '',
    is_estagiario: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isCpfValidating, setIsCpfValidating] = useState(false);
  const lastCheckedCpf = useRef<string | null>(null);

  const handleChange = (campo: keyof typeof dadosPef, valor: string | boolean) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[campo];
      return newErrors;
    });
    if (campo === 'is_estagiario' && valor === true) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.cref;
        return newErrors;
      });
    }
    setDadosPef(dadosAtuais => ({ ...dadosAtuais, [campo]: valor }));
  };
// Dentro de function PefAddModal(...)

const handleCpfBlur = async () => {
    const currentCpf = dadosPef.cpf.trim();

    // SUGESTÃO 1: A verificação para evitar chamadas duplicadas
    if (currentCpf.length < 11 || currentCpf === lastCheckedCpf.current) {
    return;
  }

  setIsCpfValidating(true);
  lastCheckedCpf.current = currentCpf; // Armazena o CPF que estamos verificando
  setApiError(null); // Limpa qualquer erro genérico anterior

  try {
    const response = await fetch('/api/validate-cpf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: dadosPef.cpf }),
    });

    const result = await response.json(); // Lê a resposta JSON em todos os casos

    if (!response.ok) {
      // Se a resposta não for de sucesso, lançamos a mensagem de erro específica que a API nos enviou.
      // O 'result.error' vem do { error: '...' } que definimos na nossa API.
      throw new Error(result.error || "Falha na validação do CPF no servidor.");
    }

    // Se a resposta foi de sucesso, checamos o resultado da validação
    if (result.exists) {
      setErrors(prev => ({ ...prev, cpf: 'Este CPF já está cadastrado.' }));
    } else {
      // Garante que qualquer erro anterior de CPF seja limpo
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.cpf;
        return newErrors;
      });
    }
} catch (error) { // Removido o tipo 'any'
  // Verificamos se o erro é uma instância de Error para usar sua mensagem
  if (error instanceof Error) {
    console.error("Erro ao validar CPF onBlur:", error.message);
    setApiError(error.message);
  } else {
    // Caso contrário, logamos o erro desconhecido e definimos uma mensagem genérica
    console.error("Erro desconhecido ao validar CPF onBlur:", error);
    setApiError("Ocorreu um erro inesperado ao validar o CPF.");
  }
} finally {
    setIsCpfValidating(false);
  }
};
  const handleSaveClick = async () => {
  setApiError(null);
  setErrors({}); // Limpa todos os erros de campo antigos
  const validationErrors = validateNewPefData(dadosPef);
  
  if (Object.keys(validationErrors).length > 0) {
    setErrors(validationErrors);
    return; // Para a execução se a validação de frontend falhar
  }

  setIsSubmitting(true);
  const errorResult = await onSave(dadosPef);
  setIsSubmitting(false);

  if (errorResult) {
    // --- LÓGICA ATUALIZADA PARA MÚLTIPLOS ERROS ---
    if (Array.isArray(errorResult.errors)) {
      // Se a API retornou um array de erros de campo...
      const newErrors: Record<string, string> = {};
      errorResult.errors.forEach((err: { field: string; error: string }) => {
        newErrors[err.field] = err.error;
      });
      // ...preenchemos o estado de erros com todos eles de uma vez.
      setErrors(newErrors);
    } else {
      // Se for um erro genérico (sem o array 'errors'), mostramos no rodapé
      setApiError(errorResult.error || 'Ocorreu um erro inesperado.');
    }
  }
};
  const isFormValid = useMemo(() => {
    // Verifica se os campos de texto obrigatórios estão preenchidos
    const requiredTextFieldsValid = dadosPef.nome.trim() !== '' && dadosPef.email.trim() !== '' && dadosPef.cpf.trim() !== '';
    // Verifica a regra condicional do CREF
    const crefIsValid = dadosPef.is_estagiario || (!dadosPef.is_estagiario && dadosPef.cref.trim() !== '');
    // O formulário só é válido se não houver NENHUM erro
    const noValidationErrors = Object.keys(errors).length === 0;

    return requiredTextFieldsValid && crefIsValid && noValidationErrors;
  }, [dadosPef, errors]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>&times;</button>
        <div className="modal-header">
          <h2 className="title-modal">Adicionar Profissional</h2>
          <p className="subtitle-modal">Insira os dados</p>
        </div>
        <div className="modal-body">
          {/* Campo de Nome */}
          <div className="input-group">
            <label htmlFor="pef-add-nome">Nome Completo</label>
            <input id="pef-add-nome" type="text" value={dadosPef.nome} onChange={(e) => handleChange('nome', e.target.value)} placeholder="Nome do profissional" className={errors.nome ? 'invalid' : ''} />
            {errors.nome && <span className="error-message">{errors.nome}</span>}
          </div>
                    {/* Campo de CPF */}
          <div className="input-group">
            <label htmlFor="pef-add-cpf">CPF</label>
            <div className="input-with-icon"> {/* Wrapper para posicionar o ícone */}
              <input 
                id="pef-add-cpf"
                type="text"
                value={dadosPef.cpf}
                onChange={(e) => handleChange('cpf', e.target.value)}
                onBlur={handleCpfBlur}
                placeholder="000.000.000-00"
                className={errors.cpf ? 'invalid' : ''}
              />
              {isCpfValidating && <div className="spinner"></div>} {/* Ícone de loading */}
            </div>
            {errors.cpf && <span className="error-message">{errors.cpf}</span>}
          </div>
          {/* Campo de E-mail */}
          <div className="input-group">
            <label htmlFor="pef-add-email">E-mail</label>
            <input id="pef-add-email" type="email" value={dadosPef.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="email@dominio.com" className={errors.email ? 'invalid' : ''} />
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>
          {/* Checkbox e Campo de CREF */}
          <div className="input-group-checkbox">
            <input id="pef-add-estagiario" type="checkbox" checked={dadosPef.is_estagiario} onChange={(e) => handleChange('is_estagiario', e.target.checked)} />
            <label htmlFor="pef-add-estagiario">Este profissional é um estagiário</label>
          </div>
          <div className="input-group">
            <label htmlFor="pef-add-cref">CREF</label>
            <input id="pef-add-cref" type="text" value={dadosPef.cref} onChange={(e) => handleChange('cref', e.target.value)} disabled={dadosPef.is_estagiario} placeholder={dadosPef.is_estagiario ? 'Não aplicável para estagiários' : 'Ex: 012345-G/RJ'} className={errors.cref ? 'invalid' : ''} />
            {errors.cref && <span className="error-message">{errors.cref}</span>}
          </div>
        </div>
        <div className="modal-actions">
          {apiError && <p className="api-feedback-error">{apiError}</p>}
          <div className="button-group">
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSaveClick}               
            disabled={!isFormValid || isSubmitting || isCpfValidating}
            >
              {isSubmitting ? 'Enviando...' : 'Enviar convite'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function calcularRitmo(
  startTimeISO: string,
  finalizados: number,
  total: number,
  duracaoMin: number = 60
): 'no_ritmo' | 'atrasado' {

  // Caso especial: se não há exercícios, não há ritmo a medir.
  if (total <= 0) {
    return 'no_ritmo';
  }

  const start = new Date(startTimeISO);
  const agora = new Date();
  let decorridoMin = (agora.getTime() - start.getTime()) / 1000 / 60;

  if (decorridoMin < 0) decorridoMin = 0;

  // REGRA 1: Se o tempo total do treino foi excedido, está sempre "atrasado".
  if (decorridoMin > duracaoMin) {
    // Se já finalizou tudo, mas passou do tempo, continua atrasado.
    if (finalizados >= total) {
      return 'atrasado';
    }
  }

  // REGRA 2: Se finalizou todos os exercícios dentro do tempo, está "no ritmo".
  if (finalizados >= total) {
    return 'no_ritmo';
  }

  // =================================================================
  // --- LÓGICA DE BLOCOS DE TEMPO (IMPLEMENTAÇÃO DA SUA SUGESTÃO) ---
  // =================================================================
  
  // 1. Calcula o tempo alocado para cada "bloco" de exercício.
  const tempoPorExercicio = duracaoMin / total;

  // 2. Calcula o tempo limite para o estágio atual do treino.
  // O aluno tem até o final do PRÓXIMO bloco para estar em dia.
  const tempoLimite = (finalizados + 1) * tempoPorExercicio;

  // 3. Compara o tempo decorrido com o tempo limite do bloco atual.
  const ritmo = decorridoMin <= tempoLimite ? 'no_ritmo' : 'atrasado';
  
  // Log para depuração
  console.log('[calcularRitmo por BLOCO]', {
    finalizados,
    total,
    decorridoMin: decorridoMin.toFixed(2),
    tempoPorExercicio: tempoPorExercicio.toFixed(2),
    tempoLimite: tempoLimite.toFixed(2),
    ritmo
  });

  return ritmo;
}
function LoadingSpinner({ message }: { message?: string }) {
    return (
    <div className="loading-overlay">
      {message && <p>{message}</p>}
      {spinnerIcon}
    </div>
  );
}
function AlunoAddModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (novoAluno: NovoAlunoData) => Promise<Record<string, string> | null>;
}) {
  const [dadosAluno, setDadosAluno] = useState<NovoAlunoData>({
    nome: '',
    cpf: '',
    observacao: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Lógica de validação de CPF onBlur
  // Essa lógica pode ser reutilizada da função `handleCpfBlur` do PefAddModal
  // Se precisar de ajuda para adaptar essa função, me avise.

  const handleChange = (campo: keyof NovoAlunoData, valor: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[campo];
      return newErrors;
    });
    setDadosAluno(dadosAtuais => ({ ...dadosAtuais, [campo]: valor }));
  };

  const handleSaveClick = async () => {
    setApiError(null);
    setErrors({});
    
    const validationErrors = validateNewAlunoData(dadosAluno);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    const errorResult = await onSave(dadosAluno);
    setIsSubmitting(false);

    if (errorResult) {
      if (Array.isArray(errorResult.errors)) {
        const newErrors: Record<string, string> = {};
        errorResult.errors.forEach((err: { field: string; error: string }) => {
          newErrors[err.field] = err.error;
        });
        setErrors(newErrors);
      } else {
        setApiError(errorResult.error || 'Ocorreu um erro inesperado.');
      }
    }
  };

  const isFormValid = useMemo(() => {
    const requiredTextFieldsValid = dadosAluno.nome.trim() !== '' && dadosAluno.cpf.trim() !== '';
    const noValidationErrors = Object.keys(errors).length === 0;
    return requiredTextFieldsValid && noValidationErrors;
  }, [dadosAluno, errors]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>&times;</button>
        <div className="modal-header">
          <h2 className="title-modal">Adicionar Aluno</h2>
          <p className="subtitle-modal">Insira os dados</p>
        </div>
        <div className="modal-body">
          {/* Campo de Nome */}
          <div className="input-group">
            <label htmlFor="aluno-add-nome">Nome Completo</label>
            <input
              id="aluno-add-nome"
              type="text"
              value={dadosAluno.nome}
              onChange={(e) => handleChange('nome', e.target.value)}
              placeholder="Nome do aluno"
              className={errors.nome ? 'invalid' : ''}
            />
            {errors.nome && <span className="error-message">{errors.nome}</span>}
          </div>
          {/* Campo de CPF */}
          <div className="input-group">
            <label htmlFor="aluno-add-cpf">CPF</label>
            <input
              id="aluno-add-cpf"
              type="text"
              value={dadosAluno.cpf}
              onChange={(e) => handleChange('cpf', e.target.value)}
              // onBlur={handleCpfBlur} // Adicione a validação de CPF aqui
              placeholder="000.000.000-00"
              className={errors.cpf ? 'invalid' : ''}
            />
            {errors.cpf && <span className="error-message">{errors.cpf}</span>}
          </div>
          {/* Campo de Observação */}
          <div className="input-group">
            <label htmlFor="aluno-add-observacao">Observação</label>
            <textarea
              id="aluno-add-observacao"
              value={dadosAluno.observacao}
              onChange={(e) => handleChange('observacao', e.target.value)}
              placeholder="Ex: Histórico de lesão no joelho, comorbidades, etc."
            />
          </div>
        </div>
        <div className="modal-actions">
          {apiError && <p className="api-feedback-error">{apiError}</p>}
          <div className="button-group">
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button
              className="btn btn-primary"
              onClick={handleSaveClick}
              disabled={!isFormValid || isSubmitting}
            >
              {isSubmitting ? 'Enviando...' : 'Adicionar Aluno'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function AlunoManagementCard({
  aluno,
  onEdit,
  onToggleStatus,
  isEmTreinamento,
}: {
  aluno: Aluno;
  onEdit: () => void;
  onToggleStatus: (alunoId: string, statusAtual: 'ativo' | 'inativo') => void;
  isEmTreinamento: boolean;
  
}) {
  const isAtivo = aluno.matricula_status === 'ativo';

  return (
    <div className="info-card">
      <div className="card-header">
        <h3 className="title-card">{aluno.nome}</h3>
        <div className="card-options-wrapper">
          {/* Futuros menus de opções podem vir aqui */}
        </div>
      </div>
      <div className="card-body">
        <div className="status-line">
          {/* Tag de Status: Ativo/Inativo */}
          <span className={`status-tag ${isAtivo ? 'status-tag-disponivel' : 'status-tag-inativo'}`}>
            {isAtivo ? 'Matrícula Ativa' : 'Matrícula Inativa'}
          </span>
        </div>
        <div className="aluno-details">
          <span>CPF: {aluno.cpf}</span>
          {aluno.observacao && (
            <p className="observacao-text">
              **Observação:** {aluno.observacao}
            </p>
          )}
        </div>
      </div>
      <div className="actions">
        <button onClick={onEdit} className="btn btn-icon" title="Editar Aluno">
          {editIcon}
        </button>
        <button
          onClick={() => onToggleStatus(aluno.id, aluno.matricula_status)}
          className={`btn btn-icon ${isAtivo && isEmTreinamento ? 'btn-disabled-inactivate' : ''}`} 
          disabled={isAtivo && isEmTreinamento}
          title={
          isAtivo && isEmTreinamento 
            ? 'Aluno em treino não pode ser inativado.' 
            : (isAtivo ? 'Inativar Matrícula' : 'Ativar Matrícula')
            }
          >
            {isAtivo ? deactivateIcon : activateIcon}
      </button>
      </div>
    </div>
  );
}
function AlunoEditModal({
  aluno,
  onClose,
  onSave,
}: {
  aluno: Aluno;
  onClose: () => void;
  onSave: (alunoAtualizado: Aluno) => Promise<Record<string, string> | null>;
}) {
  const [dadosEditados, setDadosEditados] = useState<Aluno>(aluno);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    // Sincroniza o estado do modal com as props iniciais do aluno
    setDadosEditados(aluno);
  }, [aluno]);

  const handleChange = (campo: keyof Aluno, valor: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[campo];
      return newErrors;
    });
    setDadosEditados(dadosAtuais => ({ ...dadosAtuais, [campo]: valor }));
  };

  const handleSaveClick = async () => {
    setApiError(null);
    setErrors({});
    
    // 1. Valida os dados no frontend
    const validationErrors = validateAlunoData(dadosEditados);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    // 2. Chama a função onSave do componente pai
    const errorResult = await onSave(dadosEditados);
    setIsSubmitting(false);

    // 3. Trata a resposta e exibe erros, se houver
    if (errorResult) {
      if (Array.isArray(errorResult.errors)) {
        const newErrors: Record<string, string> = {};
        errorResult.errors.forEach((err: { field: string; error: string }) => {
          newErrors[err.field] = err.error;
        });
        setErrors(newErrors);
      } else {
        setApiError(errorResult.error || 'Ocorreu um erro inesperado.');
      }
    }
  };

  const isFormValid = useMemo(() => {
    const requiredTextFieldsValid = dadosEditados.nome.trim() !== '' && dadosEditados.cpf.trim() !== '';
    const noValidationErrors = Object.keys(errors).length === 0;
    return requiredTextFieldsValid && noValidationErrors;
  }, [dadosEditados, errors]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>&times;</button>
        <div className="modal-header">
          <h2 className="title-modal">Editar Aluno</h2>
          <p className="subtitle-modal">{aluno.nome}</p>
        </div>
        <div className="modal-body">
          {/* Campo de Nome */}
          <div className="input-group">
            <label htmlFor="aluno-edit-nome">Nome Completo</label>
            <input
              id="aluno-edit-nome"
              type="text"
              value={dadosEditados.nome}
              onChange={(e) => handleChange('nome', e.target.value)}
              placeholder="Nome do aluno"
              className={errors.nome ? 'invalid' : ''}
            />
            {errors.nome && <span className="error-message">{errors.nome}</span>}
          </div>
          {/* Campo de CPF */}
          <div className="input-group">
            <label htmlFor="aluno-edit-cpf">CPF</label>
            <input
              id="aluno-edit-cpf"
              type="text"
              value={dadosEditados.cpf}
              onChange={(e) => handleChange('cpf', e.target.value)}
              placeholder="000.000.000-00"
              className={errors.cpf ? 'invalid' : ''}
            />
            {errors.cpf && <span className="error-message">{errors.cpf}</span>}
          </div>
          {/* Campo de Observação */}
          <div className="input-group">
            <label htmlFor="aluno-edit-observacao">Observação</label>
            <textarea
              id="aluno-edit-observacao"
              value={dadosEditados.observacao}
              onChange={(e) => handleChange('observacao', e.target.value)}
              placeholder="Ex: Histórico de lesão no joelho, comorbidades, etc."
            />
          </div>
        </div>
        <div className="modal-actions">
          {apiError && <p className="api-feedback-error">{apiError}</p>}
          <div className="button-group">
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button
              className="btn btn-primary"
              onClick={handleSaveClick}
              disabled={!isFormValid || isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
