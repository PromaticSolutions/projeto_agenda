-- Timely — Promatic Solutions
-- Migração 0024: salão, gerente e a hierarquia atendente → gerente.
-- Rode depois de 0001..0023.
--
-- =========================================================
-- POR QUE O SALÃO É UM NÍVEL ACIMA DE `studios`, E NÃO O PRÓPRIO `studios`
-- =========================================================
-- A 0001 fixou "1 usuário Auth = 1 dono = 1 estúdio" (`studios.owner_id` é
-- UNIQUE). Daí para baixo, TUDO pendura em `studio_id`: serviços, horários,
-- bloqueios, agendamentos, clientes, conversas, anexos, fila de mensagens e a
-- instância da Evolution (`<prefixo>_<id do estúdio>`).
--
-- Na linguagem do produto, esse estúdio É a atendente: a "conversa dela" é a
-- conversa do número dela, a "agenda dela" é a agenda do estúdio dela.
--
-- Transformar `studios` no salão exigiria criar `atendente_id` em todas essas
-- tabelas, reescrever todas as policies e todas as queries, e fazer backfill
-- do histórico inteiro. É o oposto de incremental, e quebraria exatamente quem
-- já usa o sistema hoje.
--
-- Então o salão entra ACIMA:
--
--   salons
--     └── studios (salon_id NULL = atendente autônoma)
--           └── clients, bookings, whatsapp_messages, services, ...
--   salon_managers (user_id → salon_id)
--
-- =========================================================
-- O QUE ESTA MIGRAÇÃO NÃO FAZ (de propósito)
-- =========================================================
--   - não altera NENHUMA policy existente;
--   - não altera NENHUMA linha existente;
--   - não torna `salon_id` obrigatório — o default é NULL, e NULL é um estado
--     final válido, não uma pendência de migração;
--   - não toca em `platform_admins` nem no /superadmin.
--
-- Quem já usa o sistema (incluindo a profissional autônoma, sem salão)
-- continua com `salon_id` nulo e segue funcionando exatamente como antes.

-- =========================================================
-- salons
-- =========================================================
create table if not exists salons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

-- =========================================================
-- studios.salon_id — NULLABLE, e assim permanece
-- =========================================================
-- `on delete set null` e não `cascade`: apagar o salão não pode apagar a
-- agenda, os clientes e o histórico das atendentes. Elas voltam a ser
-- autônomas, que é o estado em que o sistema já sabe operar.
alter table studios
  add column if not exists salon_id uuid references salons (id) on delete set null;

-- Índice parcial: a esmagadora maioria das linhas tem salon_id nulo, e são
-- justamente as que nunca são buscadas por salão.
create index if not exists studios_salon_id_idx
  on studios (salon_id) where salon_id is not null;

comment on column studios.salon_id is
  'Salão da atendente. NULL = profissional autônoma — estado válido e suportado, não pendência.';

-- =========================================================
-- studios.deactivated_at — desligar sem destruir
-- =========================================================
-- A gerente precisa conseguir tirar uma atendente de circulação. Excluir a
-- conta destruiria agendamento, cliente e conversa de terceiros — dado que a
-- LGPD manda guardar enquanto houver finalidade, e que a própria atendente
-- pode precisar. Então "desativar" é uma data, não um DELETE.
--
-- O que a data faz: tira a página pública do ar (ninguém marca com ela) e a
-- marca como inativa na visão da gerente. O que ela NÃO faz: mexer no login.
-- Bloquear o acesso da pessoa ao próprio histórico é outra decisão, de outra
-- natureza, e não foi pedida.
alter table studios
  add column if not exists deactivated_at timestamptz;

comment on column studios.deactivated_at is
  'Quando preenchido, a página pública /[slug] sai do ar. Não afeta o login da atendente.';

-- =========================================================
-- salon_managers
-- =========================================================
-- Tabela separada de `studios` pelo mesmo motivo que `platform_admins` é
-- separada: "gerente de salão" e "dona de estúdio" são papéis diferentes. A
-- gerente NÃO tem estúdio, não tem página pública e não tem agenda própria.
--
-- `user_id` é a PK: uma pessoa gerencia no máximo um salão. Se um dia precisar
-- gerenciar dois, a PK vira composta — e aí é uma decisão tomada na hora, com
-- o caso real na mão, não antecipada agora.
--
-- `salon_id` é NOT NULL: ao contrário da atendente, a gerente só existe em
-- função de um salão.
create table if not exists salon_managers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  salon_id uuid not null references salons (id) on delete cascade,
  -- Cópia do nome/e-mail só para a tela não precisar da Admin API do Auth a
  -- cada render. A fonte da verdade do login continua sendo auth.users.
  name text,
  email text,
  created_at timestamptz not null default now()
);

