// ARQUIVO: page.tsx - VERSÃO COM O LAYOUT FINAL DA TELA DE GERENCIAMENTO

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
/*import debounce from 'lodash.debounce';*/

// =======================================================
// 1. SEUS TIPOS (Aluno, PEF, etc.)
// =======================================================
// =======================================================
// 1. TIPOS DE DADOS DA APLICAÇÃO (Refatorado)
// Usamos 'interface' para definir a "forma" dos nossos objetos.
// É uma convenção comum e otimizada para este propósito.
// =======================================================

// --- Modelos de Dados Principais ---

interface ExercicioPlano {
  id: number;
  nome?: string; // Nome é opcional aqui, pois virá da Biblioteca de Exercícios
  series: number | string; // Permite '4' ou "10-12"
  repeticoes: string;
  carga: string;
  observacoes?: string; // O '?' indica que a propriedade é opcional
}

interface Plano {
  id: number;
  nome: string;
  exercicios: ExercicioComEdicao[]; // <<< AGORA o plano aceita exercícios com o estado de edição
  ativo: boolean;
}

interface Aluno {
  id: number;
  nome: string;
  status: "disponivel" | "aguardando" | "em_treinamento";
  pef_responsavel_id?: number | null;
  ritmo?: "no_ritmo" | "atrasado";
  status_timestamp: string; // Mantido como string, representa um ISO Date
  planos: Plano[];
  historico?: HistoricoItem[];
}
//Excluído pra garantir deploy da primeira versão no Vercel
/*interface PEF {
  id: number;
  nome: string;
  is_estagiario: boolean;
  cref: string | null;
}*/

interface ExercicioBiblioteca {
  id: number;
  nome: string;
}

interface CsvRow {
  Nome?: string; // Coluna obrigatória
  // Adicione outras colunas se necessário
}
// --- Tipos para Gerenciamento de Estado e Sessão ---

interface LiveExercise {
  id: number;
  status: "nao-iniciado" | "executando" | "finalizado";
}

interface ActiveSession {
  alunoId: number;
  planoId: number;
  startTime: string; // Mantido como string, representa um ISO Date
  exercises: LiveExercise[];
}

// --- Tipos para Props de Componentes ---

// Este é o tipo que unifica ExercicioPlano e ExercicioComEdicao.
// É um exercício de um plano, que PODE estar em modo de edição no formulário.
interface ExercicioComEdicao extends ExercicioPlano {
  nome: string; // Na UI, o nome é obrigatório
  isEditing?: boolean;
}

interface ExercicioCardProps {
  exercicio: ExercicioComEdicao;
  isExpanded: boolean;
  showActions: boolean;
  onToggleExpansion: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isEditable?: boolean;
  onExercicioChange?: (campo: keyof ExercicioPlano, valor: string | number) => void;
  onSuggestionSelect?: (suggestion: ExercicioBiblioteca) => void; // <<< NOVA PROP
  validationError?: {
    nome?: string;
    series?: string;
    repeticoes?: string;
  };
}
interface EditExerciseModalProps {
  exercicio: ExercicioComEdicao | null;
  onClose: () => void;
  onSave: (exercicioAtualizado: ExercicioComEdicao) => void;
}
interface PlanoEditViewProps {
  aluno: Aluno;
  plano: Plano;
  onBack: () => void;
  onSave: (plano: Plano) => void;
  onPlanoChange: (campo: keyof Plano, valor: string) => void;
  onExercicioChange: (
    exercicioId: number,
    campo: keyof ExercicioPlano,
    valor: string | number
  ) => void;
  onExercicioSelect: (exercicioIndex: number, suggestion: ExercicioBiblioteca) => void; // <<< NOVA PROP
  onAddExercicio: () => void;
  onDeleteExercicio: (exercicioId: number) => void; // <<< A definição correta
  validationErrors: Record<string, string>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}
interface HistoricoItem {
  id: number; // ID único para cada entrada do histórico
  data: string; // Data do treino no formato ISO (ex: new Date().toISOString())
  planoId: number; // ID do plano que foi executado
  nomePlano: string; // Nome do plano executado (ou "Não houve treino")
  status: 'completo' | 'incompleto' | 'nao-realizado'; // O status do "farol"
}
//Excluído pra garantir deploy da primeira versão no Vercel
/*type AlunoStatus = "disponivel" | "aguardando" | "em_treinamento";*/

type ExercicioError = {
  series?: string;
  repeticoes?: string;
};

