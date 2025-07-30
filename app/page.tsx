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
/*import debounce from 'lodash.debounce';*/

// =======================================================
// 2. DEFINIÇÕES DE TIPOS (INTERFACES)
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
interface PEF {
  id: number;
  nome: string;
  is_estagiario: boolean;
  cref: string | null;
  roles: ('admin' | 'pef')[];
  status: 'ativo' | 'inativo';
  cpf: string;
}
interface ExercicioBiblioteca {
  id: number;
  nome: string;
}
interface CsvRow {
  Nome?: string; // Coluna obrigatória
  // Adicione outras colunas se necessário
}
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
  index: number
  exercicio: ExercicioComEdicao;
  isExpanded: boolean;
  showActions: boolean;
  onToggleExpansion: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isEditable?: boolean;
  onExercicioChange?: (campo: keyof ExercicioPlano, valor: string | number) => void;
  onSuggestionSelect?: (suggestion: ExercicioBiblioteca) => void;
  validationErrors?: Record<string, string>;
  suggestions: ExercicioBiblioteca[];
  isSearchActive: boolean;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
// =======================================================
// 3. CONSTANTES E FUNÇÕES AUXILIARES
// =======================================================

/* --- ÍCONES (SVG) --- */
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

/* --- FUNÇÕES UTILITÁRIAS PURAS --- */
const timeAgoFn = (minutes: number) =>new Date(new Date().getTime() - minutes * 60000).toISOString();

const calculateTimeAgo = (timestamp: string): string => {
      const now = new Date();
      const past = new Date(timestamp);
      const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
      if (diffInSeconds < 0) return "";

      const minutes = Math.floor(diffInSeconds / 60);
      const hours = Math.floor(minutes / 60);

      if (hours > 0) return `há ${hours}h ${minutes % 60}m`;
      if (minutes > 0) return `há ${minutes}m`;
      return "agora";
};
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
function calculateRhythm(
  startTime: Date,
  exercisesStarted: number,
  totalExercises: number
): "no_ritmo" | "atrasado" {
  const RHYTHM_TOLERANCE_MARGIN = 0.2;
  const WORKOUT_DURATION_MINUTES = 60;
  const timeElapsedMs = new Date().getTime() - startTime.getTime();
  const timeElapsedMinutes = timeElapsedMs / (1000 * 60);
  if (
    timeElapsedMinutes < 1 ||
    totalExercises === 0
  ) {
    return "no_ritmo";
  }
  const timeRatio = timeElapsedMinutes / WORKOUT_DURATION_MINUTES;
  const exerciseRatio = exercisesStarted / totalExercises;

console.log(
  `🧠 Ritmo calculado → exercícios: ${exercisesStarted}/${totalExercises}, ` +
  `tempo: ${timeElapsedMinutes.toFixed(2)}min, ` +
  `timeRatio: ${timeRatio.toFixed(2)}, ` +
  `exerciseRatio: ${exerciseRatio.toFixed(2)}, ` +
  `status: ${timeRatio > exerciseRatio + RHYTHM_TOLERANCE_MARGIN ? 'atrasado' : 'no_ritmo'}`
);

  if (timeRatio > exerciseRatio + RHYTHM_TOLERANCE_MARGIN) {
    return "atrasado";
  }
  return "no_ritmo";
}
/* --- DADOS MOCKADOS --- */
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
    {
  id: 999,
  nome: "Teste Rápido",
  status: "em_treinamento",
  status_timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // começou há 5min
  pef_responsavel_id: 1,
  ritmo: "no_ritmo",
  planos: [
    {
      id: 1,
      nome: "Plano Mock",
      ativo: true,
      exercicios: [
        { id: 101, nome: "Supino", series: 3, repeticoes: "10", carga: "50", observacoes: "" },
        { id: 102, nome: "Agachamento", series: 3, repeticoes: "12", carga: "60", observacoes: "" },
        { id: 103, nome: "Remada", series: 3, repeticoes: "10", carga: "45", observacoes: "" },
        { id: 104, nome: "Tríceps", series: 3, repeticoes: "10", carga: "30", observacoes: "" },
        { id: 105, nome: "Rosca", series: 3, repeticoes: "12", carga: "25", observacoes: "" },
      ],
    },
  ],
}
  ],
} as const;