create index if not exists salon_managers_salon_id_idx on salon_managers (salon_id);

-- =========================================================
-- Quem é a gerente: funções `security definer`
-- =========================================================
-- Policy que consulta outra tabela fica sujeita à RLS DAQUELA tabela. Escrever
-- `salon_id in (select salon_id from salon_managers where ...)` direto na
-- policy de `studios` amarraria uma na outra e é o caminho curto para
-- recursão infinita de policy.
--
-- `security definer` resolve: a função lê a tabela ignorando RLS. É seguro
-- porque ela NÃO ACEITA PARÂMETRO — a resposta deriva só de auth.uid(), então
-- não há como pedir o salão de outra pessoa. `search_path` fixo para que nada
-- no caminho do chamador troque o significado dos nomes.
create or replace function my_salon_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select salon_id from salon_managers where user_id = (select auth.uid());
$$;

comment on function my_salon_id() is
  'Salão da gerente autenticada, ou NULL. Sem parâmetro de propósito: não há como pedir o salão de outra pessoa.';

-- Os estúdios que a gerente autenticada enxerga. Uma função só, usada por
-- TODAS as policies abaixo: um lugar para auditar, um lugar para corrigir.
create or replace function salon_studio_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id
  from studios s
  where s.salon_id is not null
    and s.salon_id = my_salon_id();
$$;

comment on function salon_studio_ids() is
  'Estúdios do salão da gerente autenticada. Vazio para quem não é gerente — o que faz as policies abaixo não concederem nada.';

-- Por default toda função é executável por PUBLIC, inclusive anon.
revoke execute on function my_salon_id() from public;
revoke execute on function salon_studio_ids() from public;
grant execute on function my_salon_id() to authenticated, service_role;
grant execute on function salon_studio_ids() to authenticated, service_role;

-- =========================================================
-- RLS de salons / salon_managers: fechadas para o browser
-- =========================================================
-- Mesma postura de `platform_admins` (0003): RLS ligada e NENHUMA policy para
-- anon/authenticated. Quem lê essas duas tabelas é o servidor, com a
-- service_role key, depois de confirmar quem está autenticado. Nem a própria
-- gerente consulta seu papel pelo client comum.
alter table salons enable row level security;
alter table salon_managers enable row level security;

-- RLS não dispensa o GRANT de tabela que o PostgREST exige antes de sequer
-- avaliar as policies — mesmo gotcha documentado em 0002_grants.sql.
grant all on salons to anon, authenticated, service_role;
grant all on salon_managers to anon, authenticated, service_role;

-- =========================================================
-- As policies da gerente: ADITIVAS e SOMENTE LEITURA
-- =========================================================
-- Policy permissiva (o default) se SOMA às outras por OR. Nenhuma linha abaixo
-- altera, substitui ou restringe a policy "owner manages own X" que já existe:
-- a atendente continua enxergando exatamente o que enxergava.
--
-- `for select` e nada além disso. A gerente lê a operação do salão; ela não
-- remarca o horário nem apaga a cliente de ninguém pelo PostgREST. As escritas
-- que ela PODE fazer (cadastrar e editar atendente) passam pelo servidor, que
-- confere o vínculo antes — ver src/lib/data/salons.ts.
--
-- Isolamento entre salões: `salon_studio_ids()` deriva tudo de auth.uid(). Um
-- id de outro salão trocado na URL ou no corpo da requisição não encontra
-- linha nenhuma — o Postgres devolve vazio, não "proibido". Não há IDOR a
-- fechar na aplicação porque não há caminho aberto no banco.

drop policy if exists "salon manager reads salon studios" on studios;
create policy "salon manager reads salon studios"
  on studios for select
  using (salon_id is not null and salon_id = my_salon_id());

drop policy if exists "salon manager reads salon services" on services;
create policy "salon manager reads salon services"
  on services for select
  using (studio_id in (select salon_studio_ids()));

