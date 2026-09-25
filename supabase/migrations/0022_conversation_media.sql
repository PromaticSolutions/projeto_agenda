-- 0022 — Mídia das conversas guardada no app.
--
-- Até aqui (0019) o app não guardava arquivo nenhum: a foto ou o áudio era
-- pedido à Evolution toda vez que o balão aparecia na tela, só com o id da
-- mensagem. Isso depende de a Evolution ter a mensagem no banco DELA — e a
-- instalação de referência (deploy/evolution) grava com
-- DATABASE_SAVE_DATA_NEW_MESSAGE=false. Resultado: foto e áudio de cliente
-- apareciam como "não está mais disponível".
--
-- Agora o arquivo é baixado UMA vez e guardado aqui, num bucket privado:
--   - mensagem nova: no próprio webhook, que tem a mensagem inteira (com a
--     chave de mídia), então o download funciona mesmo sem a Evolution guardar
--     nada;
--   - mensagem antiga: na primeira vez que o balão pede o arquivo, ou pela
--     recuperação em lote da tela de Conversas.
--
-- `media_status`:
--   nulo          ainda não tentado (ou tentativa anterior falhou por erro
--                 transitório — o gateway fora do ar, por exemplo);
--   'salva'       o arquivo está em `media_path`;
--   'indisponivel' o WhatsApp/Evolution respondeu que o arquivo não existe
--                 mais. Não se tenta de novo: a tela diz isso direto.
--
-- LGPD: o arquivo pertence à conversa. Excluir a cliente apaga as mensagens
-- em cascata, e `deleteClient` (src/lib/data/clients.ts) remove os objetos do
-- bucket logo depois. O bucket é privado e só é lido pelo servidor, depois de
-- a RLS confirmar que a mensagem é do estúdio.

alter table whatsapp_messages
  add column if not exists media_path text,
  add column if not exists media_mime text,
  add column if not exists media_status text;

alter table whatsapp_messages
  drop constraint if exists whatsapp_messages_media_status_check,
  add constraint whatsapp_messages_media_status_check
    check (media_status is null or media_status in ('salva', 'indisponivel'));

alter table whatsapp_messages
  drop constraint if exists whatsapp_messages_media_path_in_studio,
  add constraint whatsapp_messages_media_path_in_studio
    check (media_path is null or media_path like studio_id::text || '/%');

-- A recuperação em lote procura "mídia ainda não tentada" do estúdio.
create index if not exists whatsapp_messages_media_pending_idx
  on whatsapp_messages (studio_id, sent_at desc)
  where media_status is null and message_type <> 'texto';

-- Privado, sem política para `authenticated`: só a service_role lê e grava,
-- sempre pelo servidor. 25 MB cobre áudio e vídeo curtos do WhatsApp; o que
-- passar disso continua sendo buscado sob demanda, sem ficar guardado.
insert into storage.buckets (id, name, public, file_size_limit)
values ('conversation-media', 'conversation-media', false, 26214400)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

comment on column whatsapp_messages.media_path is
  'Objeto no bucket privado conversation-media (<studio_id>/<message_id>). Nulo = arquivo ainda não guardado.';
comment on column whatsapp_messages.media_status is
  'nulo = não tentado; salva = em media_path; indisponivel = o WhatsApp não tem mais o arquivo.';
