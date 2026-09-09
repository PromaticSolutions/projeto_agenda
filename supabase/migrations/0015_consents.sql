-- Agenda Online — Promatic Solutions
-- Registro de consentimento do titular (LGPD, Lei 13.709/2018).
-- Rode depois de 0001 (bookings), 0004 (clients) e 0014.

-- =========================================================
-- Por que uma tabela, e não uma coluna em `bookings`
-- =========================================================
-- Consentimento é um FATO DATADO, não um atributo do agendamento: o que
-- interessa provar é "esta pessoa aceitou a versão X da política naquele
-- instante". Uma coluna booleana em bookings responderia "aceitou?" e perderia
-- qual texto foi aceito — que é justamente o que muda quando a política é
-- reescrita. Em tabela à parte, o registro também sobrevive ao agendamento ser
-- excluído, e é isso que mantém a prova de pé.
create table consents (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,

  -- Nullable e `on delete set null`: apagar um agendamento não pode apagar a
  -- prova de que houve consentimento. A coluna existe para ligar o registro ao
  -- ato que o gerou enquanto os dois existirem.
  booking_id uuid references bookings (id) on delete set null,

  -- Idem para o cliente. O TELEFONE fica desnormalizado e obrigatório de
  -- propósito: é ele o identificador do titular dentro de um estúdio
  -- (clients_studio_phone_unique, migração 0004), e é por ele que se encontra
  -- o registro depois que a linha de `clients` já não existe.
  client_id uuid references clients (id) on delete set null,
  client_phone text not null check (client_phone ~ '^\d{10,15}$'),

  -- Qual texto foi aceito. Bate com POLICY_VERSION em src/lib/consent.ts e com
  -- a data de vigência exibida em /politica-de-privacidade.
  policy_version text not null check (char_length(trim(policy_version)) > 0),

  consented_at timestamptz not null default now(),

  -- Best-effort: vem do cabeçalho de proxy, que pode faltar ou vir forjado.
  -- Serve como indício adicional, nunca como identificação confiável — por
  -- isso é nullable e ninguém depende dela.
  ip_address text,

  created_at timestamptz not null default now()
);

create index consents_studio_id_idx on consents (studio_id);
create index consents_booking_id_idx on consents (booking_id);

alter table consents enable row level security;

-- =========================================================
-- RLS
-- =========================================================
-- Mesma regra de `bookings` (0001_init.sql): o dono só enxerga o próprio
-- estúdio, e a página pública NÃO ganha policy de escrita anônima. A inserção
-- do fluxo público passa por /api/bookings, que roda no servidor com a service
-- role key e ignora RLS — é o mesmo caminho por onde o agendamento é criado.
--
-- `for select`, e não `for all`: o dono precisa CONSULTAR os consentimentos
-- para responder a um pedido do titular, mas não deveria poder editá-los pelo
-- painel. Registro de consentimento que o interessado pode reescrever não
-- prova nada.
create policy "owner reads own consents"
  on consents for select
  using (studio_id in (select id from studios where owner_id = auth.uid()));

-- Mesmo gotcha documentado em 0002_grants.sql: RLS não dispensa o GRANT de
-- tabela que o PostgREST exige antes de sequer avaliar as policies.
grant all on consents to anon, authenticated, service_role;