const validateExercicio = (exercicio: ExercicioComEdicao): { isValid: boolean; errors: ExercicioError } => {
  const errors: ExercicioError = {};

  if (!String(exercicio.series).trim() || isNaN(Number(exercicio.series))) {
    errors.series = "Obrigatório e numérico";
  }

  if (!String(exercicio.repeticoes).trim()) {
    errors.repeticoes = "Obrigatório";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

interface CsvRow {  // <-- Adicione esta interface também
  Nome?: string;
}

const validatePlano = (plano: Plano): { isValid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};

  // Regra 1: Nome do plano é obrigatório
  if (!plano.nome.trim()) {
    errors.planoNome = "Nome do plano é obrigatório";
  }

  // Regra 2: Plano deve ter pelo menos um exercício
  if (plano.exercicios.length === 0) {
    errors.form = "O plano deve ter pelo menos um exercício.";
  }

  // Regra 3: Validar cada exercício da lista
  plano.exercicios.forEach((ex, index) => {
    const prefix = `exercicios[${index}].`;
    
    if (!ex.nome.trim()) {
      errors[`${prefix}nome`] = "Nome do exercício é obrigatório";
    } else {
      // Garante que o nome do exercício é um da nossa biblioteca
      const exercicioExisteNaBiblioteca = initialMockData.exercicios_biblioteca.some(
        libEx => normalizeString(libEx.nome) === normalizeString(ex.nome)
      );
      if (!exercicioExisteNaBiblioteca) {
        errors[`${prefix}nome`] = "Selecione um exercício válido da lista de sugestões.";
      }
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// =======================================================
// 2. SUAS CONSTANTES DE ÍCONES (editIcon, etc.)
// =======================================================
const planIcon = (
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

const timeAgoFn = (minutes: number) =>
  new Date(new Date().getTime() - minutes * 60000).toISOString();

const initialMockData = {
  treinadores: [
    {
      id: 1,
      nome: "Carlos Andrade",
      is_estagiario: false,
      cref: "012345-G/RJ",
    },
    { id: 2, nome: "Fernanda Lima", is_estagiario: false, cref: "023456-G/RJ" },
    { id: 3, nome: "Bruno Costa", is_estagiario: true, cref: null },
  ],
  exercicios_biblioteca: [
    {
        'id': 101,
        'nome': 'Crossover'
    },
    {
        'id': 102,
        'nome': 'Remada Alta'
    },
    {
        'id': 103,
        'nome': 'Voador Peitoral'
    },
    {
        'id': 104,
        'nome': 'Elevação Frontal'
    },
    {
        'id': 105,
        'nome': 'Supino 45º'
    },
    {
        'id': 106,
        'nome': 'Abdução de Ombro'
    },
    {
        'id': 107,
        'nome': 'Tríceps Francês'
    },
    {
        'id': 108,
        'nome': 'Tríceps Testa'
    },
    {
        'id': 109,
        'nome': 'Tríceps Pulley'
    },
    {
        'id': 110,
        'nome': 'Pullover'
    },
    {
        'id': 111,
        'nome': 'Bíceps 35º'
    },
    {
        'id': 112,
        'nome': 'Remada na Polia Baixa'
    },
    {
        'id': 113,
        'nome': 'Rosca Bíceps na Corda'
    },
    {
        'id': 114,
        'nome': 'Remada no banco 35º'
    },
    {
        'id': 115,
        'nome': 'Puxada'
    },
    {
        'id': 116,
        'nome': 'Voador Dorsal'
    },
    {
        'id': 117,
        'nome': 'Facepull'
    },
    {
        'id': 118,
        'nome': 'Rosca Bíceps Barra W'
    },
    {
        'id': 119,
        'nome': 'Supino Reto com Barra'
    },
    {
        'id': 120,
        'nome': 'Supino Inclinado com Halteres'
    },
    {
        'id': 121,
        'nome': 'Crucifixo Reto (Halteres ou Máquina)'
    },
    {
        'id': 122,
        'nome': 'Flexão de Braço (Push-up)'
    },
    {
        'id': 123,
        'nome': 'Mergulho nas Paralelas (Dips)'
    },
    {
        'id': 124,
        'nome': 'Crossover na Polia Alta'
    },
    {
        'id': 125,
        'nome': 'Voador (Peck Deck)'
    },
    {
        'id': 126,
        'nome': 'Puxada Frontal (Pulley)'
    },
    {
        'id': 127,
        'nome': 'Remada Curvada com Barra'
    },
    {
        'id': 128,
        'nome': 'Remada Unilateral com Halter (Serrote)'
    },
    {
        'id': 129,
        'nome': 'Barra Fixa (Pull-up)'
    },
    {
        'id': 130,
        'nome': 'Remada Sentada na Máquina'
    },
    {
        'id': 131,
        'nome': 'Pulldown com Braços Estendidos'
    },
    {
        'id': 132,
        'nome': 'Hiperextensão Lombar (Banco Romano)'
    },
    {
        'id': 133,
        'nome': 'Crucifixo Invertido (Halteres ou Máquina)'
    },
    {
        'id': 134,
        'nome': 'Desenvolvimento com Halteres (Arnold Press)'
    },
    {
        'id': 135,
        'nome': 'Elevação Lateral com Halteres'
    },
    {
        'id': 136,
        'nome': 'Encolhimento com Halteres (Trapézio)'
    },
    {
        'id': 137,
        'nome': 'Desenvolvimento Militar com Barra'
    },
    {
        'id': 138,
        'nome': 'Rosca Direta com Barra'
    },
    {
        'id': 139,
        'nome': 'Rosca Alternada com Halteres'
    },
    {
        'id': 140,
        'nome': 'Rosca Martelo (Hammer Curl)'
    },
    {
        'id': 141,
        'nome': 'Rosca Scott (Banco Scott)'
    },
    {
        'id': 142,
        'nome': 'Rosca Concentrada'
    },
    {
        'id': 143,
        'nome': 'Tríceps Testa com Barra'
    },
    {
        'id': 144,
        'nome': 'Tríceps Francês Unilateral com Halter'
    },
    {
        'id': 145,
        'nome': 'Flexão Diamante'
    },
    {
        'id': 146,
        'nome': 'Mergulho no Banco'
    },
    {
        'id': 147,
        'nome': 'Agachamento Livre com Barra'
    },
    {
        'id': 148,
        'nome': 'Leg Press 45°'
    },
    {
        'id': 149,
        'nome': 'Afundo (Lunge) com Halteres'
    },
    {
        'id': 150,
        'nome': 'Cadeira Extensora'
    },
    {
        'id': 151,
        'nome': 'Mesa Flexora'
    },
    {
        'id': 152,
        'nome': 'Stiff com Barra ou Halteres'
    },
    {
        'id': 153,
        'nome': 'Levantamento Terra (Deadlift)'
    },
    {
        'id': 154,
        'nome': 'Agachamento Búlgaro'
    },
    {
        'id': 155,
        'nome': 'Elevação Pélvica (Hip Thrust)'
    },
    {
        'id': 156,
        'nome': 'Abdução de Quadril na Máquina ou com Elástico'
    },
    {
        'id': 157,
        'nome': 'Cadeira Adutora'
    },
    {
        'id': 158,
        'nome': 'Coice na Polia Baixa'
    },
    {
        'id': 159,
        'nome': 'Bom dia com Barra'
    },
    {
        'id': 160,
        'nome': 'Panturrilha em Pé (Gêmeos)'
    },
    {
        'id': 161,
        'nome': 'Panturrilha Sentado (Sóleo)'
    },
    {
        'id': 162,
        'nome': 'Panturrilha no Leg Press'
    },
    {
        'id': 163,
        'nome': 'Prancha Abdominal (Plank)'
    },
    {
        'id': 164,
        'nome': 'Abdominal supra (Crunch)'
    },
    {
        'id': 165,
        'nome': 'Elevação de Pernas (Abdominal Infra)'
    },
    {
        'id': 166,
        'nome': 'Abdominal Remador'
    },
    {
        'id': 167,
        'nome': 'Prancha Lateral'
    },
    {
        'id': 168,
        'nome': 'Rotação de Tronco na Polia (Pallof Press)'
    },
    {
        'id': 169,
        'nome': 'Extensão Lombar na Máquina'
    },
    {
        'id': 170,
        'nome': 'Ponte (Glute Bridge)'
    }
],
  alunos: [
    {
      id: 201,
      nome: "Ana Júlia Ribeiro",
      status: "disponivel",
      pef_responsavel_id: null,
      ritmo: undefined,
      status_timestamp: timeAgoFn(10),
      planos: [
        {
          id: 301,
          nome: "Treino de Janeiro",
          ativo: false,
          exercicios: [
            { id: 105, series: 4, repeticoes: "10", carga: "20, 25, 30, 35" },
          ],
        },
        {
          id: 302,
          nome: "Treino de Fevereiro",
          ativo: true,
          exercicios: [{ id: 106, series: 5, repeticoes: "8-10", carga: "" }],
        },
      ],
    },
    {
      id: 202,
      nome: "Breno Gonçalves",
      status: "aguardando",
      pef_responsavel_id: null,
      ritmo: undefined,
      status_timestamp: timeAgoFn(5),
      planos: [
        {
          id: 303,
          nome: "Full Body (Iniciante)",
          ativo: true,
          exercicios: [{ id: 102, series: 3, repeticoes: "15", carga: "" }],
        },
      ],
    },
    {
      id: 203,
      nome: "Clara Dias",
      status: "em_treinamento",
      pef_responsavel_id: 2,
      ritmo: "no_ritmo",
      status_timestamp: timeAgoFn(25),
      planos: [
        {
          id: 304,
          nome: "Treino Atual de Força",
          ativo: true,
          exercicios: [{ id: 102, series: 5, repeticoes: "5", carga: "80kg" }],
        },
        {
          id: 305,
          nome: "Treino de Cardio (inativo)",
          ativo: false,
          exercicios: [{ id: 101, series: 3, repeticoes: "20", carga: "15" }],
        },
      ],
    },
    {
      id: 205,
      nome: "Rodrigo Macedo",
      status: "disponivel",
      pef_responsavel_id: null,
      ritmo: undefined,
      status_timestamp: timeAgoFn(15),
      planos: [
        {
          id: 401,
          nome: "Treino A - Peito, Ombro e Tríceps",
          ativo: true,
          exercicios: [
            {
              id: 101,
              series: 3,
              repeticoes: "10-12",
              carga: "40",
              observacoes: "Polia alta",
            },
            {
              id: 102,
              series: 3,
              repeticoes: "10-12",
              carga: "45",
              observacoes: "No crossover",
            },
            {
              id: 103,
              series: 3,
              repeticoes: "10-12",
              carga: "61",
              observacoes: "Aparelho, Pegada Pronada, Regulagem do banco: 6",
            },
            {
              id: 104,
              series: 3,
              repeticoes: "10-12",
              carga: "20",
              observacoes: "Na corda",
            },
            {
              id: 105,
              series: 3,
              repeticoes: "10-12",
              carga: "29",
              observacoes: "HBC",
            },
            {
              id: 106,
              series: 3,
              repeticoes: "10-12",
              carga: "10",
              observacoes: "HBC",
            },
            {
              id: 107,
              series: 3,
              repeticoes: "10-12",
              carga: "10",
              observacoes: "HBC",
            },
            {
              id: 108,
              series: 3,
              repeticoes: "10-12",
              carga: "10",
              observacoes: "Barra T",
            },
            {
              id: 109,
              series: 3,
              repeticoes: "10-12",
              carga: "45",
              observacoes: "Na corda",
            },
          ],
        },
        {
          id: 402,
          nome: "Treino B - Costas e Bíceps",
          ativo: true,
          exercicios: [
            {
              id: 110,
              series: 3,
              repeticoes: "10-12",
              carga: "45",
              observacoes: "Na corda",
            },
            {
              id: 111,
              series: 3,
              repeticoes: "10-12",
              carga: "12",
              observacoes: "Pegada Supinada",
            },
            {
              id: 112,
              series: 3,
              repeticoes: "10-12",
              carga: "50",
              observacoes: "HBL",
            },
            {
              id: 113,
              series: 3,
              repeticoes: "10-12",
              carga: "50",
              observacoes: "Polia baixa com corda",
            },
            {
              id: 114,
              series: 3,
              repeticoes: "10-12",
              carga: "65",
              observacoes: "Pegada Pronada",
            },
            {
              id: 118,
              series: 3,
              repeticoes: "10-10",
              carga: "55",
              observacoes: "Polia baixa com barra W",
            },
            {
              id: 115,
              series: 3,
              repeticoes: "10-12",
              carga: "45",
              observacoes: "Barra Triângulo",
            },
            {
              id: 116,
              series: 3,
              repeticoes: "10-12",
              carga: "20",
              observacoes: "Aparelho, Pegada Pronada, Regulagem: 6",
            },
            {
              id: 117,
              series: 3,
              repeticoes: "10-12",
              carga: "45",
              observacoes: "Na Corda",
            },
          ],
        },
        {
          id: 403,
          nome: "Treino de Hipertrofia (Antigo)",
          ativo: false,
          exercicios: [{ id: 114, series: 4, repeticoes: "8", carga: "70" }],
        },
      ],
    },
  ],
} as const;
const pefLogado = initialMockData.treinadores[0];

// =======================================================
// 3. SEUS COMPONENTES (AlunoCard, ExercicioCard, PlanoEditView, etc.)
//    COLE TODOS ELES AQUI, FORA DO COMPONENTE 'PAGE'
// =======================================================
// --- COMPONENTES E LÓGICA ---

function useTimeAgo(timestamp: string) {
  const [timeAgo, setTimeAgo] = useState("");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const past = new Date(timestamp);
      const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
      if (diffInSeconds < 0) {
        setTimeAgo("");
        return;
      }
      const minutes = Math.floor(diffInSeconds / 60);
      const hours = Math.floor(minutes / 60);
      if (hours > 0) {
        setTimeAgo(`há ${hours}h ${minutes % 60}m`);
      } else if (minutes > 0) {
        setTimeAgo(`há ${minutes}m`);
      } else {
        setTimeAgo(`agora`);
      }
    };
    update();
    const intervalId = setInterval(update, 60000);
    return () => clearInterval(intervalId);
  }, [timestamp]);
  return timeAgo;
}
function AlunoCard({
  aluno,
  onUpdateStatus,
  onNavigateToWorkout,
  onGerenciarPlanos,
  onVerHistorico,
}: {
  aluno: Aluno;
  onUpdateStatus: (
    event: React.MouseEvent<HTMLButtonElement>,
    alunoId: number,
    newStatus: Aluno["status"],
    pefId?: number | null
  ) => void;
  onNavigateToWorkout: (alunoId: number) => void;
  onGerenciarPlanos: (alunoId: number) => void;
  onVerHistorico: (alunoId: number) => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const statusMap = {
    disponivel: "Disponível",
    aguardando: "Aguardando",
    em_treinamento: "Em Treinamento",
  };
  const timeInStatus = useTimeAgo(aluno.status_timestamp);
  const getPefFullNameById = (id: number) => {
    const pef = initialMockData.treinadores.find((p) => p.id === id);
    return pef
      ? `${pef.nome.split(" ")[0]} ${pef.nome.split(" ").slice(-1)[0]}`
      : "N/A";
  };
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) {
      return;
    }
    if (aluno.status === "em_treinamento") {
      onNavigateToWorkout(aluno.id);
    }
  };
  const renderActions = () => {
    switch (aluno.status) {
      case "disponivel":
        return (
          <button
            className="action-btn"
            onClick={(e) => onUpdateStatus(e, aluno.id, "aguardando")}
          >
            {" "}
            Incluir na Fila{" "}
          </button>
        );
      case "aguardando":
        return (
          <button
            className="action-btn"
            onClick={() => onNavigateToWorkout(aluno.id)}
          >
            {" "}
            Iniciar Treino{" "}
          </button>
        );
      case "em_treinamento":
        if (aluno.pef_responsavel_id !== pefLogado.id) {
          return (
            <button
              className="action-btn"
              onClick={(e) =>
                onUpdateStatus(e, aluno.id, "em_treinamento", pefLogado.id)
              }
            >
              {" "}
              Assumir Treino{" "}
            </button>
          );
        }
        return null;
      default:
        return null;
    }
  };
  return (
    <div
      className="aluno-card"
      onClick={handleCardClick}
      style={{
        cursor: aluno.status === "em_treinamento" ? "pointer" : "default",
      }}
    >
      {" "}
      <div className="card-header">
        {" "}
        <h3 className="font-montserrat">{aluno.nome}</h3>{" "}
        <div className="card-options-wrapper" ref={menuRef}>
          {" "}
          <button
            className="options-icon"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
          >
            {" "}
            {optionsIcon}
          </button>{" "}
          {isMenuOpen && (
            <div className="options-menu">
              {" "}
              <button
                className="menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onGerenciarPlanos(aluno.id);
                  setIsMenuOpen(false);
                }}
              >
                {" "}
                Gerenciar Planos{" "}
              </button>{" "}
              <button
      className="menu-item"
      onClick={(e) => {
        e.stopPropagation();
        onVerHistorico(aluno.id);
        setIsMenuOpen(false);
      }}
    >
      Ver Histórico de Treinos
    </button>
            </div>
          )}{" "}
        </div>{" "}
      </div>{" "}
      <div className="card-body">
        {" "}
        <div className="status-line">
          {" "}
          <span
            className={`status-tag status-tag-${aluno.status.replace(
              "_",
              "-"
            )}`}
          >
            {" "}
            {statusMap[aluno.status]}{" "}
          </span>{" "}
          <span className="status-timer">⏰ {timeInStatus}</span>{" "}
          {aluno.status === "em_treinamento" && aluno.ritmo && (
            <div className={`ritmo-treino ritmo-${aluno.ritmo}`}>
              {" "}
              <span className="ritmo-dot"></span>{" "}
              {aluno.ritmo === "no_ritmo" ? "No ritmo" : "Atrasado"}{" "}
            </div>
          )}{" "}
        </div>{" "}
        {aluno.status === "em_treinamento" && (
          <div className="pef-resp">
            {" "}
            Com:{" "}
            <strong>
              {" "}
              {getPefFullNameById(aluno.pef_responsavel_id!)}{" "}
            </strong>{" "}
          </div>
        )}{" "}
      </div>{" "}
      <div className="actions">{renderActions()}</div>{" "}
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
  const planosAtivos = aluno.planos.filter((p) => p.ativo);
  return (
    <div className="modal-overlay" onClick={onCancel}>
      {" "}
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {" "}
        <h2 className="font-montserrat">Iniciar treino de {aluno.nome}</h2>{" "}
        <p className="modal-subtitle">
          {" "}
          Selecione o plano de treino para a sessão de hoje:{" "}
        </p>{" "}
        <div className="plan-selection-list">
          {" "}
          {planosAtivos.map((plano) => (
            <button key={plano.id} value={plano.id} onClick={onSelectPlan}>
              {" "}
              {plano.nome}{" "}
            </button>
          ))}{" "}
          {planosAtivos.length === 0 && (
            <p className="nenhum-plano">Nenhum plano ativo encontrado.</p>
          )}{" "}
        </div>{" "}
        <button className="btn-voltar" onClick={onCancel}>
          {" "}
          Cancelar{" "}
        </button>{" "}
      </div>{" "}
    </div>
  );
}

function calculateRhythm(
  startTime: Date,
  exercisesFinished: number,
  totalExercises: number
): "no_ritmo" | "atrasado" {
  const RHYTHM_TOLERANCE_MARGIN = 0.2;
  const WORKOUT_DURATION_MINUTES = 60;
  const timeElapsedMs = new Date().getTime() - startTime.getTime();
  const timeElapsedMinutes = timeElapsedMs / (1000 * 60);
  if (
    timeElapsedMinutes < 1 ||
    totalExercises === 0 ||
    exercisesFinished === 0
  ) {
    return "no_ritmo";
  }
  const timeRatio = timeElapsedMinutes / WORKOUT_DURATION_MINUTES;
  const exerciseRatio = exercisesFinished / totalExercises;
  if (timeRatio > exerciseRatio + RHYTHM_TOLERANCE_MARGIN) {
    return "atrasado";
  }
  return "no_ritmo";
}

function LiveWorkoutView({
  session,
  aluno,
  onBack,
  onFinishWorkout,
  onUpdateExercise,
  onEditarExercicio,
}: {
  session: ActiveSession;
  aluno: Aluno;
  onBack: () => void;
  onFinishWorkout: (alunoId: number) => void;
  onUpdateExercise: (
    exerciseId: number,
    status: LiveExercise["status"]
  ) => void;
    onEditarExercicio: (alunoId: number, planoId: number, exercicioId: number) => void; 
}) {
  const plano = aluno.planos.find((p) => p.id === session.planoId)!;
  console.log("DEBUG - plano encontrado:", plano);
console.log("DEBUG - session.planoId:", session.planoId);
console.log("DEBUG - aluno.planos:", aluno.planos);
  const finishedCount = session.exercises.filter(
    (ex) => ex.status === "finalizado"
  ).length;
  const percentage =
    plano.exercicios.length > 0
      ? ((finishedCount / plano.exercicios.length) * 100).toFixed(0)
      : "0";
  const rhythmStatus = aluno.ritmo || "no_ritmo";
  const sortedExercises = [...session.exercises].sort((a, b) => {
    const statusOrder = { executando: 1, "nao-iniciado": 2, finalizado: 3 };
    return statusOrder[a.status] - statusOrder[b.status];
  });
  const timeInTraining = useTimeAgo(session.startTime);
  return (
    <div className="container workout-view">
      {" "}
      <div className="workout-header">
        {" "}
        <div className="header-row-1">
          {" "}
          <button className="back-button" onClick={onBack}>
            {backIcon}
          </button>{" "}
          <div className="title-group">
            {" "}
            <h2 className="font-montserrat">{aluno.nome}</h2>{" "}
            <h3>{plano.nome}</h3>{" "}
          </div>{" "}
          <button className="icon-btn options-button">{optionsIcon}</button>{" "}
        </div>{" "}
        <div className="header-row-2">
          {" "}
          <div className="time-info-group">
            {" "}
            <span className="label">Início:</span>{" "}
            <span className="value">
              {" "}
              {new Date(session.startTime).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
            </span>{" "}
          </div>{" "}
          <div className="time-info-group">
            {" "}
            <span className="label">Tempo de treino:</span>{" "}
            <span className="value">{timeInTraining.replace("há ", "")}</span>{" "}
          </div>{" "}
        </div>{" "}
        <div className="header-row-3">
          {" "}
          <span className="progress-label">
            {" "}
            {finishedCount}/{plano.exercicios.length}{" "}
          </span>{" "}
          <div className="progress-bar-container">
            {" "}
            <div
              className={`progress-bar-fill ritmo-${rhythmStatus}`}
              style={{ width: `${percentage}%` }}
            ></div>{" "}
          </div>{" "}
          <span className={`progress-label ritmo-treino ritmo-${rhythmStatus}`}>
            {" "}
            <span className="ritmo-dot"></span> {rhythmStatus.replace("_", " ")}{" "}
          </span>{" "}
        </div>{" "}
      </div>{" "}
      <div className="exercise-list">
        {" "}
        {sortedExercises.map((liveEx) => {
          const exercicioInfo = initialMockData.exercicios_biblioteca.find(
            (libEx) => libEx.id === liveEx.id
          );
          const planoExercicio = plano.exercicios.find(
            (pe) => pe.id === liveEx.id
          );
          console.log("🟡 DEBUG LiveWorkoutView:");
console.log("liveEx.id:", liveEx.id);
console.log("exercicioInfo:", exercicioInfo);
console.log("planoExercicio:", planoExercicio);

          if (!exercicioInfo || !planoExercicio) return null;
          const detailsParts = [];
          if (planoExercicio.series)
            detailsParts.push(
              <span key="series">
                <strong>Séries:</strong> {planoExercicio.series}
              </span>
            );
          if (planoExercicio.repeticoes)
            detailsParts.push(
              <span key="reps">
                <strong>Reps:</strong> {planoExercicio.repeticoes}
              </span>
            );
          if (planoExercicio.carga)
            detailsParts.push(
              <span key="carga">
                <strong>Carga:</strong> {planoExercicio.carga}
              </span>
            );
          if (planoExercicio.observacoes)
            detailsParts.push(
              <span key="obs">
                <strong>Obs:</strong> {planoExercicio.observacoes}
              </span>
            );
          return (
            <div
              key={liveEx.id}
              className={`exercise-item status-${liveEx.status.replace(
                "_",
                "-"
              )}`}
            >
              <div className="exercise-header">
                <h4>{exercicioInfo.nome}</h4>
                <div className="icons">
                  <button
                  className="btn btn-icon"
                  title="Editar"
                  onClick={() => onEditarExercicio(aluno.id, plano.id, liveEx.id)}
                  >
                    {editIcon}
                  </button>
                  <button className="btn btn-icon" title="Excluir">
                    {deleteIcon}
                  </button>
                </div>
              </div>
              <div className="exercise-details">
                {detailsParts.map((part, index) => (
                  <React.Fragment key={index}>
                    {part} {index < detailsParts.length - 1 && "; "}{" "}
                  </React.Fragment>
                ))}{" "}
              </div>{" "}
              <div className="exercise-controls">
                {" "}
                {liveEx.status === "nao-iniciado" && (
                  <button
                    className="btn-exercise-status start"
                    onClick={() => onUpdateExercise(liveEx.id, "executando")}
                  >
                    {" "}
                    Iniciar{" "}
                  </button>
                )}{" "}
                {liveEx.status === "executando" && (
                  <button
                    className="btn-exercise-status finish"
                    onClick={() => onUpdateExercise(liveEx.id, "finalizado")}
                  >
                    {" "}
                    Finalizar{" "}
                  </button>
                )}{" "}
                {liveEx.status === "finalizado" && (
                  <div className="exercise-details-finalizado">
                    {" "}
                    Finalizado{" "}
                  </div>
                )}{" "}
              </div>{" "}
            </div>
          );
        })}{" "}
      </div>{" "}
      <div className="workout-actions">
        {" "}
        <button
          className="action-btn btn-finalizar-treino"
          onClick={() => onFinishWorkout(aluno.id)}
        >
          {" "}
          Finalizar Treino{" "}
        </button>{" "}
      </div>{" "}
    </div>
  );
}

function ExerciseDetailsTable({ exercise }: { exercise: ExercicioPlano }) {
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

// ALTERADO: Componente refatorado para o novo layout "Modelo"
function GerenciarPlanosPage({
  aluno,
  activeSession, // LINHA ADICIONADA
  onEditarExercicio,
  onBack,
  onTogglePlanoAtivo,
  onIniciarTreino,
  onEditarPlano,
  onCriarPlano,
  onExcluirPlano,
  onExcluirExercicio, // <-- Receba a nova prop
}: {
  aluno: Aluno;
  onEditarExercicio: (planoId: number, exercicioId: number) => void; // <-- Defina o tipo dela

  activeSession: ActiveSession | null | undefined; // LINHA ADICIONADA
  onBack: () => void;
  onTogglePlanoAtivo: (planoId: number) => void;
  onIniciarTreino: (planoId: number) => void;
  onEditarPlano: (planoId: number) => void;
  onCriarPlano: () => void;
  onExcluirPlano: (planoId: number) => void;
  onExcluirExercicio: (planoId: number, exercicioId: number) => void; // <-- Defina o tipo
}) {
  const [filtroAtivo, setFiltroAtivo] = useState(true);
  const [expandedItems, setExpandedItems] = useState<{
    [key: string]: boolean;
  }>({});

  const toggleExpansion = (id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const planosFiltrados = aluno.planos.filter((p) => p.ativo === filtroAtivo);

  return (
    <div className="container manage-plans-page">
      <header className="page-header">
        {" "}
        {/* ARQUIVO: page.tsx - Refatorando o botão de voltar */}
        <button onClick={onBack} className="back-button">
          {backIcon}
        </button>
        <div className="header-text-container">
          {" "}
          <h1 className="font-montserrat">{aluno.nome}</h1>{" "}
          <h2>Gerenciar Planos de Treino</h2>{" "}
        </div>{" "}
      </header>
      <main>
        <div className="manage-plans-controls">
          <div className="filter-toggle-group">
            <button
              onClick={() => setFiltroAtivo(true)}
              className={filtroAtivo ? "active" : ""}
            >
              Planos Ativos
            </button>
            <button
              onClick={() => setFiltroAtivo(false)}
              className={!filtroAtivo ? "active" : ""}
            >
              Planos Inativos
            </button>
          </div>
        </div>

        <div className="management-plan-list">
          {planosFiltrados.map((plano) => {
            // 1. Bloco de lógica para definir o status
            /* ARQUIVO: page.tsx - Adicionando o status 'indisponivel' */
            
            let planStatus = "inativo"; // Cinza por padrão
            if (plano.ativo) {
              if (activeSession) {
                // Se o aluno já está em um treino...
                if (activeSession.planoId === plano.id) {
                  planStatus = "em-treinamento"; // Laranja para o plano em execução
                } else {
                  planStatus = "indisponivel"; // Cinza para os outros planos ativos
                }
              } else {
                // Se o aluno está livre...
                planStatus = "disponivel"; // Verde para os planos ativos
              }
            }
            // 2. O 'return' explícito que estava faltando
            return (
              <div
                key={plano.id}
                className={`management-plan-accordion plan-status-${planStatus}`}
              >
                <button
                  className="accordion-header-manage"
                  onClick={() => toggleExpansion(`plan-${plano.id}`)}
                  aria-expanded={!!expandedItems[`plan-${plano.id}`]}
                  aria-controls={`plan-content-${plano.id}`} // Opcional, mas boa prática
                >
                  <div className="accordion-title-group">
                    <span> {planIcon}</span>
                    <h3>{plano.nome}</h3>
                  </div>
                  <span
                    className={`chevron ${
                      expandedItems[`plan-${plano.id}`] ? "expanded" : ""
                    }`}
                  >
                    {chevronIcon}
                  </span>
                </button>

                <div className="plan-meta-actions">
                  <span>
                    {plano.exercicios.length}{" "}
                    {plano.exercicios.length === 1 ? "exercício" : "exercícios"}
                  </span>
                </div>

                <div className="card-action-icons">
                  {planStatus === "em-treinamento" ? (
                    // SE o status for 'em-treinamento', renderiza a tag:
                    <span className="status-tag status-tag-em-treinamento">
                      Em Treinamento
                    </span>
                  ) : (
                    // SENÃO, verifica se o status é um dos que devem mostrar o botão:
                    (planStatus === "disponivel" ||
                      planStatus === "indisponivel") && (
                      <button
                        onClick={() => onIniciarTreino(plano.id)}
                        className="btn-start"
                        disabled={planStatus === "indisponivel"}
                        title={
                          planStatus === "indisponivel"
                            ? "Finalize o treino em andamento para iniciar um novo"
                            : "Iniciar Treino"
                        }
                      >
                        Iniciar Treino
                      </button>
                    )
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditarPlano(plano.id);
                    }}
                    className="btn btn-icon"
                    title="Editar Plano"
                  >
                    {editIcon}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePlanoAtivo(plano.id);
                    }}
                    className="btn btn-icon"
                    title={plano.ativo ? "Desativar Plano" : "Ativar Plano"}
                  >
                    {plano.ativo ? deactivateIcon : activateIcon}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onExcluirPlano(plano.id);
                    }}
                    className="btn btn-icon btn-delete"
                    title="Excluir Plano"
                  >
                    {deleteIcon}
                  </button>
                </div>

                <div
                  className={`accordion-content-manage${
                    expandedItems[`plan-${plano.id}`] ? " expanded" : ""
                  }`}
                >
                  {expandedItems[`plan-${plano.id}`] && (
                    <>
                      {plano.exercicios.map((ex) => {
                        const libEx =
                          initialMockData.exercicios_biblioteca.find(
                            (e) => e.id === ex.id
                          );

                        // Criamos um objeto no formato que o ExercicioCard espera
                        const exercicioParaCard: ExercicioComEdicao = {
                          id: ex.id,
                          nome: libEx?.nome || "Exercício",
                          series: ex.series,
                          repeticoes: ex.repeticoes,
                          carga: ex.carga,
                          observacoes: ex.observacoes || "",
                          isEditing: false, // Na tela de Gerenciar, nunca está em modo de edição
                        };
                        return (
                          <ExercicioCard
                            key={exercicioParaCard.id}
                            exercicio={exercicioParaCard}
                            isExpanded={
                              !!expandedItems[
                                `ex-${plano.id}-${exercicioParaCard.id}`
                              ]
                            }
                            // ATENÇÃO: Na tela de Gerenciar Planos, não mostramos os botões
                            showActions={true}
                            onToggleExpansion={() =>
                              toggleExpansion(
                                `ex-${plano.id}-${exercicioParaCard.id}`
                              )
                            }
                            // As funções de onEdit e onDelete não são necessárias aqui
                            onEdit={() => {
                              console.log(
                                `Passo 2: Chamando onEditarExercicio com planoId=${plano.id}, exId=${exercicioParaCard.id}`
                              );
                              onEditarExercicio(plano.id, exercicioParaCard.id);
                            }}
                            onDelete={() =>
                              onExcluirExercicio(plano.id, exercicioParaCard.id)
                            } // <-- ATUALIZE AQUI
                          />
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {planosFiltrados.length === 0 && (
            <p className="nenhum-plano">
              {filtroAtivo ? "Nenhum plano ativo." : "Nenhum plano inativo."}
            </p>
          )}
        </div>
      </main>

      {/* 2. ADICIONE O NOVO BOTÃO FLUTUANTE AQUI */}
      <button
        onClick={() => onCriarPlano()} // A função onCriarPlano já foi passada como prop
        className="fab-create-plan"
        title="Criar Novo Plano"
      >
        {addIcon}
      </button>
    </div>
  );
}
const normalizeString = (str: string) => {
  return str
    .normalize("NFD") // Separa acentos e caracteres base
    .replace(/[\u0300-\u036f]/g, "") // Remove todos os acentos
    .toLowerCase() // Padroniza para minúsculas
    .trim() // Remove espaços no início/fim
    .replace(/\s+/g, " "); // Substitui múltiplos espaços por um único
};

function ExercicioCard({
  exercicio,
  isExpanded,
  showActions,
  onToggleExpansion,
  onEdit,
  onDelete,
  isEditable = false,
  onExercicioChange = () => {},
  onSuggestionSelect,
  validationError
}: ExercicioCardProps) {
  const [suggestions, setSuggestions] = useState<ExercicioBiblioteca[]>([]);
  const [isSearchActive, setIsSearchActive] = useState(false); // <-- NOVO ESTADO AQUI
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fecha a lista de sugestões ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);


const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  onExercicioChange('nome', value);
  setIsSearchActive(value.trim() !== '');
  
  if (value.length > 1) {
    const normalizedSearch = normalizeString(value);
    const filtered = initialMockData.exercicios_biblioteca.filter(ex =>
      normalizeString(ex.nome).includes(normalizedSearch)
    );
    setSuggestions(filtered);
  } else {
    setSuggestions([]);
  }
};

  const handleSuggestionClick = (suggestion: ExercicioBiblioteca) => {

if (onSuggestionSelect) {
    onSuggestionSelect(suggestion); 
  }
    setSuggestions([]);
    setIsSearchActive(false);
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
  <div className="input-group" data-error="exercicioNome" ref={wrapperRef}>
          <label>Nome do Exercício</label>
    <div className="autocomplete-wrapper">
      <input
        value={exercicio.nome}
        onChange={handleSearchChange}
        placeholder="Busque um exercício (ex: Supino)"
        className={validationError?.nome ? "invalid" : ""}
        autoComplete="off"
      />

            {exercicio.nome.trim().length > 1 && isSearchActive && !validationError?.nome && (
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
            <div className="no-results-placeholder">
              Nenhum exercício encontrado
            </div>
          )}
        </div>
      )}
    </div>
            {validationError?.nome && ( // Mensagem de erro
      <span className="error-message">{validationError.nome}</span>
    )}
          </div>
        </div>

        <div className="card-section">
          <div className="exercise-inputs">
            <div className="input-row">
              <div className="input-group">
                <label>Séries</label>
                <input
                  className={validationError?.series ? "invalid" : ""}
                  type="text"
                  value={exercicio.series}
                  onChange={(e) => onExercicioChange("series", e.target.value)}
                />
                  {validationError?.series && (
                  <span className="error-message">{validationError.series}</span>
                  )}
              </div>
              <div className="input-group">
                <label>Reps</label>
                <input
                  className={validationError?.repeticoes ? "invalid" : ""}
                  type="text"
                  value={exercicio.repeticoes}
                  onChange={(e) => onExercicioChange("repeticoes", e.target.value)}
                />
                  {validationError?.repeticoes && (
                  <span className="error-message">{validationError.repeticoes}</span>
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
          <ExerciseDetailsTable exercise={exercicio as ExercicioPlano} />
        </div>
      )}
    </div>
  );
}

function EditExerciseModal({
  exercicio,
  onClose,
  onSave,
}: EditExerciseModalProps) {
  // 1. Estado interno para guardar as MUDANÇAS feitas pelo usuário.
  const [editedExercicio, setEditedExercicio] = useState(exercicio);
  const [errors, setErrors] = useState<ExercicioError>({});
  // 2. Handler para atualizar o estado interno quando o usuário digita.
  const handleInputChange = (campo: keyof ExercicioPlano, valor: string) => {
    // A verificação de segurança agora é no estado interno
    if (!editedExercicio) return;

        if (errors[campo as keyof ExercicioError]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[campo as keyof ExercicioError];
        return newErrors;
      });
    }
    setEditedExercicio({ ...editedExercicio, [campo]: valor });
  };
  const handleSaveClick = () => {
    if (!editedExercicio) return;

    const { isValid, errors: validationErrors } = validateExercicio(editedExercicio);
    setErrors(validationErrors);

    if (isValid) {
      onSave(editedExercicio);
    }
  };
  // 3. Verificação de segurança, como já tínhamos.
  if (!editedExercicio) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Editar Exercício</h2>

        <div
          className="exercise-edit-card"
          style={{ boxShadow: "none", border: "none" }}
        >
          <div className="card-section">
            <h4>
              {
                initialMockData.exercicios_biblioteca.find(
                  (ex) => ex.id === editedExercicio.id
                )?.nome
              }
            </h4>
          </div>

          <div className="card-section">
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
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          {/* 4. O botão Salvar agora envia o estado ATUALIZADO, e não a prop original. */}
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
function PlanoEditView({
  aluno,
  plano,
  onBack,
  onSave,
  onPlanoChange,
  onExercicioChange,
  onAddExercicio,
  onDeleteExercicio,
  onExercicioSelect,
  validationErrors,
  setValidationErrors,
}: PlanoEditViewProps) {


  // 3. ESTADO LOCAL PARA CONTROLAR OS CARDS EXPANDIDOS
  const [expandedItems, setExpandedItems] = useState<{
    [key: string]: boolean;
  }>({});
  const toggleExpansion = (id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  if (!plano) {
    return <div>Carregando plano...</div>;
  }
  return (
    <div className="container plano-edit-page">
      <header className="page-header">
        <button onClick={onBack} className="back-button">
          {backIcon}
        </button>
        <div className="header-text-container">
          <h1 className="font-montserrat">{aluno.nome}</h1>
          <h2>Criar Novo Plano</h2>
        </div>
      </header>
      <main>
        {/* Input para o nome do plano */}
<div className="input-group" data-error="planoNome">
  <label htmlFor="plano-nome">Nome do Plano</label>
  <input
    type="text"
    id="plano-nome"
    value={plano.nome}
    className={validationErrors.planoNome ? "invalid" : ""}
    onChange={(e) => {
      if (validationErrors.planoNome) {
        setValidationErrors(prev => ({ ...prev, planoNome: '' }));
      }
      onPlanoChange("nome", e.target.value);
    }}
    placeholder='Ex: Treino A - Peito e Tríceps'
  />
  {validationErrors.planoNome && (
    <span className="error-message">{validationErrors.planoNome}</span>
  )}
</div>

        <h3 className="exercise-list-title">Exercícios do Plano</h3>

        {/* 4. LOOP .MAP() CORRIGIDO E COMPLETO */}
        <div className="exercise-edit-list">
          {plano.exercicios.map((ex, index) => (
            <ExercicioCard
              key={ex.id}
              exercicio={ex}
              isEditable={true}
                validationError={{
    nome: validationErrors[`exercicios[${index}].nome`],
    series: validationErrors[`exercicios[${index}].series`],
    repeticoes: validationErrors[`exercicios[${index}].repeticoes`]
  }}
              onExercicioChange={(campo, valor) => onExercicioChange(index, campo, valor)}
             onSuggestionSelect={(suggestion) => onExercicioSelect(index, suggestion)} // <<< CONECTANDO A NOVA PROP
              // Props de exclusão e visualização agora estão conectadas
              onDelete={() => onDeleteExercicio(ex.id)}
              isExpanded={!!expandedItems[`ex-${ex.id}`]}
              onToggleExpansion={() => toggleExpansion(`ex-${ex.id}`)}
              showActions={!ex.isEditing} // Mostra ações (editar/deletar do modo visualização) apenas se NÃO estiver em modo de edição
              onEdit={() =>
                alert(
                  "Funcionalidade de editar um exercício existente a ser implementada"
                )
              }
            />
          ))}
        </div>
        <div className="actions-container">
          <button onClick={onAddExercicio} className="card-text-action">
            + Incluir Exercício
          </button>
        </div>
      </main>

 <footer className="form-actions">
<button className="btn btn-save-plan" onClick={() => onSave(plano)}>
  Salvar Plano
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

  // =======================================================
  // >>> NOVA LÓGICA DE IMPORTAÇÃO <<<
  // =======================================================
const handleStartImport = () => {
  if (!selectedFile) return;

  Papa.parse(selectedFile, {
    header: true,
    skipEmptyLines: true,
    complete: (results: Papa.ParseResult<CsvRow>) => {  // <-- Tipagem explícita aqui
      // Validação da coluna Nome
      if (!results.meta.fields || !results.meta.fields.includes("Nome")) {
        alert("Erro: O arquivo deve conter a coluna 'Nome'");
        return;
      }

      // Processamento seguro dos dados
const novosAlunos: Aluno[] = results.data
  .filter((row): row is { Nome: string } => !!row.Nome?.trim())
  .map((row, index) => ({
    id: Date.now() + index,
    nome: row.Nome.trim(), // Agora TS sabe que Nome existe e é string
    status: "disponivel",
    status_timestamp: new Date().toISOString(),
    planos: [],
    pef_responsavel_id: null,
    ritmo: undefined,
    historico: []
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
      <div className="modal-content" style={{ textAlign: 'left', maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
          <h2 className="font-montserrat" style={{ margin: 0 }}>Incluir Alunos via CSV</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
        </div>
        <div>
          <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>
            Selecione um arquivo .csv com uma coluna chamada "Nome".
            <br />
            <a href="/template.csv" download="template_importacao_alunos.csv" style={{ color: 'var(--primary-action-color)', fontWeight: '600' }}>
              Baixe um modelo de arquivo aqui.
            </a>
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-lg) 0' }}>
            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
            <button className="btn btn-secondary" onClick={handleUploadButtonClick}>Escolher arquivo</button>
            <span>{selectedFile ? selectedFile.name : "Nenhum arquivo selecionado"}</span>
          </div>
        </div>
        <div className="modal-actions" style={{justifyContent: 'flex-start', paddingTop: 'var(--space-md)', marginTop: 'var(--space-md)'}}>
          <button className="btn btn-primary" disabled={!selectedFile} onClick={handleStartImport}>
            Iniciar Importação
          </button>
        </div>
      </div>
    </div>
  );
}
//* Helper para formatar a data como "18.jul Sex" */
const formatarDataHistorico = (data: Date): string => {
  const dia = data.getDate();
  const mes = data.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
  const diaSemana = data.toLocaleString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${dia}.${mes} ${diaSemana}`;
};

// Componente para o ícone de status
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


function HistoricoModal({ aluno, onClose }: { aluno: Aluno; onClose: () => void; }) {
  // Lógica para gerar os últimos 30 dias e mesclar com o histórico real
  const historicoCompleto = useMemo(() => {
    const hoje = new Date();
  const ultimos30dias: HistoricoItem[] = [];
    
    for (let i = 0; i < 30; i++) {
      const dataIteracao = new Date();
      dataIteracao.setDate(hoje.getDate() - i);
      
      const treinoDoDia = aluno.historico?.find(
        h => new Date(h.data).toDateString() === dataIteracao.toDateString()
      );

      if (treinoDoDia) {
        ultimos30dias.push(treinoDoDia);
      } else {
        // Se não houve treino, cria um item placeholder
        ultimos30dias.push({
          id: dataIteracao.getTime(),
          data: dataIteracao.toISOString(),
          planoId: 0,
          nomePlano: 'Não houve treino',
          status: 'nao-realizado',
        });
      }
    }
    return ultimos30dias;
  }, [aluno.historico]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ textAlign: 'left', maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="font-montserrat" style={{ margin: 0 }}>Histórico de Treinos</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
        </div>
        <p style={{marginTop: 'var(--space-sm)', color: 'var(--text-secondary)', fontWeight: '600', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-md)'}}>{aluno.nome}</p>
        
        {/* Lista de Histórico */}
        <ul className="historico-lista">
          {historicoCompleto.map((item: HistoricoItem) => (
            <li key={item.id} className={`historico-item status--${item.status}`}>
              <div className="historico-info">
                <span className="historico-data">{formatarDataHistorico(new Date(item.data))}</span>
                <span className="historico-plano">{item.nomePlano}</span>
              </div>
              <div className="historico-status">
                <StatusIcon status={item.status} />
                <span className="historico-status-texto">{item.status.replace('-', ' ')}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
// =======================================================
// 4. SEU COMPONENTE PRINCIPAL 'Page' FICA POR ÚLTIMO
// =======================================================
export default function Page() {
  const [alunos, setAlunos] = useState<Aluno[]>(
    JSON.parse(JSON.stringify(initialMockData.alunos))
  );
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [view, setView] = useState<{
    type:
      | "dashboard"
      | "select_plan"
      | "workout"
      | "gerenciar_planos"
      | "editar_plano";
    alunoId: number | null;
}>({ type: "dashboard", alunoId: null });
  const [statusFilter, setStatusFilter] = useState("todos");
  const [nameFilter, setNameFilter] = useState("");
  const [alunoEmEdicao, setAlunoEmEdicao] = useState<Aluno | null>(null);
  const [planoEmEdicao, setPlanoEmEdicao] = useState<Plano | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  useEffect(() => {
  console.log("📦 useEffect de criação de sessões executado");
  console.log("alunos no momento:", alunos);
    const initialSessions: ActiveSession[] = [];
    alunos.forEach((aluno) => {
      if (aluno.status === "em_treinamento") {
        const primeiroPlanoAtivo = aluno.planos.find((p) => p.ativo);
        if (primeiroPlanoAtivo) {
          initialSessions.push({
            alunoId: aluno.id,
            planoId: primeiroPlanoAtivo.id,
            startTime: aluno.status_timestamp,
            exercises: primeiroPlanoAtivo.exercicios.map((ex) => ({
              id: ex.id,
              status: "nao-iniciado",
            })),
          });
        }
      }
    });
    setActiveSessions(initialSessions);
  }, [alunos]);
  useEffect(() => {
    const rhythmInterval = setInterval(() => {
      console.log("🌀 setInterval de ritmo executando...");
console.log("ActiveSessions atuais:", activeSessions);
console.log("Alunos atuais:", alunos.map(a => ({
  id: a.id,
  nome: a.nome,
  status: a.status,
  ritmo: a.ritmo
})));
      setActiveSessions((currentSessions) => {
        if (currentSessions.length === 0) return currentSessions;
        const rhythmUpdates = currentSessions.map((session) => {
          const exercisesFinished = session.exercises.filter(
            (e) => e.status === "finalizado"
          ).length;
          const aluno = alunos.find((a) => a.id === session.alunoId);
          const plano = aluno?.planos.find((p) => p.id === session.planoId);
          const totalExercises = plano ? plano.exercicios.length : 0;
          const newRhythm = calculateRhythm(
            new Date(session.startTime),
            exercisesFinished,
            totalExercises
          );
          return { alunoId: session.alunoId, newRhythm };
        });
        setAlunos((currentAlunos) =>
          currentAlunos.map((aluno) => {
            const update = rhythmUpdates.find((u) => u.alunoId === aluno.id);
            if (
              update &&
              aluno.pef_responsavel_id &&
              aluno.ritmo !== update.newRhythm
            ) {
              return { ...aluno, ritmo: update.newRhythm };
            }
            return aluno;
          })
        );
        return currentSessions;
      });
    }, 1000);
    return () => clearInterval(rhythmInterval);
  }, []);
  const [exercicioEmEdicao, setExercicioEmEdicao] = useState<{
    alunoId: number;
    planoId: number;
    exercicio: ExercicioComEdicao;
  } | null>(null);
// INCLUIR DENTRO DO COMPONENTE 'Page', JUNTO COM OS OUTROS ESTADOS

// Controla a visibilidade do menu de 3 pontos no cabeçalho
const [isHeaderMenuOpen, setHeaderMenuOpen] = useState(false);

// Controla a visibilidade do modal de upload de CSV
const [isUploadModalOpen, setUploadModalOpen] = useState(false);
const [alunoParaVerHistorico, setAlunoParaVerHistorico] = useState<Aluno | null>(null);
// INCLUIR DENTRO DO COMPONENTE 'Page'
  useEffect(() => {
    console.log('ESTADO DA VIEW ATUALIZADO PARA:', view);
  }, [view]);
const headerMenuRef = useRef<HTMLDivElement>(null);
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

  const handleUpdateStatus = useCallback(
    (
      event: React.MouseEvent<HTMLButtonElement> | null,
      alunoId: number,
      newStatus: Aluno["status"],
      pefId: number | null = null
    ) => {
      setAlunos((currentAlunos) =>
        currentAlunos.map((aluno) => {
          if (aluno.id !== alunoId) return aluno;
          const updatedAluno = { ...aluno };
          if (aluno.status !== newStatus) {
            updatedAluno.status = newStatus;
            updatedAluno.status_timestamp = new Date().toISOString();
          }
          if (newStatus === "em_treinamento") {
            updatedAluno.pef_responsavel_id = pefId;
            if (aluno.status !== "em_treinamento") {
              updatedAluno.ritmo = "no_ritmo";
            }
          } else if (newStatus === "disponivel") {
            updatedAluno.pef_responsavel_id = null;
            updatedAluno.ritmo = undefined;
          }
          return updatedAluno;
        })
      );
    },
    []
  ); // <-- Array de dependências vazio

  const handleNavigateToWorkout = useCallback(
    (alunoId: number) => {
      console.log('Botão Iniciar Treino clicado para o aluno:', alunoId); // <-- ADICIONE ESTA LINHA

      const aluno = alunos.find((a) => a.id === alunoId)!;
      if (aluno.status === "em_treinamento") {
        setView({ type: "workout", alunoId: alunoId });
        return;
      }
      const planosAtivos = aluno.planos.filter((p) => p.ativo);
      if (planosAtivos.length > 0) {
        setView({ type: "select_plan", alunoId: alunoId });
      } else {
        alert("Este aluno não possui planos de treino ativos!");
      }
    },
    [alunos] // <-- Array de dependências com 'alunos'
  );
const handlePlanSelected = useCallback(
    (alunoId: number, planoId: number) => {
      debugger;
      const aluno = alunos.find((a) => a.id === alunoId);
      const plano = aluno?.planos.find((p) => p.id === planoId);
      if (!aluno || !plano) {
        alert("Erro: Aluno ou Plano não encontrado.");
        return;
      }
      const newSession: ActiveSession = {
        alunoId,
        planoId,
        startTime: new Date().toISOString(),
        exercises: plano.exercicios.map((ex) => ({
          id: ex.id,
          status: "nao-iniciado",
        })),
      };
      setActiveSessions((prev) => [
        ...prev.filter((s) => s.alunoId !== alunoId),
        newSession,
      ]);
      handleUpdateStatus(null, alunoId, "em_treinamento", pefLogado.id);
      console.log('Tudo pronto! Navegando para a tela de workout para o aluno:', alunoId);

      setView({ type: "workout", alunoId: alunoId });
    },
    [alunos, handleUpdateStatus, setActiveSessions, setView]
  );

  const handleUpdateExerciseStatus = useCallback(
    (
      alunoId: number,
      exerciseId: number,
      newStatus: LiveExercise["status"]
    ) => {
      setActiveSessions((currentSessions) =>
        currentSessions.map((session) => {
          if (session.alunoId !== alunoId) return session;

          const updatedExercises = session.exercises.map((ex) => {
            // Se for o exercício que queremos mudar o status
            if (ex.id === exerciseId) {
              // Criamos um novo objeto e garantimos que ele seja do tipo LiveExercise
              const updatedExercise: LiveExercise = {
                ...ex,
                status: newStatus,
              };
              return updatedExercise;
            }
            // Se estamos iniciando um novo exercício, o anterior que estava 'executando' volta para 'nao-iniciado'
            if (newStatus === "executando" && ex.status === "executando") {
              const updatedExercise: LiveExercise = {
                ...ex,
                status: "nao-iniciado",
              };
              return updatedExercise;
            }
            return ex;
          });

          // Também garantimos que o objeto de sessão atualizado mantenha seu tipo
          const updatedSession: ActiveSession = {
            ...session,
            exercises: updatedExercises,
          };
          return updatedSession;
        })
      );
    },
    []
  ); // <-- Array de dependências vazio
const handleFinishWorkout = useCallback(
  (alunoId: number) => {
    // 1. Encontrar a sessão ativa e os dados do aluno/plano correspondentes.
    const sessaoFinalizada = activeSessions.find(s => s.alunoId === alunoId);
    const alunoParaAtualizar = alunos.find(a => a.id === alunoId);

    if (sessaoFinalizada && alunoParaAtualizar) {
      const planoExecutado = alunoParaAtualizar.planos.find(p => p.id === sessaoFinalizada.planoId);

      if (planoExecutado) {
        // 2. Determinar o status do treino (completo ou incompleto).
        const totalExercicios = planoExecutado.exercicios.length;
        const exerciciosFeitos = sessaoFinalizada.exercises.filter(
          (ex) => ex.status === "finalizado"
        ).length;

        // Regra: se todos os exercícios foram feitos, o treino foi completo.
        const statusFinal = totalExercicios === exerciciosFeitos ? 'completo' : 'incompleto';

        // 3. Criar o novo item para o histórico.
        const novoHistoricoItem: HistoricoItem = {
          id: Date.now(),
          data: new Date().toISOString(),
          planoId: planoExecutado.id,
          nomePlano: planoExecutado.nome,
          status: statusFinal,
        };

        // 4. Atualizar o estado principal de 'alunos' com o novo histórico.
        setAlunos(alunosAtuais =>
          alunosAtuais.map(aluno => {
            if (aluno.id === alunoId) {
              // Adiciona o novo item ao histórico existente (ou cria um novo array)
              const historicoAtualizado = [...(aluno.historico || []), novoHistoricoItem];
              return { ...aluno, historico: historicoAtualizado };
            }
            return aluno;
          })
        );
      }
    }

    // 5. Lógica original: limpar a sessão ativa e atualizar o status do aluno.
    handleUpdateStatus(null, alunoId, "disponivel", null);
    setActiveSessions((prev) => prev.filter((s) => s.alunoId !== alunoId));
    setView({ type: "dashboard", alunoId: null });
  },
  [activeSessions, alunos, handleUpdateStatus] // <-- Atualizamos as dependências
);

  const handleBackToDashboard = useCallback(
    () => setView({ type: "dashboard", alunoId: null }),
    []
  ); // <-- Array de dependências vazio
  const handleGerenciarPlanos = useCallback((alunoId: number) => {
    setView({ type: "gerenciar_planos", alunoId });
  }, []); // <-- Array de dependências
  const handleTogglePlanoAtivo = useCallback(
    (alunoId: number, planoId: number) => {
      setAlunos((prevAlunos) =>
        prevAlunos.map((aluno) => {
          if (aluno.id === alunoId) {
            const planosAtualizados = aluno.planos.map((plano) =>
              plano.id === planoId ? { ...plano, ativo: !plano.ativo } : plano
            );
            return { ...aluno, planos: planosAtualizados };
          }
          return aluno;
        })
      );
    },
    []
  ); // <-- Array de dependências

  const handleAddExercicio = useCallback(() => {
    // Garante que só funciona se houver um plano em edição
    if (!planoEmEdicao) return;

    // Cria um novo objeto de exercício com valores padrão
    const novoExercicio: ExercicioComEdicao = {
      id: Date.now() + 1,
      nome: "",
      series: "",
      repeticoes: "",
      carga: "",
      observacoes: "",
      isEditing: true,
    };

    // Atualiza o estado, adicionando o novo exercício ao final da lista existente
    setPlanoEmEdicao((planoAtual) => ({
      ...planoAtual!,
      exercicios: [...planoAtual!.exercicios, novoExercicio],
    }));
  }, [planoEmEdicao]);
  // Função para ABRIR o modal de edição
  const handleEditExercicio = useCallback(
    (alunoId: number, planoId: number, exercicioId: number) => {
      console.log(
        `Passo 3: Função principal handleEditExercicio recebendo planoId=${planoId}, exId=${exercicioId}`
      );

      const aluno = alunos.find((a) => a.id === alunoId);
      console.log("Aluno encontrado:", aluno);
      if (!aluno) {
        console.error("FALHA: Aluno não encontrado com o ID:", alunoId);
        return;
      }
      const plano = aluno.planos.find((p) => p.id === planoId);
      if (!plano) {
        console.error("FALHA: Plano não encontrado com o ID:", planoId);
        return;
      }

      const exercicio = plano.exercicios.find((ex) => ex.id === exercicioId);
      console.log("Exercício encontrado:", exercicio);

      if (exercicio) {
        console.log("SUCESSO: Exercício encontrado! Abrindo o modal...");
        // No nosso estado do modal, guardamos o contexto completo
        setExercicioEmEdicao({ alunoId, planoId, exercicio }); // Coloca o exercício no estado, o que vai abrir o modal
        console.log("Exercicio setado no estado", exercicio);
      } else {
        console.error("FALHA: Exercício não encontrado com o ID:", exercicioId);
      }
    },
    [alunos]
  ); // A dependência de 'alunos' está correta
  // Função para FECHAR o modal de edição
  const handleCloseEditModal = useCallback(() => {
    setExercicioEmEdicao(null); // Limpa o estado, o que vai fechar o modal
  }, []); // <-- Array de dependências com 'alunos'

  // Esta é a nova instrução de salvamento que você perguntou
  const handleSaveExercicio = useCallback(
    (exercicioAtualizado: ExercicioComEdicao) => {
      if (!exercicioEmEdicao) return; // Segurança

      const { alunoId, planoId } = exercicioEmEdicao;

      setAlunos((prevAlunos) =>
        prevAlunos.map((aluno) => {
          if (aluno.id === alunoId) {
            const planosAtualizados = aluno.planos.map((plano) => {
              if (plano.id === planoId) {
                const exerciciosAtualizados = plano.exercicios.map((ex) =>
                  ex.id === exercicioAtualizado.id ? exercicioAtualizado : ex
                );
                return { ...plano, exercicios: exerciciosAtualizados };
              }
              return plano;
            });
            return { ...aluno, planos: planosAtualizados };
          }
          return aluno;
        })
      );
      console.log("Salvando alterações do exercício:", exercicioAtualizado);
      handleCloseEditModal();
    },
    [exercicioEmEdicao, handleCloseEditModal]
  ); // <-- Array de dependências
  const handleDeleteExercicio = (
    alunoId: number,
    planoId: number,
    exercicioId: number
  ) => {
    // Passo 1: Confirmar com o usuário, pois é uma ação destrutiva.
    if (
      !confirm(
        "Tem certeza que deseja excluir este exercício do plano? Esta ação não pode ser desfeita."
      )
    ) {
      return; // Se o usuário cancelar, a função para aqui.
    }

    // Passo 2: Atualizar o estado principal 'alunos'.
    setAlunos((alunosAtuais) =>
      alunosAtuais.map((aluno) => {
        // Encontra o aluno correto. Se não for ele, retorna sem mudanças.
        if (aluno.id !== alunoId) {
          return aluno;
        }

        // Se for o aluno correto, atualiza a sua lista de planos.
        const planosAtualizados = aluno.planos.map((plano) => {
          // Encontra o plano correto. Se não for ele, retorna sem mudanças.
          if (plano.id !== planoId) {
            return plano;
          }

          // Se for o plano correto, filtra a lista de exercícios para remover o desejado.
          const exerciciosAtualizados = plano.exercicios.filter(
            (ex) => ex.id !== exercicioId
          );

          // Retorna uma cópia do plano com a lista de exercícios atualizada.
          return { ...plano, exercicios: exerciciosAtualizados };
        });

        // Retorna uma cópia do aluno com a lista de planos atualizada.
        return { ...aluno, planos: planosAtualizados };
      })
    );
  };

  const handleRemoverExercicioDoFormulario = useCallback(
    (exercicioId: number) => {
      if (!planoEmEdicao) return;

      const exerciciosAtualizados = planoEmEdicao.exercicios.filter(
        (ex) => ex.id !== exercicioId
      );

      setPlanoEmEdicao((planoAtual) => ({
        ...planoAtual!,
        exercicios: exerciciosAtualizados,
      }));
    },
    [planoEmEdicao]
  );


  // Handler para os campos do próprio plano (ex: nome do plano)
  const handlePlanoInputChange = useCallback(
    (campo: keyof Plano, valor: string) => {
      if (!planoEmEdicao) return;
    if (validationErrors.planoNome) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.planoNome;
        return newErrors;
      });
    }
      // Atualiza o estado do plano em edição com o novo valor do campo
      setPlanoEmEdicao((planoAtual) => ({
        ...planoAtual!,
        [campo]: valor,
      }));
    },
    [planoEmEdicao, validationErrors]);

  // Handler para os campos de um exercício específico dentro do plano
const handleExercicioInputChange = useCallback(
  (exercicioIndex: number, campo: keyof ExercicioPlano, valor: string | number) => {
      if (!planoEmEdicao) return;
    const errorKey = `exercicios[${exercicioIndex}].${campo}`;
    if (validationErrors[errorKey]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }

    const exerciciosAtualizados = planoEmEdicao.exercicios.map((ex, index) => {
      if (index === exercicioIndex) { // << Correção aplicada
        return { ...ex, [campo]: valor };
      }
      return ex;
    });

    setPlanoEmEdicao((planoAtual) => ({
      ...planoAtual!,
      exercicios: exerciciosAtualizados,
    }));
  },
  [planoEmEdicao, validationErrors]);
  const handleCriarNovoPlano = useCallback((aluno: Aluno) => {
    // 1. Cria um objeto de plano 'em branco' com valores padrão.
  
  //Excluído pra garantir deploy da primeira versão no Vercel
  /*
    const novoExercicio: ExercicioComEdicao = {
      id: Date.now() + 1,
      nome: "",
      series: "",
      repeticoes: "",
      carga: "",
      observacoes: "",
      isEditing: true,
    };*/
    const novoPlano: Plano = {
      id: Date.now(), // Usamos um timestamp como ID temporário
      nome: "", // Começa com o nome em branco
      ativo: true,
      exercicios: [
        {
          id: Date.now() + 1, // ID único temporário
          nome: "",
          series: "",
          repeticoes: "",
          carga: "",
          observacoes: "",
          isEditing: true, // Garante que ele já apareça como um formulário
        },
      ], // Começa sem exercícios
    };

    // 2. Coloca este novo plano no estado de edição.
    setPlanoEmEdicao(novoPlano);
    setAlunoEmEdicao(aluno); // Não se esqueça de guardar o aluno também

    // 3. Navega para a tela de edição.
    setView({ type: "editar_plano", alunoId: aluno.id });
  }, []); // useCallback com dependências vazias, pois não depende de outros estados para criar um plano novo.
const handleAlunosImported = useCallback((novosAlunos: Aluno[]) => {
  // Adiciona os novos alunos à lista existente, evitando duplicatas por ID
  setAlunos(alunosAtuais => {
    const alunosExistentesIds = new Set(alunosAtuais.map(a => a.id));
    const alunosFiltrados = novosAlunos.filter(a => !alunosExistentesIds.has(a.id));
    return [...alunosAtuais, ...alunosFiltrados];
  });
  setUploadModalOpen(false); // Fecha o modal após a importação
}, []);

const handleVerHistorico = useCallback((alunoId: number) => {
  const alunoSelecionado = alunos.find(a => a.id === alunoId);
  if (alunoSelecionado) {
    setAlunoParaVerHistorico(alunoSelecionado);
  }
}, [alunos]);

const handleSavePlano = useCallback(() => {
  // 1. Trava de segurança ÚNICA e eficiente.
  // Se não houver plano ou aluno em edição, interrompe a função.
  // Isso garante ao TypeScript que, no resto da função, eles não são nulos.
  if (!planoEmEdicao || !alunoEmEdicao) return;
  
  // >>> NOVO: VALIDAÇÃO DOS DADOS <<<
  const { isValid, errors } = validatePlano(planoEmEdicao);
  setValidationErrors(errors);
  if (!isValid) {  
     return; // Interrompe o salvamento
  }
  // 2. GUARDA O ID PARA NAVEGAÇÃO
  // Fazemos isso ANTES de limpar o estado, corrigindo o bug anterior.
  const alunoIdParaNavegar = alunoEmEdicao.id;

  // 3. Lógica para diferenciar CRIAÇÃO de EDIÇÃO
  const planoOriginal = alunoEmEdicao.planos.find(p => p.id === planoEmEdicao.id);
  let planosAtualizadosDoAluno: Plano[];

  if (planoOriginal) {
    // Editando: substitui o plano existente
    planosAtualizadosDoAluno = alunoEmEdicao.planos.map(p =>
      p.id === planoEmEdicao.id ? planoEmEdicao : p
    );
  } else {
    // Criando: adiciona o novo plano
    planosAtualizadosDoAluno = [...alunoEmEdicao.planos, planoEmEdicao];
  }

  // 4. ATUALIZA O ESTADO PRINCIPAL
  setAlunos(alunosAtuais =>
    alunosAtuais.map(aluno =>
      aluno.id === alunoEmEdicao.id
        ? { ...aluno, planos: planosAtualizadosDoAluno }
        : aluno
    )
  );

  // 5. LIMPA OS ESTADOS DE EDIÇÃO E NAVEGA
  setPlanoEmEdicao(null);
  setAlunoEmEdicao(null);
  setView({ type: 'gerenciar_planos', alunoId: alunoIdParaNavegar });}, [planoEmEdicao, alunoEmEdicao, setValidationErrors]);

const handleExercicioSelect = useCallback(
  (exercicioIndex: number, suggestion: ExercicioBiblioteca) => {
    if (!planoEmEdicao) return;
    const errorKey = `exercicios[${exercicioIndex}].nome`;
    if (validationErrors[errorKey]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
    const exerciciosAtualizados = planoEmEdicao.exercicios.map((ex, index) => {
      // Encontra o exercício pela sua posição na lista
      if (index === exercicioIndex) {
        // Retorna o exercício atualizado com o NOVO nome e NOVO id
        return {
          ...ex,
          nome: suggestion.nome,
          id: suggestion.id,
        };
      }
      return ex;
    });

    setPlanoEmEdicao((planoAtual) => ({
      ...planoAtual!,
      exercicios: exerciciosAtualizados,
    }));
  },
  [planoEmEdicao, validationErrors]); 

  const onExcluirPlano = useCallback((alunoId: number, planoId: number) => {
    if (
      confirm(
        "Tem certeza que deseja excluir este plano? Esta ação não pode ser desfeita."
      )
    ) {
      setAlunos((prevAlunos) =>
        prevAlunos.map((aluno) => {
          if (aluno.id === alunoId) {
            return {
              ...aluno,
              planos: aluno.planos.filter((p) => p.id !== planoId),
            };
          }
          return aluno;
        })
      );
    }
  }, []); // <-- Array de dependências vazio

  const onEditarPlano = (planoId: number) =>
    alert(`Funcionalidade 'Editar Plano ${planoId}' a ser implementada.`);

  const filteredAlunos = alunos.filter((aluno) => {
    const statusMatch =
      statusFilter === "todos" ||
      (statusFilter === "meus_alunos" &&
        aluno.pef_responsavel_id === pefLogado.id) ||
      aluno.status === statusFilter;
    const nameMatch =
      nameFilter === "" ||
      aluno.nome.toLowerCase().includes(nameFilter.toLowerCase());
    return statusMatch && nameMatch;
  });
  const activeAluno = view.alunoId
    ? alunos.find((a) => a.id === view.alunoId)
    : null;
  const activeSession = activeAluno
    ? activeSessions.find((s) => s.alunoId === activeAluno.id)
    : null;
  let pageContent;
  switch (view.type) {
    case "gerenciar_planos":
      pageContent = activeAluno ? (
        <GerenciarPlanosPage
          aluno={activeAluno}
          activeSession={activeSession} // LINHA ADICIONADA
          onBack={handleBackToDashboard}
          onTogglePlanoAtivo={(planoId) =>
            handleTogglePlanoAtivo(activeAluno.id, planoId)
          }
          onExcluirPlano={(planoId) => onExcluirPlano(activeAluno.id, planoId)}
          onIniciarTreino={(planoId) =>
            handlePlanSelected(activeAluno.id, planoId)
          }
          onEditarPlano={onEditarPlano}
          onEditarExercicio={(planoId, exId) =>
            handleEditExercicio(activeAluno.id, planoId, exId)
          }
          onExcluirExercicio={(planoId, exId) =>
            handleDeleteExercicio(activeAluno.id, planoId, exId)
          }
          onCriarPlano={() => handleCriarNovoPlano(activeAluno)} // AGORA CHAMA A FUNÇÃO NOVA E PASSA O ALUNO
        />
      ) : null;
      break;
    case "editar_plano":
      pageContent =
        activeAluno && planoEmEdicao ? (
          <PlanoEditView
            aluno={activeAluno}
            plano={planoEmEdicao} // Passa o plano que está sendo editado
            onPlanoChange={handlePlanoInputChange} // Passa o handler do nome do plano
            onExercicioChange={handleExercicioInputChange} // Passa o handler dos exercícios
            onExercicioSelect={handleExercicioSelect} // <<< CONECTANDO O HANDLER PRINCIPAL
            onAddExercicio={handleAddExercicio}
            onDeleteExercicio={handleRemoverExercicioDoFormulario}
            onBack={() =>
              setView({ type: "gerenciar_planos", alunoId: activeAluno.id })
            }
            onSave={handleSavePlano}
            validationErrors={validationErrors}
            setValidationErrors={setValidationErrors}
          />
        ) : null;
      break;
    case "workout":
      pageContent =
        activeAluno && activeSession ? (
          <LiveWorkoutView
            session={activeSession!}
            aluno={activeAluno}
            onBack={handleBackToDashboard}
            onFinishWorkout={handleFinishWorkout}
            onUpdateExercise={(exerciseId, status) =>
              handleUpdateExerciseStatus(activeAluno.id, exerciseId, status)
            }
            onEditarExercicio={handleEditExercicio}
          />
        ) : null;
      break;
    case "select_plan":
      pageContent = activeAluno ? (
        <SelectPlanView
          aluno={activeAluno}
         onSelectPlan={(event) => {
    const planoId = Number(event.currentTarget.value);
    handlePlanSelected(activeAluno.id, planoId);
}}
          onCancel={handleBackToDashboard}
        />
      ) : null;
      break;
    case "dashboard":
    default:
      pageContent = (
        <div className="container">
          <div id="dashboard-view">
            <header>
              <h1 className="font-montserrat">GymPro</h1>
  
  {/* Container para o menu e as informações do PEF */}
  <div style={{ position: 'relative' }} ref={headerMenuRef}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
      <div id="pef-info">
        <span>{pefLogado.nome}</span> <br />
        <small>
          {pefLogado.is_estagiario ? "Estagiário" : `CREF: ${pefLogado.cref}`}
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
      </div>
    )}
  </div>
</header>
            <main>
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
                      statusFilter === "aguardando" ? "active" : ""
                    }`}
                    onClick={() => setStatusFilter("aguardando")}
                  >
                    Aguardando
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
                  {filteredAlunos.length > 0 ? (
                    filteredAlunos.map((aluno) => (
                      <AlunoCard
                        key={aluno.id}
                        aluno={aluno}
                        onNavigateToWorkout={handleNavigateToWorkout}
                        onUpdateStatus={handleUpdateStatus}
                        onGerenciarPlanos={handleGerenciarPlanos}
                        onVerHistorico={handleVerHistorico} 
                      />
                    ))
                  ) : (
                    <div className="nenhum-aluno">Nenhum aluno encontrado.</div>
                  )}
                </div>
              </div>
            </main>
          </div>
        </div>
      );
      break;
  }

  return (
    <>
      {pageContent}
      {exercicioEmEdicao && (
        <EditExerciseModal
          exercicio={exercicioEmEdicao.exercicio} // Passamos apenas o objeto do exercício
          onClose={handleCloseEditModal}
          onSave={handleSaveExercicio}
        />
      )}
      {/* NOVO: Modal de Upload de CSV (renderização correta) */}
      {isUploadModalOpen && (
        <CsvUploadModal onClose={() => setUploadModalOpen(false)} 
        onImportSuccess={handleAlunosImported}/>
      )}
          {alunoParaVerHistorico && (
      <HistoricoModal 
        aluno={alunoParaVerHistorico} 
        onClose={() => setAlunoParaVerHistorico(null)} 
      />
    )}
    </>
  );
}
