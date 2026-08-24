-- Timely — Promatic Solutions
-- Migração 0011: cobrança da PLATAFORMA (o estúdio paga a Timely).
-- Rode depois de 0001..0010.
--
-- ESCOPO, para não confundir os dois dinheiros que existem neste produto:
--   * `services.price_cents` é o que a CLIENTE paga ao ESTÚDIO pelo
--     atendimento. Isso nunca passa por aqui — a Timely não intermedia.
--   * as tabelas desta migração são o que o ESTÚDIO paga à TIMELY pela
--     assinatura do software. É esse dinheiro que o /superadmin chama de
--     "faturamento".
--
-- AGNÓSTICA DE GATEWAY: o gateway (Mercado Pago, Asaas, Stripe, Pagar.me)
-- ainda não está escolhido, então nenhuma coluna carrega vocabulário de um
-- provedor específico. Cada linha guarda `gateway` (texto) + o ID externo
-- correspondente, e o webhook cai em `billing_events`. Plugar um provedor
-- depois é preencher esses campos, não migrar de novo.
--
-- NADA DE SEGREDO AQUI: chave de API, token e secret de webhook do gateway
-- moram em variável de ambiente, nunca no banco. Cartão nunca é armazenado —
-- só marca e 4 últimos dígitos, exatamente o que o gateway devolve (guardar
-- PAN/CVV colocaria este projeto no escopo de PCI-DSS).

-- =========================================================
-- Enums
-- =========================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_interval') then
    create type plan_interval as enum ('mensal', 'anual');
  end if;

  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type subscription_status as enum (
      'trial',          -- período de teste, ainda não cobrado
      'ativa',          -- em dia
      'inadimplente',   -- cobrança falhou e ainda não foi resolvida
      'pausada',        -- suspensa a pedido, sem cancelar
      'cancelada'       -- encerrada (mantida na tabela como histórico)
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type invoice_status as enum (
      'aberta',       -- emitida, dentro do prazo
      'paga',
      'vencida',      -- passou do due_date sem pagamento
      'cancelada',
      'reembolsada'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type payment_method as enum ('pix', 'cartao_credito', 'boleto');
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum (
      'pendente',   -- Pix aguardando leitura do QR / cartão em análise
      'aprovado',
      'recusado',
      'estornado',
      'expirado'    -- QR do Pix venceu sem pagamento
    );
  end if;
end $$;

-- =========================================================
-- plans — catálogo comercial
-- =========================================================
-- Preço em tabela, não em constante no código: mexer em preço é decisão
-- comercial e precisa acontecer sem deploy. O preço da assinatura é copiado
-- para `subscriptions.amount_cents` no momento da contratação, então subir o
-- preço aqui NÃO reajusta quem já é cliente (reajuste é ato explícito).
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) > 0),
  tagline text,
  price_cents integer not null check (price_cents >= 0),
  -- `billing_interval` e não `interval`: INTERVAL é palavra-chave de tipo no
  -- Postgres e viraria uma armadilha de quoting em toda query.
  billing_interval plan_interval not null default 'mensal',
  trial_days integer not null default 0 check (trial_days between 0 and 90),
  -- Nulo = ilimitado. Limite é dado do plano, não regra espalhada no app.
  max_bookings_per_month integer check (max_bookings_per_month > 0),
  max_services integer check (max_services > 0),
  includes_whatsapp boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- =========================================================
-- subscriptions — uma linha por contrato, incluindo os encerrados
-- =========================================================
-- Cancelamento NÃO apaga a linha: sem histórico não existe churn, nem
-- "quanto esse cliente já pagou antes de sair". O índice parcial abaixo é
-- que garante uma única assinatura VIGENTE por estúdio.
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  plan_id uuid not null references plans (id) on delete restrict,
  status subscription_status not null default 'trial',

  -- Valor travado na contratação (ver comentário em `plans`).
  amount_cents integer not null check (amount_cents >= 0),

  started_at timestamptz not null default now(),
  trial_ends_at timestamptz,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '30 days'),

  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  cancel_reason text,

  -- Vínculo com o gateway, preenchido quando a integração existir.
  gateway text check (
    gateway is null
    or gateway in ('mercadopago', 'asaas', 'stripe', 'pagarme', 'manual')
  ),
  gateway_customer_id text,
  gateway_subscription_id text,
  default_payment_method payment_method,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint subscriptions_period_valid check (current_period_end > current_period_start),
  constraint subscriptions_canceled_has_timestamp
    check (status <> 'cancelada' or canceled_at is not null)
);

