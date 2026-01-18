# GymPro – Digitalizando a Execução do Treino em Academias

O **GymPro** é uma plataforma de gestão e atendimento *mobile-first* dedicada exclusivamente ao Profissional de Educação Física (PEF). Sua missão é digitalizar o atendimento em academias de acompanhamento próximo, substituindo processos físicos por dados acionáveis que elevam a qualidade percebida pelo aluno e a eficiência operacional.

## 🎯 O Problema (Product Discovery)

Através de técnicas de *shadowing* e entrevistas, identifiquei dores críticas no controle manual via fichas de papel:

* **Alta Carga Cognitiva:** Profissionais sobrecarregados ao gerenciar múltiplas fichas físicas simultaneamente.
* **Ineficiência Operacional:** Atrasos na localização de fichas e perda de tempo no registro manual de cargas e ajustes.
* **Falta de Inteligência de Dados:** Ausência de indicadores objetivos para gerir a evolução real do aluno.

## 💡 Hipóteses de Produto

* **H1:** A visibilidade em tempo real do andamento do treino otimiza a gestão de atenção do profissional no salão.
* **H2:** A captura de dados durante a execução gera indicadores de gestão sem esforço adicional.
* **H3:** Uma abordagem *mobile-first* garante a adesão do profissional que atua em constante movimento.

## 🏗️ Arquitetura e Decisões Técnicas (MVP)

Como PM, estabeleci diretrizes para suportar **10 professores atendendo 5 alunos simultaneamente** (50 sessões ativas com média de 15 exercícios cada):

* **Stack Estratégica:** Next.js (App Router) e Supabase (PostgreSQL) para garantir sincronização *real-time* e baixo custo operacional.
* **Segurança e Governança:** Implementação de **Row Level Security (RLS)** para proteção de dados e **Server-side validation** para regras críticas, como a unicidade de CPFs.
* **Resiliência de Dados:** Estratégia de **Soft Delete** em registros críticos para assegurar a preservação do histórico de evolução do aluno.

## 📏 Regras de Negócio Implementadas

* **Gestão de Sessão:** Treinos tratados como "Sessões Ativas" (janela média de 60 min), permitindo alternância entre alunos sem perda de estado.
* **Cálculo de Ritmo (Pace):** Lógica para registro de ritmo de treino e histórico de cargas para análise de progressão de volume.
* **Validação de Fluxo:** Garantia de que o status do treino seja atualizado instantaneamente entre o professor e o sistema.

## 🛣️ Metodologia e Qualidade (DoD)

O desenvolvimento segue um rigoroso critério de **Definition of Done (DoD)**:

1. **Discovery:** Mapeamento da dor do usuário principal (PEF).
2. **Design & UI:** Prototipagem focada em usabilidade "mão na massa" (mobile-first).
3. **Data Model:** Modelagem de esquemas no Supabase que suportem a carga operacional prevista.
4. **Deploy & QA:** Validação de fluxos ponta a ponta em ambiente de produção (Vercel).

## 🚀 Demonstração e Acesso

* **Link do App:** [https://gympro-seven.vercel.app](https://gympro-seven.vercel.app)
* **Status:** MVP - Em evolução contínua.

### 🧪 Guia para Recrutadores

1. Acesse o link e explore a interface otimizada para dispositivos móveis.
2. Observe a minimização de cliques para o registro de carga e ritmo, priorizando a dinâmica do treino ao vivo.

---

## 🤝 Contato

Este projeto demonstra minha capacidade de unir visão de negócio, UX e governança técnica.

* **GitHub:** [rodrigomacedo07](https://github.com/rodrigomacedo07)
* **Portfolio:** [Acesse meu Case Completo](https://portfolio-rm7.lovable.app/case/gympro)
