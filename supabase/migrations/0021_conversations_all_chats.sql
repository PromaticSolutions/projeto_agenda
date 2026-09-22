-- Agenda Online — Promatic Solutions
-- Migração 0021: a caixa de mensagens deixa de ser só das clientes.
-- Rode depois de 0020.
--
-- MUDANÇA DE ESCOPO, por decisão do dono do produto (2026-09-22). A 0019 só
-- gravava mensagem de número que já existisse em `clients`; tudo mais era
-- descartado na entrada. Na prática isso escondia justamente quem ainda não é
-- cliente — a pessoa que pergunta preço antes de marcar — e fazia a tela
-- parecer quebrada quando a mensagem não aparecia.
--
-- Agora TODA conversa do número do estúdio é gravada, inclusive grupo. Quem
-- separa uma coisa da outra é a tela, com o filtro "só clientes".
--
-- O QUE ISSO SIGNIFICA, dito sem rodeio: conversa pessoal, de fornecedor e de
-- grupo do número conectado passa a ficar no nosso banco. É o número do
-- estúdio e a escolha é de quem o conecta, mas o produto precisa dizer isso na
-- tela de conexão em vez de deixar implícito.
--
-- A conversa continua guardando só TEXTO e o TIPO da mídia, nunca o arquivo.

-- =========================================================
-- A conversa passa a ser identificada pelo CHAT, não pela cliente.
-- =========================================================
-- `client_id` deixa de ser obrigatório: conversa de quem não está no cadastro
-- tem chat mas não tem cliente. A coluna continua existindo, e continua sendo
-- preenchida quando o número bate com uma cliente, por um motivo específico:
-- é o `on delete cascade` dela que faz o pedido de exclusão do titular (0016)
-- apagar também as mensagens, pelo botão que já existe na tela de Clientes.
alter table whatsapp_messages alter column client_id drop not null;

-- `chat_id` é o JID do WhatsApp: "5511999999999@s.whatsapp.net" numa conversa
-- de uma pessoa, "1203...@g.us" num grupo. É o que agrupa a conversa.
alter table whatsapp_messages add column if not exists chat_id text;
-- Só dígitos, e nulo em grupo. É por ele que se acha a cliente do cadastro.
alter table whatsapp_messages add column if not exists chat_phone text;
-- Nome que o WhatsApp mostra (pushName) ou assunto do grupo, quando vem.
alter table whatsapp_messages add column if not exists chat_name text;
-- Em grupo, quem falou: sem isso a conversa vira um monte de balão anônimo.
alter table whatsapp_messages add column if not exists sender_name text;
alter table whatsapp_messages add column if not exists is_group boolean not null default false;

-- Base que já tenha mensagens da 0019: o chat era sempre a conversa individual
-- com a cliente. Sem isto, as linhas antigas ficariam sem chat e sumiriam.
update whatsapp_messages m
set chat_id = c.phone || '@s.whatsapp.net',
    chat_phone = c.phone,
    chat_name = coalesce(m.chat_name, c.name)
from clients c
where c.id = m.client_id and m.chat_id is null;

-- Sobrou linha sem cliente e sem chat? Não deveria existir, mas apagar dado é
-- pior: o chat vira o próprio id, e a tela ao menos mostra a conversa.
update whatsapp_messages set chat_id = 'desconhecido:' || id where chat_id is null;

alter table whatsapp_messages alter column chat_id set not null;

alter table whatsapp_messages drop constraint if exists whatsapp_messages_chat_id_length;
alter table whatsapp_messages
  add constraint whatsapp_messages_chat_id_length
  check (char_length(chat_id) between 1 and 128);

alter table whatsapp_messages drop constraint if exists whatsapp_messages_chat_phone_format;
alter table whatsapp_messages
  add constraint whatsapp_messages_chat_phone_format
  check (chat_phone is null or chat_phone ~ '^\d{10,15}$');

-- Grupo não tem telefone do outro lado, e conversa de uma pessoa sempre tem.
alter table whatsapp_messages drop constraint if exists whatsapp_messages_group_has_no_phone;
alter table whatsapp_messages
  add constraint whatsapp_messages_group_has_no_phone
  check (case when is_group then chat_phone is null else chat_phone is not null end);

