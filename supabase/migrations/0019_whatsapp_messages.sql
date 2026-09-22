-- Agenda Online — Promatic Solutions
-- Conversas de WhatsApp com as clientes cadastradas (/app/conversations).
-- Rode depois de 0018.
--
-- ATÉ AQUI O PRODUTO SÓ ENVIAVA. Esta migração muda isso por decisão do dono
-- do produto (2026-09-15, ver DECISIONS.md): o estúdio passa a ler e responder,
-- dentro do painel, as conversas que tem com as PRÓPRIAS clientes.
--
-- O recorte que torna isso aceitável do ponto de vista de dado pessoal está no
-- webhook, não na tela: só vira linha aqui a mensagem trocada com um número que
-- já existe em `clients` daquele estúdio. Conversa com família, fornecedor ou
-- grupo nunca chega ao banco. Não é "gravado e escondido", é descartado na
-- entrada.
--
-- Mídia também não entra: foto, áudio e documento viram uma linha com o TIPO e
-- a legenda, sem o arquivo. Baixar mídia de cliente para a nossa infraestrutura
-- seria outra conversa (armazenamento, retenção, LGPD) que ninguém pediu.

-- `create type` não aceita `if not exists`; o bloco deixa a migração
-- re-executável, como as demais deste diretório.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'whatsapp_message_direction') then
    create type whatsapp_message_direction as enum (
      'recebida',  -- a cliente mandou
      'enviada'    -- saiu do número do estúdio: pelo painel, lembrete ou celular do dono
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'whatsapp_message_type') then
    create type whatsapp_message_type as enum (
      'texto',
      'imagem',
      'video',
      'audio',
      'documento',
      'figurinha',
      'localizacao',
      'contato',
      'outro'      -- tipo que a tela não sabe desenhar; aparece como "abra no celular"
    );
  end if;
end $$;

create table if not exists whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,

  -- Apagar a cliente apaga a conversa. É o que torna o pedido de exclusão do
  -- titular (0016) atendível pelo botão que já existe na tela de Clientes, sem
  -- uma segunda faxina que alguém precisaria lembrar de fazer.
  client_id uuid not null references clients (id) on delete cascade,

  direction whatsapp_message_direction not null,
  message_type whatsapp_message_type not null default 'texto',

  -- Texto, legenda ou nome do arquivo. Nulo para mídia sem legenda.
  body text check (body is null or char_length(body) <= 8192),

  -- `key.id` do WhatsApp. É a chave de idempotência: a Evolution repete a
  -- entrega que não recebeu 200, e a resposta enviada pelo painel é gravada na
  -- hora E volta pelo webhook (`send.message`). O índice único abaixo é o que
  -- faz as duas cópias virarem uma.
  provider_message_id text not null check (char_length(provider_message_id) between 1 and 128),

  -- Horário do WhatsApp, não o da chegada do webhook: entrega atrasada não pode
  -- embaralhar a ordem da conversa.
  sent_at timestamptz not null,

  -- Só faz sentido em mensagem recebida: é o "não lida" da lista.
  read_at timestamptz,

  created_at timestamptz not null default now(),

  constraint whatsapp_messages_studio_provider_uniq unique (studio_id, provider_message_id)
);

-- A conversa aberta: mensagens de uma cliente, da mais nova para a mais antiga.
create index if not exists whatsapp_messages_thread_idx
  on whatsapp_messages (studio_id, client_id, sent_at desc);

-- A contagem de não lidas roda para cada conversa da lista a cada atualização
-- da tela. Parcial porque o que interessa é uma fração pequena da tabela.
create index if not exists whatsapp_messages_unread_idx
  on whatsapp_messages (studio_id, client_id)
  where direction = 'recebida' and read_at is null;

alter table whatsapp_messages enable row level security;

-- O dono LÊ as conversas do próprio estúdio. Escrita só por service_role: quem
-- grava é o webhook (sem sessão) e as actions do painel, que já resolveram o
-- estúdio por `getMyStudio()`. Sem policy de insert para `authenticated`, de
-- propósito: ninguém fabrica mensagem "recebida" a partir do navegador.
drop policy if exists "owner reads own whatsapp_messages" on whatsapp_messages;
create policy "owner reads own whatsapp_messages"
  on whatsapp_messages for select
  using (studio_id in (select id from studios where owner_id = auth.uid()));

grant select on whatsapp_messages to authenticated;
grant all on whatsapp_messages to service_role;

-- =========================================================
-- A lista de conversas
-- =========================================================
-- Uma linha por cliente com mensagem: a última, e quantas recebidas estão sem
-- ler. Em view, e não montado no app, porque o app teria de puxar TODAS as
-- mensagens do estúdio para descobrir a última de cada cliente — e o PostgREST
-- corta em mil linhas sem avisar (ver src/lib/supabase/paginate.ts).
--
-- `security_invoker` faz a view respeitar a RLS de quem consulta. Sem ele, a
-- view rodaria com os privilégios do dono dela e qualquer usuário autenticado
-- leria a lista de conversas de todos os estúdios.
create or replace view whatsapp_conversations
with (security_invoker = true) as
select distinct on (m.studio_id, m.client_id)
  m.studio_id,
  m.client_id,
  c.name as client_name,
  c.phone as client_phone,
  m.body as last_body,
  m.message_type as last_type,
  m.direction as last_direction,
  m.sent_at as last_at,
  (
    select count(*)::integer
    from whatsapp_messages u
    where u.studio_id = m.studio_id
      and u.client_id = m.client_id
      and u.direction = 'recebida'
      and u.read_at is null
  ) as unread_count
from whatsapp_messages m
join clients c on c.id = m.client_id
order by m.studio_id, m.client_id, m.sent_at desc, m.created_at desc;

grant select on whatsapp_conversations to authenticated, service_role;

comment on table whatsapp_messages is
  'Conversas de WhatsApp do estúdio com clientes CADASTRADAS. Número fora de clients é descartado no webhook. Só texto e tipo da mídia, nunca o arquivo.';
comment on view whatsapp_conversations is
  'Última mensagem e não lidas por cliente. security_invoker: respeita a RLS de whatsapp_messages.';