/* --- FUNÇÕES DE VALIDAÇÃO PURAS --- */
const validateExercicio = (): { isValid: boolean; errors: ExercicioError } => {
  const errors: ExercicioError = {};

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
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
// 4. COMPONENTE PRINCIPAL (PAGE)
// =======================================================
export default function Page() {
  /* --- ESTADOS PRINCIPAIS DE DADOS --- */
const [alunos, setAlunos] = useState<Aluno[]>(JSON.parse(JSON.stringify(initialMockData.alunos)));
const [treinadores, setTreinadores] = useState<PEF[]>(
initialMockData.treinadores.map(pef => {
  // Lógica para definir os papéis iniciais
  const roles: ('admin' | 'pef')[] = ['pef']; // Todos são PEFs por padrão
  if (pef.id === 1) {
    roles.push('admin'); // Apenas Carlos Andrade (ID 1) é admin
  }

  return {
    ...pef,
    roles: roles,
    status: 'ativo',
    cpf: `000.000.000-${pef.id.toString().padStart(2, '0')}`, // CPF de exemplo para teste
  };
}));
const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);

/* --- ESTADOS DE UI (Controle de Visão e Filtros) --- */
const [view, setView] = useState<{type:| "dashboard" | "select_plan"| "workout" | "gerenciar_planos" | "editar_plano" |"gerenciar_perfis";alunoId: number | null;}>({ type: "dashboard", alunoId: null });
const [statusFilter, setStatusFilter] = useState("todos");
const [nameFilter, setNameFilter] = useState("");
const [pefFilter, setPefFilter] = useState('ativo');
const [pefSearch, setPefSearch] = useState('') 

/* --- ESTADOS DE UI (Controle de Modais e Menus) --- */
const [alunoEmEdicao, setAlunoEmEdicao] = useState<Aluno | null>(null);
const [planoEmEdicao, setPlanoEmEdicao] = useState<Plano | null>(null);
const [pefEmEdicao, setPefEmEdicao] = useState<PEF | null>(null);
const [openAlunoMenuId, setOpenAlunoMenuId] = useState<number | null>(null);
const [exercicioEmEdicao, setExercicioEmEdicao] = useState<{
alunoId: number;
planoId: number;
exercicio: ExercicioComEdicao;
} | null>(null);
const [isHeaderMenuOpen, setHeaderMenuOpen] = useState(false);// Controla a visibilidade do menu de 3 pontos no cabeçalho
const [isUploadModalOpen, setUploadModalOpen] = useState(false);// Controla a visibilidade do modal de upload de CSV
const [alunoParaVerHistorico, setAlunoParaVerHistorico] = useState<Aluno | null>(null);
const [activeTrainingTime, setActiveTrainingTime] = useState<string>('');

const [timeAgoToDisplay, setTimeAgoToDisplay] = useState<Record<number, string>>({});
const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
const headerMenuRef = useRef<HTMLDivElement>(null);
 
    
  /* --- ESTADOS DERIVADOS E Refs --- */
const activeAluno = view.alunoId ? alunos.find((a) => a.id === view.alunoId) : null;
const activeSession = activeAluno ? activeSessions.find((s) => s.alunoId === activeAluno.id) : null;
const pefLogado = treinadores.find(p => p.id === 1)as PEF;


  /* --- EFEITOS COLATERAIS (useEffect) --- */
useEffect(() => {
  const updateAllTimers = () => {
    // Atualiza os timers dos cards de aluno
    const newTimes: Record<number, string> = {};
    alunos.forEach(aluno => {
      newTimes[aluno.id] = calculateTimeAgo(aluno.status_timestamp);
    });
    setTimeAgoToDisplay(newTimes);
  };

  const activeSession = activeSessions.find(s => s.alunoId === view.alunoId);
if (activeSession) {
  setActiveTrainingTime(calculateTimeAgo(activeSession.startTime));
}

    // Atualiza o timer da sessão de treino ativa
  updateAllTimers(); // Roda uma vez imediatamente
  const intervalId = setInterval(updateAllTimers, 60000); // E depois a cada minuto

  return () => clearInterval(intervalId);
}, [alunos, activeSessions, view.alunoId]);
useEffect(() => {
console.log("📦 useEffect de criação de sessões executado");
console.log("alunos no momento:", alunos);

setActiveSessions((prevSessions) => {
  const updatedSessions = [...prevSessions];

  alunos.forEach((aluno) => {
    const jaExisteSessao = prevSessions.some(
      (s) => s.alunoId === aluno.id
    );
if (jaExisteSessao) {
console.log(`🔁 Sessão já existe para aluno ${aluno.id}, não será recriada.`);
}

    if (!jaExisteSessao && aluno.status === "em_treinamento") {
      const primeiroPlanoAtivo = aluno.planos.find((p) => p.ativo);
      if (primeiroPlanoAtivo) {
        updatedSessions.push({
          alunoId: aluno.id,
          planoId: primeiroPlanoAtivo.id,
          startTime: aluno.status_timestamp,
          exercises: primeiroPlanoAtivo.exercicios.map((ex) => ({
            id: ex.id,
            status: "nao-iniciado",
          })),
        });console.log(`✅ Sessão criada para aluno ${aluno.id}`);
      }
      }
  });

  return updatedSessions;
});
}, [alunos]);
useEffect(() => {
  console.log('ESTADO DA VIEW ATUALIZADO PARA:', view);
}, [view]);
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
  const rhythmInterval = setInterval(() => {
    // A lógica agora acessa o estado DIRETAMENTE, não mais as refs.
    if (activeSessions.length === 0) return;

    const rhythmUpdates = activeSessions.map((session) => {
      const exercisesStarted = session.exercises.filter(
        (e) => ["executando", "finalizado"].includes(e.status)
      ).length;

      const aluno = alunos.find((a) => a.id === session.alunoId);
      const plano = aluno?.planos.find((p) => p.id === session.planoId);
      const totalExercises = plano ? plano.exercicios.length : 0;

      const newRhythm = calculateRhythm(
        new Date(session.startTime),
        exercisesStarted,
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
  }, 1000); // Roda a cada segundo para um feedback de ritmo mais rápido

  // Limpa o intervalo quando o componente é desmontado
  return () => clearInterval(rhythmInterval);

}, [alunos, activeSessions]); // <<< Array de dependências CORRETO

/* --- HANDLERS E CALLBACKS (useCallback) --- */
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
const onEditarPlano = useCallback((planoId: number) => {
  // Trava de segurança para garantir que temos um aluno ativo na view.
  // A variável 'activeAluno' já existe no escopo do nosso componente 'Page'.
  if (!activeAluno) {
    console.error("Erro: Tentativa de editar um plano sem um aluno ativo na visão.");
    return;
  }

  const planoOriginal = activeAluno.planos.find(p => p.id === planoId);
  if (!planoOriginal) {
    console.error(`Erro: Plano com ID ${planoId} não encontrado para o aluno ${activeAluno.nome}.`);
    return;
  }

  // Transforma os dados do plano para o formato que a tela de edição espera.
  const planoEnriquecidoParaEdicao = {
    ...planoOriginal,
    exercicios: planoOriginal.exercicios.map(ex => {
      const nomeExercicio = initialMockData.exercicios_biblioteca.find(libEx => libEx.id === ex.id)?.nome || 'Exercício não encontrado';
      return {
        ...ex,
        nome: nomeExercicio,
        observacoes: ex.observacoes || "",
        isEditing: true
      };
    })
  };

  // Carrega os estados de edição com os dados já enriquecidos.
  setAlunoEmEdicao(activeAluno);
  setPlanoEmEdicao(planoEnriquecidoParaEdicao);

  // Muda a view para a tela de edição.
  setView({ type: "editar_plano", alunoId: activeAluno.id });
}, [activeAluno]); // <<< Array de dependências 
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
      alert("Este aluno não possui sessão de treino ativa!");
    }
  },
  [alunos] // <-- Array de dependências com 'alunos'
);
const handlePlanSelected = useCallback(
  (alunoId: number, planoId: number) => {
    if (!pefLogado) {
    console.error("Ação não permitida: usuário não está logado.");
    return;
  }
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
  [alunos, pefLogado, handleUpdateStatus, setActiveSessions, setView]
);
const handleUpdateExerciseStatus = useCallback((
  alunoId: number,
  exerciseId: number,
  newStatus: LiveExercise["status"]
) => {
  setActiveSessions((currentSessions) =>
    currentSessions.map((session) => {
      if (session.alunoId !== alunoId) return session;

      const updatedExercises = session.exercises.map((ex) => {
        if (ex.id === exerciseId) {
          const updatedExercise: LiveExercise = { ...ex, status: newStatus };
          return updatedExercise;
        }
        if (newStatus === "executando" && ex.status === "executando") {
          const updatedExercise: LiveExercise = { ...ex, status: "nao-iniciado" };
          return updatedExercise;
        }
        return ex;
      });

      const updatedSession: ActiveSession = {
        ...session,
        exercises: updatedExercises,
      };
      return updatedSession;
    })
  );
}, []);
const handleDeleteExerciseFromSession = useCallback((alunoId: number, exerciseId: number) => {
  // Confirmação com o usuário antes de proceder.
  if (!window.confirm("Tem certeza que deseja remover este exercício do treino de hoje?")) {
    return; // Interrompe a função se o usuário clicar em "Cancelar".
  }

  setActiveSessions(currentSessions =>
    currentSessions.map(session => {
      // Encontra a sessão do aluno correto.
      if (session.alunoId === alunoId) {
        // Filtra a lista de exercícios, mantendo apenas os que NÃO têm o ID a ser removido.
        const updatedExercises = session.exercises.filter(
          ex => ex.id !== exerciseId
        );

        // Retorna a sessão com a lista de exercícios atualizada.
        return { ...session, exercises: updatedExercises };
      }

      // Para todas as outras sessões, retorna sem alteração.
      return session;
    })
  );
}, []);
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
const handleDeleteExercicio = useCallback((
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
}, []);
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
  
  // >>> NOVO: VALIDAÇÃO DOS DADOS <<<,,
  const {isValid, errors} = validatePlano(planoEmEdicao);
  setValidationErrors(errors);
if (!isValid) {
  // Coleta e organiza os erros para exibir no alerta
const mensagens = Object.values(errors).map((msg) => `• ${msg}`);
  const listaDeErros = mensagens.join('\n');

  alert(`🚫 O plano contém erro(s) e não pode ser salvo:\n\n${listaDeErros}`);
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

    // Verifica se o exercício já foi adicionado (ignora o índice atual)
    const isDuplicado = planoEmEdicao.exercicios.some((ex, idx) => {
      return idx !== exercicioIndex && ex.id === suggestion.id;
    });

    if (isDuplicado) {
      setValidationErrors((prev) => ({
        ...prev,
        [errorKey]: `${suggestion.nome} já está em outro card. Escolha outro exercício ou exclua o card.`,
      }));
      return; // Não atualiza o exercício duplicado
    }

    // Se não for duplicado, remove erro (caso exista) e atualiza
    if (validationErrors[errorKey]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }

    const exerciciosAtualizados = planoEmEdicao.exercicios.map((ex, index) => {
      if (index === exercicioIndex) {
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
  [planoEmEdicao, validationErrors]
);
const handleOpenEditPefModal = useCallback((pef: PEF) => {
  setPefEmEdicao(pef);
}, []);
const handleUpdatePef = useCallback((pefAtualizado: PEF) => {
  setTreinadores(treinadoresAtuais =>
    treinadoresAtuais.map(p => (p.id === pefAtualizado.id ? pefAtualizado : p))
  );
  setPefEmEdicao(null); // Fecha o modal
}, []);
const handleTogglePefStatus = useCallback((pefId: number) => {
  setTreinadores(treinadoresAtuais =>
    treinadoresAtuais.map(pef => {
      if (pef.id === pefId) {
        // Se encontrarmos o PEF, invertemos seu status
        const novoStatus = pef.status === 'ativo' ? 'inativo' : 'ativo';
        return { ...pef, status: novoStatus };
      }
      return pef;
    })
  );
}, []);
const handleResetPassword = useCallback((pefNome: string) => {
  // 1. Confirmação robusta com o usuário (UX - Prevenção de Erros [Nielsen #5])
  const confirmacao = window.confirm(
    `A senha atual de '${pefNome}' será invalidada permanentemente. Deseja gerar uma nova senha?`
  );

  if (confirmacao) {
    // 2. Geração de uma senha aleatória simples (em um caso real, usaríamos uma biblioteca de criptografia)
    const novaSenha = Math.random().toString(36).slice(-8);

    // 3. Exibição da nova senha e instrução para o admin (UX - Visibilidade do Status do Sistema [Nielsen #1])
    alert(
      `Nova senha para '${pefNome}':\n\n${novaSenha}\n\nCopie esta senha e envie para o usuário.`
    );
    // Em um sistema real, essa lógica enviaria a nova senha por e-mail e invalidaria a antiga no banco de dados.
    // Como estamos apenas com dados mockados, o alert simula a conclusão do fluxo.
  }
},[]);


   /* ---LÓGICA DE RENDERIZAÇÃO (Estados Derivados)--- */
const filteredAlunos = alunos.filter((aluno) => {
    const statusMatch =
      statusFilter === "todos" ||
      (statusFilter === "meus_alunos" &&
        aluno.pef_responsavel_id === pefLogado?.id) ||
      aluno.status === statusFilter;
    const nameMatch =
      nameFilter === "" ||
      aluno.nome.toLowerCase().includes(nameFilter.toLowerCase());
    return statusMatch && nameMatch;
});
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
            timeInTraining={activeTrainingTime}
            onBack={handleBackToDashboard}
            onFinishWorkout={handleFinishWorkout}
            onUpdateExercise={(exerciseId, status) =>
              handleUpdateExerciseStatus(activeAluno.id, exerciseId, status)
            }
            onEditarExercicio={handleEditExercicio}
            onDeleteExercise={(exerciseId) => 
          handleDeleteExerciseFromSession(activeAluno.id, exerciseId)}

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
              <h1 className="title-app">GymPro</h1>
  
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
            {pefLogado.roles.includes('admin') && (
      <button
        className="menu-item"
        onClick={() => {
          setView({ type: 'gerenciar_perfis', alunoId: null });
          setHeaderMenuOpen(false);
        }}
      >
        Gerenciar Perfis
      </button>
    )}
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
                        timeInStatus={timeAgoToDisplay[aluno.id] || ''}
                        treinadores={treinadores}
                        pefLogado={pefLogado}
                        isMenuOpen={openAlunoMenuId === aluno.id} // <<< CONECTADO
                        onToggleMenu={() => setOpenAlunoMenuId(prevId => prevId === aluno.id ? null : aluno.id)} // <<< CONECTADO
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
            onToggleStatus={() => handleTogglePefStatus(pef.id)}
            onResetPassword={() => handleResetPassword(pef.nome)}
          />
        ))}
    </div>
  </div>
</main>
    </div>
  );
  break;
  }


  if (!pefLogado) {
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
          exercicio={exercicioEmEdicao.exercicio} // Passamos apenas o objeto do exercício
          onClose={handleCloseEditModal}
          onSave={handleSaveExercicio}
        />
      )}
      {/* NOVO: Modal de Upload de CSV (renderização correta) */}
      {isUploadModalOpen && (
        <CsvUploadModal
          onClose={() => setUploadModalOpen(false)} 
          onImportSuccess={handleAlunosImported}
        />
      )}
      {alunoParaVerHistorico && (
        <HistoricoModal 
          aluno={alunoParaVerHistorico} 
          onClose={() => setAlunoParaVerHistorico(null)} 
        />
      )}
      {pefEmEdicao && (
        <PefEditModal
          pef={pefEmEdicao}
          onClose={() => setPefEmEdicao(null)}
          onSave={handleUpdatePef}
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
  timeInStatus,
  treinadores,
  pefLogado,
  isMenuOpen,
  onToggleMenu,
  onUpdateStatus,
  onNavigateToWorkout,
  onGerenciarPlanos,
  onVerHistorico,
}: {
  aluno: Aluno;
  timeInStatus: string;
  treinadores: PEF[];
  pefLogado: PEF;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onUpdateStatus: (
    event: React.MouseEvent<HTMLButtonElement> | null,
    alunoId: number,
    newStatus: Aluno["status"],
    pefId?: number | null
  ) => void;
  onNavigateToWorkout: (alunoId: number) => void;
  onGerenciarPlanos: (alunoId: number) => void;
  onVerHistorico: (alunoId: number) => void;
}) {
    const statusMap = {
    disponivel: "Disponível",
    aguardando: "Aguardando",
    em_treinamento: "Em Treinamento",
  };
    const getPefFullNameById = (id: number) => {
    const pef = treinadores.find((p) => p.id === id); // <<< USE A PROP AQUI
    return pef
      ? `${pef.nome.split(" ")[0]} ${pef.nome.split(" ").slice(-1)[0]}`
      : "N/A";
  };

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
      className="info-card"
      onClick={handleCardClick}
      style={{
        cursor: aluno.status === "em_treinamento" ? "pointer" : "default",
      }}
    >
      {" "}
      <div className="card-header">
        {" "}
        <h3 className="title-card">{aluno.nome}</h3>{" "}
        <div className="card-options-wrapper">
          {" "}
          <button
            className="options-icon"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu();
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
                  }}
              >
                {" "}
                Gerenciar Sessões de Treino{" "}
              </button>{" "}
              <button
                className="menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onVerHistorico(aluno.id);
                }}
              >
                Ver Histórico de Treinos
              </button>
            </div>
          )}{" "}
        </div>{" "}
      </div>{" "}
      <div className="card-body">
        <div className="status-line">
          <span className={`status-tag status-tag-${aluno.status.replace("_", "-")}`}>
            {statusMap[aluno.status]}
          </span>
          <span className="status-timer">⏰ {timeInStatus}</span>
          {aluno.status === "em_treinamento" && aluno.ritmo && (
            <div className={`ritmo-treino ritmo-${aluno.ritmo}`}>
              <span className="ritmo-dot"></span>
              {aluno.ritmo === "no_ritmo" ? "No ritmo" : "Atrasado"}
            </div>
          )}
        </div>

        {aluno.status === "em_treinamento" && (
          <div className="pef-resp">
            Com: <strong>{getPefFullNameById(aluno.pef_responsavel_id!)}</strong>
          </div>
        )}      </div>
      <div className="actions">{renderActions()}</div>{" "}
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
  onToggleStatus: () => void;
  onResetPassword: () => void;
}) {
  const isAtivo = pef.status === 'ativo';

  // Ícone para reset de senha (exemplo, podemos criar um novo se preferir)
  const resetIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11.88V12a8 8 0 1 1-2.9-6.32" />
      <path d="M22 4L12 14.01l-3-3" />
    </svg>
  );

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
        <button onClick={onToggleStatus} className="btn btn-icon" title={isAtivo ? 'Desativar PEF' : 'Ativar PEF'}>
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
  const handleSaveClick = () => {
  // 1. Roda a validação com os dados mais recentes do formulário
  const validationErrors = validatePefData(dadosEditados);
  // 2. Atualiza o estado de erros para exibir ou limpar as mensagens na tela
  setErrors(validationErrors);

  // 3. Se o objeto de erros estiver vazio, chama a função onSave
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
              <label htmlFor="pef-nome">Nome</label>
              <input
                id="pef-nome"
                type="text"
                value={dadosEditados.nome}
                onChange={(e) => handleChange('nome', e.target.value)}
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
          {/* Futuros campos irão aqui dentro do modal-body */}
        </div>

        {/* 3. Usando as Actions Unificadas */}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSaveClick}>Salvar</button>
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
  const planosAtivos = aluno.planos.filter((p) => p.ativo);
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
          {planosAtivos.map((plano) => (
            <button key={plano.id} value={plano.id} onClick={onSelectPlan}>
              {plano.nome}
            </button>
          ))}
          {planosAtivos.length === 0 && (
            <p className="nenhum-plano" style={{textAlign: 'center'}}>Nenhum treino ativo encontrado.</p>
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
  onBack,
  timeInTraining,
  onFinishWorkout,
  onUpdateExercise,
  onEditarExercicio,
  onDeleteExercise,
}: {
  session: ActiveSession;
  aluno: Aluno;
  onBack: () => void;
  timeInTraining: string;
  onFinishWorkout: (alunoId: number) => void;
  onUpdateExercise: (
    exerciseId: number,
    status: LiveExercise["status"]
  ) => void;
    onEditarExercicio: (alunoId: number, planoId: number, exercicioId: number) => void; 
    onDeleteExercise: (exerciseId: number) => void;
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

  return (
    <div className="container workout-view">
      {" "}
      <header className="page-header">
        <div className="header-left">
          <button onClick={onBack} className="back-button">
            {backIcon}
          </button>
        </div>

        <div className="header-text-container">
          <h1 className="title-page">{aluno.nome}</h1>
          <h2 className="subtitle-page">{plano.nome}</h2>
        </div>
      </header>

      {/* 2. O conteúdo específico da sessão agora vive dentro do <main> */}
      <main className="workout-session-details"> {/* Adicionamos uma classe para estilização futura */}
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
            {finishedCount}/{plano.exercicios.length}
          </span>
          <div className="progress-bar-container">
            <div
              className={`progress-bar-fill ritmo-${rhythmStatus}`}
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
          <span className={`progress-label ritmo-treino ritmo-${rhythmStatus}`}>
            <span className="ritmo-dot"></span> {rhythmStatus.replace("_", " ")}
          </span>
        </div>
      </main>
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
                  <button 
                    className="btn btn-icon btn-delete"
                    title="Excluir"
                    onClick={() => onDeleteExercise(liveEx.id)}
                  >
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
          <h1 className="title-page">{aluno.nome}</h1>{" "}
          <h2 className="subtitle-page">Gerenciar Sessões de Treino</h2>{" "}
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
                      {plano.exercicios.map((ex, index) => {
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
                            index={index}
                            exercicio={exercicioParaCard}
                            isExpanded={
                              !!expandedItems[
                                `ex-${plano.id}-${exercicioParaCard.id}`
                              ]
                            }
                            // ATENÇÃO: Na tela de Gerenciar Sessões de Treino, não mostramos os botões
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
                            }
                            suggestions={[]}
                            isSearchActive={false}
                            onSearchChange={() => {}} // <-- ATUALIZE AQUI
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
        title="Criar Nova Sessão de Treino"
      >
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
  suggestions, // <<< NOVA PROP
  isSearchActive, // <<< NOVA PROP
  onToggleExpansion,
  onEdit,
  onDelete,
  onExercicioChange = () => {},
  onSuggestionSelect,
  onSearchChange, // <<< NOVA PROP
}: ExercicioCardProps) { 
  const errorKey = `exercicios[${index}].nome`;

console.log(errorKey, validationErrors)

  const handleSuggestionClick = (suggestion: ExercicioBiblioteca) => {

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
    // Buscamos as informações do exercício na biblioteca para usar no cabeçalho.
  const exercicioInfo = initialMockData.exercicios_biblioteca.find(
    (ex) => ex.id === editedExercicio?.id);
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

    // 1. Usamos a função de validação que JÁ EXISTE para exercícios
    const { isValid, errors: validationErrors } = validateExercicio();
    // 2. Atualizamos o estado de erros
    setErrors(validationErrors);

    // 3. Se for válido, salvamos
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
      <button className="modal-close-btn" onClick={onClose}>&times;</button>
      <div className="modal-header">
        <h2 className="title-modal">Editar Exercício</h2>
        <p className="subtitle-modal">{exercicioInfo?.nome}</p>
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

  const pageTitle = plano.nome ? "Editar Sessão de Treino" : "Criar Nova Sessão de Treino";

  // 3. ESTADO LOCAL PARA CONTROLAR OS CARDS EXPANDIDOS
  const [expandedItems, setExpandedItems] = useState<{
    [key: string]: boolean;
  }>({});

  const [activeSuggestionBoxIndex, setActiveSuggestionBoxIndex] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<ExercicioBiblioteca[]>([]);
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
          <h1 className="title-page">{aluno.nome}</h1>
          <h2 className="subtitle-page">{pageTitle}</h2>
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
            <div key={ex.id} ref={activeSuggestionBoxIndex === index ? exerciseInputRef : null}>
            <ExercicioCard
              index={index}
              exercicio={ex}
              isEditable={true}
              validationErrors={validationErrors}
              suggestions={activeSuggestionBoxIndex === index ? suggestions : []}
              isSearchActive={activeSuggestionBoxIndex === index}
              onSearchChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const value = e.target.value;
                  // 1. Atualiza o valor do input no estado principal
                  onExercicioChange(index, 'nome', value);
                  // 2. Define este card como o ativo para o autocomplete
                  setActiveSuggestionBoxIndex(index);
                  // 3. Busca as sugestões
                  if (value.length > 1) {
                    const normalizedSearch = normalizeString(value);
                    const filtered = initialMockData.exercicios_biblioteca.filter(libEx =>
                      normalizeString(libEx.nome).includes(normalizedSearch)
                    );
                    setSuggestions(filtered);
                  } else {
                    setSuggestions([]);
                  }
                }}
              onSuggestionSelect={(suggestion) => {
                  onExercicioSelect(index, suggestion);
                  // Fecha a caixa de sugestões após a seleção
                  setActiveSuggestionBoxIndex(null);
                }}
              onExercicioChange={(campo, valor) => onExercicioChange(index, campo, valor)}
              onDelete={() => onDeleteExercicio(ex.id)}
              isExpanded={!!expandedItems[`ex-${ex.id}`]}
              onToggleExpansion={() => toggleExpansion(`ex-${ex.id}`)}
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

        <div className="modal-actions">
          {/* O botão agora está dentro do rodapé padrão, alinhado à direita */}
          <button className="btn btn-primary" disabled={!selectedFile} onClick={handleStartImport}>
            Iniciar Importação
          </button>
        </div>

      </div>
    </div>
  );
}
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
      <button className="modal-close-btn" onClick={onClose}>&times;</button>
      <div className="modal-header">
        <h2 className="title-modal">Histórico de Treinos</h2>
        <p className="subtitle-modal">{aluno.nome}</p>
      </div>

      <div className="modal-body">
        {/* A classe .modal-body agora fornecerá o padding necessário ao redor da lista */}
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

      {/* Este modal não precisa de uma seção de .modal-actions, então simplesmente a omitimos. */}

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