create unique index if not exists subscriptions_one_current_per_studio
  on subscriptions (studio_id)
  where status in ('trial', 'ativa', 'inadimplente', 'pausada');

create index if not exists subscriptions_status_idx on subscriptions (status);
create index if not exists subscriptions_studio_idx on subscriptions (studio_id, started_at desc);

-- =========================================================
-- invoices — o que foi cobrado
-- =========================================================
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  -- `set null`: apagar uma assinatura não pode apagar o histórico fiscal.
  subscription_id uuid references subscriptions (id) on delete set null,

  -- Número humano da fatura ("#1043"), para falar com o cliente. UUID não
  -- serve para isso; sequência serve.
  seq bigint generated always as identity,

  amount_cents integer not null check (amount_cents > 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  -- Calculado pelo banco: um app que soma errado não consegue divergir do
  -- outro se a coluna não é escrita por ninguém.
  total_cents integer generated always as (amount_cents - discount_cents) stored,

  status invoice_status not null default 'aberta',
  description text,
  period_start date,
  period_end date,
  due_date date not null,

  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  canceled_at timestamptz,

  gateway text,
  gateway_invoice_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invoices_discount_within_amount check (discount_cents <= amount_cents),
  constraint invoices_paid_has_timestamp check (status <> 'paga' or paid_at is not null),
  constraint invoices_period_valid check (period_end is null or period_start is null or period_end >= period_start)
);

create index if not exists invoices_studio_idx on invoices (studio_id, issued_at desc);
create index if not exists invoices_status_due_idx on invoices (status, due_date);
-- Índice do gráfico de receita: só fatura paga entra na série mensal.
create index if not exists invoices_paid_at_idx on invoices (paid_at) where status = 'paga';

-- =========================================================
-- payments — as tentativas de pagar uma fatura
-- =========================================================
-- Várias por fatura de propósito: Pix expira e a dona tenta de novo no
-- cartão. Guardar só o pagamento que deu certo apagaria justamente o dado
-- que explica inadimplência ("recusado: limite insuficiente", 3x).
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  -- Denormalizado para agregar receita por estúdio sem join.
  studio_id uuid not null references studios (id) on delete cascade,

  amount_cents integer not null check (amount_cents > 0),
  -- Taxa do gateway: receita líquida é o que sobra, e é ela que paga a conta.
  fee_cents integer not null default 0 check (fee_cents >= 0),
  refunded_cents integer not null default 0 check (refunded_cents >= 0),

  method payment_method not null,
  status payment_status not null default 'pendente',

  installments smallint not null default 1 check (installments between 1 and 12),
  -- Cartão: NUNCA o número (ver cabeçalho). Só o que o gateway devolve.
  card_brand text,
  card_last4 text check (card_last4 ~ '^\d{4}$'),
  pix_expires_at timestamptz,

  paid_at timestamptz,
  failure_code text,
  failure_reason text,

  gateway text,
  gateway_payment_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payments_refund_within_amount check (refunded_cents <= amount_cents),
  constraint payments_card_fields_only_on_card
    check (method = 'cartao_credito' or (card_brand is null and card_last4 is null)),
  constraint payments_installments_only_on_card
    check (installments = 1 or method = 'cartao_credito'),
  constraint payments_approved_has_timestamp
    check (status <> 'aprovado' or paid_at is not null)
);

create index if not exists payments_invoice_idx on payments (invoice_id);
create index if not exists payments_studio_idx on payments (studio_id, created_at desc);
create index if not exists payments_approved_idx on payments (paid_at) where status = 'aprovado';

-- Idempotência do webhook: o gateway reenvia o mesmo evento quando não
-- recebe 200, e sem isso um Pix apareceria duas vezes no faturamento.
create unique index if not exists payments_gateway_id_uniq
  on payments (gateway, gateway_payment_id)
  where gateway_payment_id is not null;

-- =========================================================
-- billing_events — log cru de webhook (auditoria)
-- =========================================================
-- Guardar o payload como chegou é o que permite responder "o gateway avisou?"
-- meses depois, sem depender do nosso processamento ter dado certo.
create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  gateway text not null,
  event_type text not null,
  external_event_id text,

  studio_id uuid references studios (id) on delete set null,
  invoice_id uuid references invoices (id) on delete set null,
  payment_id uuid references payments (id) on delete set null,

  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  process_error text,
  received_at timestamptz not null default now()
);

create index if not exists billing_events_received_idx on billing_events (received_at desc);
create unique index if not exists billing_events_external_uniq
  on billing_events (gateway, external_event_id)
  where external_event_id is not null;

