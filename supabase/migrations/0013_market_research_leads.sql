-- Agenda Online — Promatic Solutions
-- Migração 0013: leads da pesquisa de mercado da landing page.
-- Rode depois de 0001..0012.
--
-- POR QUE UMA TABELA PRÓPRIA, E NÃO `clients`:
-- `clients` são as CLIENTES de um estúdio (quem marca horário), com
-- `studio_id` obrigatório e telefone único por estúdio. Um lead da landing é
-- outra coisa: é um profissional avaliando o Timely, sem estúdio nenhum
-- ainda. Enfiar os dois na mesma tabela obrigaria `studio_id` nulo e
-- desmontaria a RLS que hoje isola cliente por estúdio — o caminho conhecido
-- para um salão acabar vendo o cadastro de outro.
--
-- POR QUE NÃO É `auth.users`:
-- responder à pesquisa não cria conta. Quem quiser testar o produto passa
-- pelo /signup existente. Nenhuma autenticação paralela.

do $$
begin
  -- Interesse declarado na última etapa do formulário. Enum, e não texto
  -- livre, porque é isso que permite agrupar a pesquisa depois sem depender
  -- de como cada resposta foi escrita.
  if not exists (select 1 from pg_type where typname = 'lead_interest') then
    create type lead_interest as enum ('sim', 'talvez', 'saber_mais', 'nao');
  end if;
end $$;

create table if not exists market_research_leads (
  id uuid primary key default gen_random_uuid(),

  -- Identificação (etapa 9)
  name text not null check (char_length(trim(name)) between 2 and 80),
  -- E.164 sem "+", mesmo formato de studios.whatsapp, bookings.client_phone e
  -- message_outbox.to_phone. Um segundo formato de telefone só nesta tabela
  -- seria descoberto no dia em que alguém tentasse enviar mensagem para o lead.
  phone text not null check (phone ~ '^\d{10,15}$'),
  instagram text check (instagram is null or char_length(trim(instagram)) <= 60),

  -- Respostas da pesquisa. Guardadas como texto/array de texto, e NÃO como
  -- enum por pergunta: a lista de opções de uma pesquisa muda a cada rodada
  -- de aprendizado, e uma migração por ajuste de alternativa travaria
  -- justamente o que a pesquisa existe para permitir.
  --
  -- A validação de domínio fica no Zod (src/lib/validation.ts), que é onde as
  -- opções da interface também são declaradas — uma lista só, sem divergir.
  profession text not null,
  team_size text not null,
  agenda_tools text[] not null default '{}',
  pain_points text[] not null default '{}',
  weekly_volume text not null,
  whatsapp_reliance text not null,
  -- Etapa 7, campo aberto: é a resposta mais valiosa da pesquisa e a que não
  -- cabe em enum nenhum.
  improvement_wish text check (improvement_wish is null or char_length(improvement_wish) <= 1000),

  interest lead_interest not null,
  -- Consentimento explícito para contato. Sem isto, mandar mensagem depois
  -- seria abordagem não solicitada — e o formulário pergunta de propósito.
  contact_allowed boolean not null default false,

  -- Contexto de origem, para saber de onde o lead veio sem depender de
  -- analytics de terceiro. Nada aqui identifica a pessoa além do que ela
  -- mesma respondeu: sem IP, sem fingerprint.
  source text not null default 'landing',
  utm jsonb,

  created_at timestamptz not null default now()
);

-- Uma resposta por telefone. `on conflict do nothing` na rota de gravação usa
-- este índice: quem responder duas vezes (voltou na página, clicou de novo)
-- não gera lead duplicado nem duas notificações no WhatsApp.
create unique index if not exists market_research_leads_phone_uniq
  on market_research_leads (phone);

create index if not exists market_research_leads_created_idx
  on market_research_leads (created_at desc);

alter table market_research_leads enable row level security;

-- NENHUMA policy. É deliberado, e é o mesmo desenho de `message_outbox`:
-- a landing é pública, então se houvesse policy de insert para `anon`
-- qualquer pessoa poderia despejar linhas na tabela direto pelo PostgREST,
-- sem passar pela validação da rota. A escrita acontece só em
-- /api/leads, que roda com service_role (e ignora RLS).
--
-- Leitura idem: dado de pesquisa não é para o painel do estúdio. Quem
-- consulta é o admin da plataforma, pelo Supabase.
revoke all on market_research_leads from anon, authenticated;
grant all on market_research_leads to service_role;

-- ---------------------------------------------------------------------------
-- A notificação do lead entra na fila existente
-- ---------------------------------------------------------------------------
-- O aviso no WhatsApp do dono da plataforma passa por `message_outbox` em vez
-- de ser um envio solto: assim ganha de graça a retentativa, a contagem de
-- tentativas e o histórico auditável que o disparador já implementa. Um envio
-- direto na rota perderia o lead quando a Evolution estivesse fora do ar —
-- justamente a hora em que ninguém está olhando.
--
-- `if not exists` deixa re-executável; o valor NÃO é usado nesta migração
-- (nenhum índice parcial o menciona), então não há o problema de "unsafe use
-- of new value" que a 0012 encontrou.
alter type message_outbox_kind add value if not exists 'lead';

comment on table market_research_leads is
  'Respostas da pesquisa de mercado da landing. Sem policy de RLS de propósito: escrita e leitura só por service_role, via /api/leads.';
comment on column market_research_leads.contact_allowed is
  'Consentimento explícito para contato posterior. Falso = não abordar.';
comment on column market_research_leads.improvement_wish is
  'Etapa 7, campo aberto — a resposta mais útil da pesquisa.';
