-- Timely — Promatic Solutions
-- Migração 0023: liga a cobrança da plataforma à AbacatePay.
-- Rode depois de 0001..0022.
--
-- O que muda:
--   1. `abacatepay` passa a ser um gateway aceito em `subscriptions`.
--   2. Entra o plano que a landing vende: "Timely", R$ 39,90/mês, 30 dias de
--      teste. Os três planos de partida da 0011 saem do catálogo (active =
--      false) mas continuam na tabela, porque as assinaturas antigas apontam
--      para eles (`on delete restrict`).
--   3. Todo estúdio novo nasce com uma assinatura em teste. Antes disso só os
--      estúdios que existiam quando a 0011 rodou tinham assinatura — quem se
--      cadastrou depois não aparecia no faturamento nem tinha prazo de teste.
--
-- O que NÃO muda: o ID do produto na AbacatePay não mora aqui. Ele é
-- diferente no Dev Mode e em produção, então fica em variável de ambiente
-- (ABACATEPAY_PRODUCT_ID), junto da chave do mesmo ambiente.

alter table subscriptions drop constraint if exists subscriptions_gateway_check;
alter table subscriptions add constraint subscriptions_gateway_check check (
  gateway is null
  or gateway in ('abacatepay', 'mercadopago', 'asaas', 'stripe', 'pagarme', 'manual')
);

insert into plans (code, name, tagline, price_cents, billing_interval, trial_days,
                   max_bookings_per_month, max_services, includes_whatsapp, sort_order)
values
  ('timely', 'Timely', 'O Timely completo, todos os recursos incluídos.',
   3990, 'mensal', 30, null, null, true, 0)
on conflict (code) do nothing;

update plans set active = false where code in ('essencial', 'profissional', 'profissional-anual');

-- =========================================================
-- Estúdio novo nasce em teste
-- =========================================================
-- Trigger e não código no onboarding: o estúdio pode nascer por outros
-- caminhos (SQL Editor, superadmin, script), e o teste tem de existir em
-- todos. `security definer` porque quem insere o estúdio é o próprio dono,
-- e o dono não tem permissão de escrita em `subscriptions` (0011).
create or replace function start_trial_for_new_studio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p plans%rowtype;
begin
  select * into p from plans where code = 'timely' and active;
  if not found then
    return new;
  end if;

  insert into subscriptions (
    studio_id, plan_id, status, amount_cents, started_at,
    trial_ends_at, current_period_start, current_period_end
  ) values (
    new.id, p.id, 'trial', p.price_cents, now(),
    now() + make_interval(days => p.trial_days),
    now(),
    now() + make_interval(days => greatest(p.trial_days, 1))
  )
  -- Um estúdio só tem uma assinatura vigente (índice parcial da 0011).
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists studios_start_trial on studios;
create trigger studios_start_trial
  after insert on studios
  for each row execute function start_trial_for_new_studio();

-- =========================================================
-- Backfill: estúdio sem assinatura nenhuma entra em teste agora
-- =========================================================
-- Só quem NUNCA teve assinatura. Quem já teve (inclusive os testes que
-- venceram) fica como está — o que fazer com eles é decisão à parte.
insert into subscriptions (
  studio_id, plan_id, status, amount_cents, started_at,
  trial_ends_at, current_period_start, current_period_end
)
select
  s.id, p.id, 'trial', p.price_cents, now(),
  now() + make_interval(days => p.trial_days),
  now(),
  now() + make_interval(days => p.trial_days)
from studios s
cross join (select id, price_cents, trial_days from plans where code = 'timely') p
where not exists (select 1 from subscriptions sub where sub.studio_id = s.id);

comment on function start_trial_for_new_studio() is
  'Cria a assinatura em teste do plano "timely" para cada estúdio novo.';