drop policy if exists "salon manager reads salon working_hours" on working_hours;
create policy "salon manager reads salon working_hours"
  on working_hours for select
  using (studio_id in (select salon_studio_ids()));

drop policy if exists "salon manager reads salon blocks" on blocks;
create policy "salon manager reads salon blocks"
  on blocks for select
  using (studio_id in (select salon_studio_ids()));

drop policy if exists "salon manager reads salon bookings" on bookings;
create policy "salon manager reads salon bookings"
  on bookings for select
  using (studio_id in (select salon_studio_ids()));

drop policy if exists "salon manager reads salon clients" on clients;
create policy "salon manager reads salon clients"
  on clients for select
  using (studio_id in (select salon_studio_ids()));

drop policy if exists "salon manager reads salon whatsapp_messages" on whatsapp_messages;
create policy "salon manager reads salon whatsapp_messages"
  on whatsapp_messages for select
  using (studio_id in (select salon_studio_ids()));

drop policy if exists "salon manager reads salon service_attachments" on service_attachments;
create policy "salon manager reads salon service_attachments"
  on service_attachments for select
  using (studio_id in (select salon_studio_ids()));

drop policy if exists "salon manager reads salon reminder_settings" on reminder_settings;
create policy "salon manager reads salon reminder_settings"
  on reminder_settings for select
  using (studio_id in (select salon_studio_ids()));

drop policy if exists "salon manager reads salon whatsapp_connections" on whatsapp_connections;
create policy "salon manager reads salon whatsapp_connections"
  on whatsapp_connections for select
  using (studio_id in (select salon_studio_ids()));

-- `studio_id` é nulo nas mensagens da PLATAFORMA (0017). O teste explícito
-- evita que `null in (...)` vire uma brecha silenciosa.
drop policy if exists "salon manager reads salon message_outbox" on message_outbox;
create policy "salon manager reads salon message_outbox"
  on message_outbox for select
  using (studio_id is not null and studio_id in (select salon_studio_ids()));

-- =========================================================
-- Como criar o primeiro salão e a primeira gerente
-- =========================================================
-- Não há tela para isso, pela mesma razão que não há tela para cadastrar admin
-- da plataforma (ver 0003): criar salão é ato de quem vende o sistema, não
-- operação do dia. Faça no SQL Editor:
--
--   -- 1. o salão
--   insert into salons (name) values ('Salão da Ana') returning id;
--
--   -- 2. a gerente se cadastra sozinha em /signup e NÃO cria estúdio.
--   --    Pegue o id dela em Authentication > Users.
--
--   -- 3. o vínculo
--   insert into salon_managers (user_id, salon_id, name, email)
--   values ('<uuid-do-usuario>', '<uuid-do-salao>', 'Ana', 'ana@exemplo.com');
--
--   -- 4. atendentes QUE JÁ EXISTEM e vão para esse salão (opcional).
--   --    Liste antes de rodar, e nomeie uma a uma: um update sem `where`
--   --    aqui jogaria toda profissional autônoma do sistema dentro do salão.
--   update studios set salon_id = '<uuid-do-salao>'
--   where slug in ('atendente-1', 'atendente-2');
--
-- Entre o passo 2 e o 3 a gerente vê a tela de criar estúdio. Se ela criar um,
-- vira atendente — `getCurrentActor` resolve estúdio PRIMEIRO. Faça o passo 3
-- antes de mandar o acesso para ela.
--
-- Depois do passo 3, as atendentes novas saem de /app/gerencia/atendentes e já
-- nascem com o `salon_id` certo, sem SQL.

-- =========================================================
-- O que a gerente deliberadamente NÃO enxerga
-- =========================================================
-- `subscriptions`, `invoices`, `payments`, `billing_events`: a assinatura é um
-- contrato entre a atendente e a plataforma. Gerenciar a operação do salão não
-- implica ver o que a profissional paga pelo software.
--
-- `consents` e `data_subject_requests`: prova de consentimento e pedido do
-- titular (LGPD, 0015/0016). São registros de prestação de contas entre a
-- atendente e a cliente dela; ampliar quem os lê precisa de decisão explícita,
-- não de um "já que estamos aqui".
--
-- Se o negócio pedir qualquer um deles depois, é uma policy nova — aditiva,
-- como estas, e com a decisão registrada em DECISIONS.md.
