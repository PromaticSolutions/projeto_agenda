-- Agenda Online — Promatic Solutions
-- Migração inicial: schema multi-tenant (1 usuário Auth = 1 dono = 1 estúdio)
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase (ou via
-- `supabase db push` se estiver usando a CLI localmente).

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "btree_gist"; -- exclusion constraint anti-colisão

create type booking_status as enum ('agendado', 'em_atendimento', 'finalizado', 'cancelado');

-- =========================================================
-- studios
-- =========================================================
create table studios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  whatsapp text not null check (whatsapp ~ '^\d{10,15}$'), -- E.164 sem "+", ex. 5511934476935
  brand_color text not null default '#7C3AED',
  logo_url text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- services
-- =========================================================
create table services (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  price_cents integer not null check (price_cents >= 0),
  duration_min integer not null check (duration_min > 0),
  color text not null default '#7C3AED',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index services_studio_id_idx on services (studio_id);

-- =========================================================
-- working_hours (turnos de atendimento por dia da semana)
-- =========================================================
create table working_hours (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo
  start_time time not null,
  end_time time not null,
  constraint working_hours_valid_range check (start_time < end_time)
);

create index working_hours_studio_id_idx on working_hours (studio_id, weekday);

-- =========================================================
-- blocks (folgas / bloqueios pontuais)
-- =========================================================
create table blocks (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  constraint blocks_valid_range check (end_at > start_at)
);

create index blocks_studio_id_idx on blocks (studio_id, start_at);

-- =========================================================
-- bookings
-- =========================================================
create table bookings (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  service_id uuid not null references services (id) on delete restrict,
  client_name text not null check (char_length(trim(client_name)) > 0),
  client_phone text not null check (client_phone ~ '^\d{10,15}$'),
  start_at timestamptz not null,
  end_at timestamptz not null,
  status booking_status not null default 'agendado',
  created_at timestamptz not null default now(),
  constraint bookings_valid_range check (end_at > start_at)
);

create index bookings_studio_id_start_at_idx on bookings (studio_id, start_at);
create index bookings_client_phone_idx on bookings (client_phone);

-- Defesa contra corrida: o Postgres recusa a transação se dois agendamentos
-- do MESMO estúdio tiverem intervalos [start_at, end_at) sobrepostos, desde
-- que nenhum dos dois esteja cancelado. Isso vale mesmo sob concorrência —
-- é a garantia final além da checagem feita na API route (seção 8/RISKS.md).
alter table bookings
  add constraint bookings_no_overlap
  exclude using gist (
    studio_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  )
  where (status <> 'cancelado');

-- Nota para v2: extrair "clients" como tabela própria (nome, telefone,
-- histórico) agrupando bookings por client_phone. Em v1 a lista de clientes
-- é derivada de bookings.

-- =========================================================
-- Row Level Security
-- =========================================================
-- Regra geral: o DONO só lê/escreve linhas do PRÓPRIO estúdio
-- (studios.owner_id = auth.uid()). A página pública NÃO tem policy de
-- leitura aqui: ela é servida por uma API route no servidor usando a
-- service role key, que ignora RLS. Isso evita abrir qualquer SELECT/INSERT
-- anônimo direto no Postgres.

alter table studios enable row level security;
alter table services enable row level security;
alter table working_hours enable row level security;
alter table blocks enable row level security;
alter table bookings enable row level security;

create policy "owner manages own studio"
  on studios for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owner manages own services"
  on services for all
  using (studio_id in (select id from studios where owner_id = auth.uid()))
  with check (studio_id in (select id from studios where owner_id = auth.uid()));

create policy "owner manages own working_hours"
  on working_hours for all
  using (studio_id in (select id from studios where owner_id = auth.uid()))
  with check (studio_id in (select id from studios where owner_id = auth.uid()));

create policy "owner manages own blocks"
  on blocks for all
  using (studio_id in (select id from studios where owner_id = auth.uid()))
  with check (studio_id in (select id from studios where owner_id = auth.uid()));

create policy "owner manages own bookings"
  on bookings for all
  using (studio_id in (select id from studios where owner_id = auth.uid()))
  with check (studio_id in (select id from studios where owner_id = auth.uid()));
