-- Agenda Online — Promatic Solutions
-- Migração 0010: fila de mensagens (o que finalmente FAZ o lembrete sair).
-- Rode depois de 0001..0009.
--
-- POR QUE UMA FILA, E NÃO "O CRON VARRE bookings E MANDA":
-- varrer e mandar direto não tem memória. Se o disparador rodar duas vezes
-- (retry da plataforma, dois cron apontando para a mesma rota, deploy no meio
-- da execução), a cliente recebe o mesmo lembrete duas vezes — e mensagem
-- repetida no WhatsApp de cliente é o tipo de erro que faz o salão desligar o
-- recurso. A fila dá três coisas que a varredura não dá:
--   1. idempotência, garantida por índice único (booking_id, kind);
--   2. retentativa com contagem, em vez de "sumiu, e ninguém sabe por quê";
--   3. histórico auditável — dá para responder "esse lembrete saiu?".

do $$
begin
  if not exists (select 1 from pg_type where typname = 'message_outbox_kind') then
    create type message_outbox_kind as enum (
      'lembrete',           -- aviso à cliente, antes do horário (0008)
      'novo_agendamento'    -- aviso ao dono quando entra marcação pela página pública
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'message_outbox_status') then
    create type message_outbox_status as enum (
      'pendente',   -- esperando a hora de sair
      'enviando',   -- reivindicada por um disparador; evita envio duplo
      'enviado',    -- o gateway aceitou
      'falhou',     -- esgotou as tentativas
      'cancelado'   -- agendamento cancelado, ou a mensagem perdeu a validade
    );
  end if;
end $$;

create table if not exists message_outbox (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,

  -- Nulo é possível para mensagens que não nascem de um agendamento (avisos
  -- do sistema, no futuro). Quando existe, apagar o agendamento leva a
  -- mensagem junto: não faz sentido lembrar de algo que não existe mais.
  booking_id uuid references bookings (id) on delete cascade,

  kind message_outbox_kind not null,

  -- Destino em E.164 sem "+", mesmo formato de studios.whatsapp e
  -- bookings.client_phone.
  to_phone text not null check (to_phone ~ '^\d{10,15}$'),

  -- Texto JÁ renderizado, com os marcadores substituídos. Guardar o texto
  -- final (e não o template + os dados) é de propósito: se o dono editar o
  -- template amanhã, a mensagem que já estava na fila não muda de conteúdo no
  -- meio do caminho, e o histórico mostra o que a cliente de fato recebeu.
  body text not null check (char_length(trim(body)) > 0),

  scheduled_for timestamptz not null,

  status message_outbox_status not null default 'pendente',
  attempts integer not null default 0,
  last_error text,

  -- ID devolvido pelo gateway (Evolution). Serve para rastrear entrega e para
  -- não depender só do nosso "enviado" ao investigar reclamação.
  provider_message_id text,
  sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A GARANTIA CENTRAL: no máximo uma mensagem de cada tipo por agendamento.
-- É isto que torna o planejador seguro de rodar quantas vezes for — ele
-- insere com `on conflict do nothing` e o banco decide quem foi o primeiro.
create unique index if not exists message_outbox_booking_kind_uniq
  on message_outbox (booking_id, kind)
  where booking_id is not null;

-- Índice parcial do disparador: ele só olha o que está pendente e vencido.
create index if not exists message_outbox_due_idx
  on message_outbox (scheduled_for)
  where status = 'pendente';

create index if not exists message_outbox_studio_idx
  on message_outbox (studio_id, created_at desc);

alter table message_outbox enable row level security;

-- O dono LÊ o histórico do próprio estúdio; escrita é exclusividade do
-- disparador, que roda com service_role (e ignora RLS). Não existe policy de
-- insert/update para usuário autenticado de propósito: ninguém deve conseguir
-- enfileirar mensagem a partir do navegador.
drop policy if exists "owner reads own message_outbox" on message_outbox;
create policy "owner reads own message_outbox"
  on message_outbox for select
  using (studio_id in (select id from studios where owner_id = auth.uid()));

grant select on message_outbox to authenticated;
grant all on message_outbox to service_role;

-- ---------------------------------------------------------------------------
-- Reivindicação atômica
-- ---------------------------------------------------------------------------
-- Duas execuções simultâneas do disparador não podem pegar a mesma linha. Um
-- `select` seguido de `update` pelo app tem janela de corrida entre os dois;
-- `for update skip locked` resolve isso dentro do banco: cada execução leva um
-- lote diferente, e quem chegou depois simplesmente pula o que já está travado
-- em vez de ficar esperando.
--
-- Precisa ser função porque o PostgREST não expõe `for update skip locked`.
create or replace function claim_pending_messages(p_limit integer default 25)
returns setof message_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with vencidas as (
    select id
    from message_outbox
    where status = 'pendente'
      and scheduled_for <= now()
    order by scheduled_for
    limit p_limit
    for update skip locked
  )
  update message_outbox m
     set status = 'enviando',
         attempts = m.attempts + 1,
         updated_at = now()
    from vencidas v
   where m.id = v.id
  returning m.*;
end;
$$;

-- `security definer` + tabela multi-tenant exige cuidado: sem o revoke abaixo,
-- qualquer usuário autenticado poderia chamar a função e reivindicar mensagens
-- de OUTRO estúdio. Só o disparador (service_role) executa.
revoke all on function claim_pending_messages(integer) from public;
revoke all on function claim_pending_messages(integer) from anon, authenticated;
grant execute on function claim_pending_messages(integer) to service_role;

comment on table message_outbox is
  'Fila de mensagens de WhatsApp. Escrita pelo planejador/disparador (service_role); o dono só lê o histórico do próprio estúdio.';
comment on column message_outbox.body is
  'Texto final, com marcadores já substituídos — não muda se o template for editado depois.';
comment on function claim_pending_messages(integer) is
  'Reivindica um lote de mensagens vencidas marcando-as como enviando. FOR UPDATE SKIP LOCKED impede que dois disparadores peguem a mesma linha.';