-- =========================================================
-- Row Level Security
-- =========================================================
-- Escrita é exclusividade do servidor (service_role): assinatura e fatura só
-- mudam por webhook do gateway ou por ação de admin, nunca a partir do
-- navegador do dono. O dono LÊ o próprio faturamento — é o que permite a
-- futura tela "minha assinatura" em /app sem uma segunda superfície de acesso.
alter table plans enable row level security;
alter table subscriptions enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;
alter table billing_events enable row level security;

drop policy if exists "authenticated reads active plans" on plans;
create policy "authenticated reads active plans"
  on plans for select
  using (active);

drop policy if exists "owner reads own subscriptions" on subscriptions;
create policy "owner reads own subscriptions"
  on subscriptions for select
  using (studio_id in (select id from studios where owner_id = auth.uid()));

drop policy if exists "owner reads own invoices" on invoices;
create policy "owner reads own invoices"
  on invoices for select
  using (studio_id in (select id from studios where owner_id = auth.uid()));

drop policy if exists "owner reads own payments" on payments;
create policy "owner reads own payments"
  on payments for select
  using (studio_id in (select id from studios where owner_id = auth.uid()));

-- Mesmo gotcha de 0002_grants.sql: RLS não dispensa o GRANT de tabela que o
-- PostgREST exige antes de sequer avaliar as policies.
grant select on plans, subscriptions, invoices, payments to authenticated;
grant all on plans, subscriptions, invoices, payments to service_role;
-- billing_events não tem policy nenhuma: payload de webhook pode conter dado
-- do gateway que não é para o cliente ver. Só service_role.
grant all on billing_events to service_role;

-- =========================================================
-- Seed do catálogo
-- =========================================================
-- Preços de partida, editáveis no SQL Editor. `on conflict do nothing` deixa
-- a migração re-executável sem duplicar plano.
insert into plans (code, name, tagline, price_cents, billing_interval, trial_days,
                   max_bookings_per_month, max_services, includes_whatsapp, sort_order)
values
  ('essencial', 'Essencial', 'Agenda, link público e clientes.',
   4900, 'mensal', 14, 200, 10, false, 1),
  ('profissional', 'Profissional', 'Tudo do Essencial + lembretes no WhatsApp.',
   8900, 'mensal', 14, null, null, true, 2),
  ('profissional-anual', 'Profissional anual', 'Dois meses de cortesia no plano anual.',
   89000, 'anual', 14, null, null, true, 3)
on conflict (code) do nothing;

-- =========================================================
-- Backfill: todo estúdio que já existe entra em trial
-- =========================================================
-- Sem isto o /superadmin abre com faturamento zerado e nenhuma assinatura,
-- o que não descreve a realidade (esses estúdios usam o produto hoje). O
-- trial começa AGORA, não na data de criação do estúdio, para não nascer
-- vencido. Nenhuma fatura ou pagamento é semeado: receita inventada é pior
-- que receita zero. Para desfazer:
--   delete from subscriptions where gateway is null and status = 'trial';
insert into subscriptions (
  studio_id, plan_id, status, amount_cents, started_at,
  trial_ends_at, current_period_start, current_period_end
)
select
  s.id,
  p.id,
  'trial',
  p.price_cents,
  now(),
  now() + (p.trial_days || ' days')::interval,
  now(),
  now() + (p.trial_days || ' days')::interval
from studios s
cross join (select id, price_cents, trial_days from plans where code = 'profissional') p
where not exists (
  select 1 from subscriptions sub
  where sub.studio_id = s.id
    and sub.status in ('trial', 'ativa', 'inadimplente', 'pausada')
);

-- =========================================================
-- Comentários
-- =========================================================
comment on table plans is
  'Catálogo comercial da Timely. Preço aqui não reajusta assinatura existente — ver subscriptions.amount_cents.';
comment on table subscriptions is
  'Contrato entre um estúdio e a Timely. Canceladas ficam na tabela como histórico; o índice parcial garante uma vigente por estúdio.';
comment on column subscriptions.amount_cents is
  'Valor travado na contratação, em centavos. Reajuste é update explícito.';
comment on table invoices is
  'O que foi cobrado do estúdio. total_cents é gerado pelo banco (amount - discount).';
comment on table payments is
  'Tentativas de pagar uma fatura (Pix expirado + cartão recusado + cartão aprovado são três linhas). Nunca guarda dado sensível de cartão.';
comment on column payments.fee_cents is
  'Taxa retida pelo gateway. Receita líquida = amount_cents - fee_cents.';
comment on table billing_events is
  'Log cru de webhook do gateway, para auditoria e idempotência. Só service_role lê.';
