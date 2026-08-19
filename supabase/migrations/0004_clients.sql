-- Agenda Online — Promatic Solutions
-- CRM básico: tabela própria de clientes (v1 derivava tudo de bookings —
-- ver nota em 0001_init.sql). Rode depois de 0001/0002/0003.

create table clients (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  phone text not null check (phone ~ '^\d{10,15}$'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_studio_phone_unique unique (studio_id, phone)
);

create index clients_studio_id_idx on clients (studio_id);

alter table clients enable row level security;

create policy "owner manages own clients"
  on clients for all
  using (studio_id in (select id from studios where owner_id = auth.uid()))
  with check (studio_id in (select id from studios where owner_id = auth.uid()));

-- Mesmo gotcha documentado em 0002_grants.sql: RLS não dispensa o GRANT de
-- tabela que o PostgREST exige antes de sequer avaliar as policies.
grant all on clients to anon, authenticated, service_role;

-- =========================================================
-- bookings.client_id — liga cada booking ao cliente (nullable: bookings
-- antigos são retroativamente ligados abaixo; novos bookings sempre
-- preenchem via upsertClientFromBooking).
-- =========================================================
alter table bookings add column client_id uuid references clients (id) on delete set null;

-- Backfill: cria um cliente por (studio_id, client_phone) distinto já
-- existente em bookings, usando o nome mais recente, e liga os bookings.
insert into clients (studio_id, name, phone, created_at)
select distinct on (b.studio_id, b.client_phone)
  b.studio_id, b.client_name, b.client_phone, now()
from bookings b
order by b.studio_id, b.client_phone, b.created_at desc
on conflict (studio_id, phone) do nothing;

update bookings b
set client_id = c.id
from clients c
where c.studio_id = b.studio_id
  and c.phone = b.client_phone
  and b.client_id is null;
