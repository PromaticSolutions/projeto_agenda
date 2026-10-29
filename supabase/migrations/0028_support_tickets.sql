-- Agenda Online — Promatic Solutions
-- Chamados de suporte: o dono do estúdio abre, a equipe da plataforma
-- responde. Rode depois de 0027.

-- =========================================================
-- Tenant
-- =========================================================
-- Como em todo o resto do schema, o tenant é o estúdio: o chamado e cada
-- mensagem carregam `studio_id`. A mensagem repete o `studio_id` do chamado
-- de propósito — a policy de leitura fica uma comparação direta, sem join, e
-- não há como uma mensagem "vazar" para outro estúdio por um ticket_id errado.
--
-- Leitura: o dono enxerga só os chamados do próprio estúdio (policy abaixo).
-- Escrita: só pelo servidor, com a service role, depois de resolver o estúdio
-- pela sessão — o painel nunca manda `studio_id`, então não há o que forjar.
-- O /superadmin lê tudo pela service role, como as demais telas dele.

create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  -- O número que se fala no atendimento ("o chamado #1042"). Global, não por
  -- estúdio: é a equipe que precisa achar o chamado, e ela vê todos.
  number bigint generated always as identity (start with 1001) unique,
  studio_id uuid not null references studios (id) on delete cascade,
  opened_by uuid references auth.users (id) on delete set null,

  subject text not null check (char_length(trim(subject)) between 3 and 120),
  category text not null default 'problema'
    check (category in ('problema', 'duvida', 'financeiro', 'sugestao')),
  status text not null default 'aberto'
    check (status in ('aberto', 'em_andamento', 'resolvido')),

  -- Quem falou por último decide de quem é a vez: "aguardando suporte" ou
  -- "respondido". Os dois `seen_at` acendem o "nova resposta" de cada lado.
  last_message_at timestamptz not null default now(),
  last_message_by text not null default 'cliente'
    check (last_message_by in ('cliente', 'suporte')),
  client_seen_at timestamptz,
  support_seen_at timestamptz,

  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_studio_idx
  on support_tickets (studio_id, last_message_at desc);

-- A fila da equipe: o que não está resolvido.
create index if not exists support_tickets_pendentes_idx
  on support_tickets (last_message_at desc)
  where status <> 'resolvido';

create table if not exists support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets (id) on delete cascade,
  studio_id uuid not null references studios (id) on delete cascade,
  author text not null check (author in ('cliente', 'suporte')),
  -- Quem da equipe respondeu fica guardado para auditoria, mas o painel do
  -- estúdio mostra só "Suporte Timely".
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_messages_ticket_idx
  on support_ticket_messages (ticket_id, created_at);

alter table support_tickets enable row level security;
alter table support_ticket_messages enable row level security;

drop policy if exists "owner reads own tickets" on support_tickets;
create policy "owner reads own tickets"
  on support_tickets for select
  using (studio_id in (select id from studios where owner_id = auth.uid()));

drop policy if exists "owner reads own ticket messages" on support_ticket_messages;
create policy "owner reads own ticket messages"
  on support_ticket_messages for select
  using (studio_id in (select id from studios where owner_id = auth.uid()));

-- Mesmo gotcha de 0002_grants.sql: RLS não dispensa o GRANT. Só leitura para
-- o usuário logado; escrever é coisa do servidor.
grant select on support_tickets, support_ticket_messages to authenticated;
grant all on support_tickets, support_ticket_messages to service_role;
