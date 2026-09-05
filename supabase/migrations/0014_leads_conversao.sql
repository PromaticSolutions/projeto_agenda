-- Agenda Online — Promatic Solutions
-- Migração 0014: o lead vira captura comercial, não questionário.
-- Rode depois de 0001..0013.
--
-- POR QUE MUDA:
-- a 0013 foi desenhada para uma pesquisa de mercado de nove etapas, e exigia
-- todas as respostas (`not null`). O formulário passou a ser um convite
-- comercial de cinco campos — nome, negócio, profissão, WhatsApp e e-mail —,
-- e o resto do contexto é coletado DEPOIS do envio, em perguntas opcionais.
--
-- Sem esta migração, um lead que só preencheu os cinco campos seria recusado
-- pelo banco. E é justamente esse lead que interessa: quem chega ao fim do
-- funil não pode esbarrar em campo obrigatório que ninguém pediu.
--
-- Nada é APAGADO. As colunas continuam existindo, só deixam de ser exigidas —
-- os leads já gravados seguem válidos.

-- ---------------------------------------------------------------------------
-- Campos novos do formulário comercial
-- ---------------------------------------------------------------------------
alter table market_research_leads
  add column if not exists business_name text
    check (business_name is null or char_length(trim(business_name)) between 2 and 80);

-- E-mail entra porque o contato comercial acontece por ele tanto quanto por
-- WhatsApp. A validação séria é do Zod na rota; o check aqui só barra o
-- absurdo (sem @, sem ponto, tamanho impossível) para a coluna não virar
-- depósito de texto livre.
alter table market_research_leads
  add column if not exists email text
    check (email is null or (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
                             and char_length(email) <= 160));

-- A faixa de horas escolhida na interação "quanto isso custa". Não é resposta
-- de formulário: é um subproduto de uma interação que a pessoa fez por
-- interesse próprio, e por isso vale mais que uma pergunta direta.
alter table market_research_leads
  add column if not exists hours_lost_band text;

-- Consentimento LGPD explícito do formulário comercial. Separado de
-- `contact_allowed` (que era a pergunta final da pesquisa): um é permissão de
-- contato, o outro é o aceite de tratamento dos dados. Juntar os dois faria a
-- base perder a distinção justamente quando ela for questionada.
alter table market_research_leads
  add column if not exists privacy_accepted_at timestamptz;

-- ---------------------------------------------------------------------------
-- O que era obrigatório vira opcional
-- ---------------------------------------------------------------------------
-- `profession` continua exigido: é "O que você faz?", um dos cinco campos do
-- formulário. Os demais passaram para as perguntas opcionais pós-envio.
alter table market_research_leads alter column team_size drop not null;
alter table market_research_leads alter column weekly_volume drop not null;
alter table market_research_leads alter column whatsapp_reliance drop not null;
alter table market_research_leads alter column interest drop not null;

comment on column market_research_leads.business_name is
  'Nome do negócio, opcional — muita gente da beleza atende sem marca própria.';
comment on column market_research_leads.email is
  'Contato comercial. Validação de formato séria fica no Zod da rota.';
comment on column market_research_leads.hours_lost_band is
  'Faixa escolhida na interação de custo da landing. Subproduto de uma interação voluntária, não resposta de formulário.';
comment on column market_research_leads.privacy_accepted_at is
  'Aceite de tratamento de dados (LGPD). Distinto de contact_allowed, que é permissão de contato.';