-- =========================================================
-- Índices: a conversa aberta e o contador de não lidas agora são por chat.
-- =========================================================
drop index if exists whatsapp_messages_thread_idx;
drop index if exists whatsapp_messages_unread_idx;

create index if not exists whatsapp_messages_chat_idx
  on whatsapp_messages (studio_id, chat_id, sent_at desc);

create index if not exists whatsapp_messages_unread_idx
  on whatsapp_messages (studio_id, chat_id)
  where direction = 'recebida' and read_at is null;

-- O cascade da exclusão do titular varre por cliente.
create index if not exists whatsapp_messages_client_idx
  on whatsapp_messages (client_id)
  where client_id is not null;

-- =========================================================
-- br_phone_variant — a outra forma do mesmo celular brasileiro.
-- =========================================================
-- Conta antiga conversa pelo JID sem o nono dígito ("551187654321") enquanto o
-- cadastro guarda com o 9 ("5511987654321"). A view precisa casar as duas, ou
-- metade das clientes apareceria como se não fosse cliente.
--
-- É a mesma regra de `phoneVariants` em src/lib/whatsapp/inbound.ts. Existir
-- nos dois lugares é proposital (a view não chama o app), mas quem mexer em um
-- precisa mexer no outro.
--
-- Só celular: local de 8 dígitos começando em 2–5 é fixo, e pôr um 9 na frente
-- fabricaria o número de outra pessoa.
create or replace function br_phone_variant(phone text)
returns text language sql immutable as $$
  select case
    when phone is null or left(phone, 2) <> '55' then null
    when length(phone) = 12 and substring(phone from 5 for 1) between '6' and '9'
      then overlay(phone placing '9' from 5 for 0)
    when length(phone) = 13 and substring(phone from 5 for 1) = '9'
      and substring(phone from 6 for 1) between '6' and '9'
      then overlay(phone placing '' from 5 for 1)
  end
$$;

-- =========================================================
-- A lista de conversas, agora por chat.
-- =========================================================
-- Quem é cliente é decidido AQUI, por telefone, e não pela coluna `client_id`
-- gravada quando a mensagem chegou. A diferença aparece no caso que mais
-- importa: a pessoa manda mensagem, o estúdio gosta e a cadastra depois — a
-- conversa passa a contar como de cliente na hora, sem precisar reescrever
-- mensagem nenhuma.
--
-- `drop` antes de criar porque `create or replace view` não aceita renomear
-- nem remover coluna, e as da 0019 (client_name, client_phone) saíram.
drop view if exists whatsapp_conversations;

create view whatsapp_conversations
with (security_invoker = true) as
select distinct on (m.studio_id, m.chat_id)
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
from whatsapp_messages m
left join lateral (
  select cl.id, cl.name
  from clients cl
  where cl.studio_id = m.studio_id
    and not m.is_group
    and cl.phone in (m.chat_phone, br_phone_variant(m.chat_phone))
  -- Cadastro com as duas formas do mesmo celular: vale a que bate exatamente.
  order by (cl.phone = m.chat_phone) desc, cl.created_at
  limit 1
) c on true
order by m.studio_id, m.chat_id, m.sent_at desc, m.created_at desc;

grant select on whatsapp_conversations to authenticated, service_role;

comment on table whatsapp_messages is
  'Conversas de WhatsApp do número do estúdio, com clientes ou não, inclusive grupos (0021). Só texto e tipo da mídia, nunca o arquivo.';
comment on column whatsapp_messages.chat_id is
  'JID do WhatsApp: "<numero>@s.whatsapp.net" ou "<id>@g.us". Agrupa a conversa.';
comment on column whatsapp_messages.client_id is
  'Preenchido quando o número é de uma cliente cadastrada. Serve ao cascade da exclusão do titular; quem decide o que a tela mostra é a view.';
comment on view whatsapp_conversations is
  'Uma linha por conversa: a última mensagem, o nome a exibir, se é grupo e se o número é de uma cliente.';
