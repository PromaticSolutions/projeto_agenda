-- Timely — Promatic Solutions
-- Migração 0025: a lista de conversas volta a abrir depois de uma importação.
-- Rode depois de 0001..0023.
--
-- O problema: a view da 0021 calculava a cliente (o `lateral` em `clients`) e o
-- contador de não lidas para CADA mensagem, e só no fim o `distinct on` jogava
-- fora todas menos a última de cada chat. Com ~18 mil mensagens importadas e
-- ~100 conversas, eram 18 mil buscas de cliente e 18 mil contagens para
-- aproveitar 100. Pela sessão do dono, com a RLS por cima, passava do
-- `statement_timeout` do papel `authenticated` e /app/conversations caía no
-- "Algo deu errado".
--
-- A correção: escolher primeiro a última mensagem de cada chat (o `distinct on`
-- numa subconsulta, servido por `whatsapp_messages_chat_idx`) e só então
-- buscar cliente e contar não lidas — uma vez por CONVERSA.
--
-- Mesmas colunas, na mesma ordem e com os mesmos tipos da 0021, então
-- `create or replace` basta e nada no app muda.

create or replace view whatsapp_conversations
with (security_invoker = true) as
select
  m.studio_id,
  m.chat_id,
  m.chat_phone,
  m.is_group,
  c.id as client_id,
  -- O nome que a tela mostra: o do cadastro quando existe, senão o que o
  -- WhatsApp informou, senão o próprio número.
  coalesce(c.name, m.chat_name, m.chat_phone, m.chat_id) as display_name,
  m.body as last_body,
  m.message_type as last_type,
  m.direction as last_direction,
  m.sent_at as last_at,
  (
    select count(*)::integer
    from whatsapp_messages u
    where u.studio_id = m.studio_id
      and u.chat_id = m.chat_id
      and u.direction = 'recebida'
      and u.read_at is null
  ) as unread_count
from (
  select distinct on (w.studio_id, w.chat_id) w.*
  from whatsapp_messages w
  order by w.studio_id, w.chat_id, w.sent_at desc, w.created_at desc
) m
left join lateral (
  select cl.id, cl.name
  from clients cl
  where cl.studio_id = m.studio_id
    and not m.is_group
    and cl.phone in (m.chat_phone, br_phone_variant(m.chat_phone))
  -- Cadastro com as duas formas do mesmo celular: vale a que bate exatamente.
  order by (cl.phone = m.chat_phone) desc, cl.created_at
  limit 1
) c on true;

grant select on whatsapp_conversations to authenticated, service_role;
