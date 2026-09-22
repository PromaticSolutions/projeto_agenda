-- Agenda Online — Promatic Solutions
-- Migração 0020: fotos e anexos nos serviços (procedimentos).
-- Rode depois de 0019.
--
-- Uso interno do dono, como services.notes: foto de antes/depois, ficha de
-- anamnese, termo de consentimento, tabela de preparo. NADA daqui aparece na
-- página pública — por isso o bucket é PRIVADO e a tela lê por URL assinada,
-- ao contrário de `studio-media` (0007), que existe justamente para ser
-- exibido a quem agenda.
--
-- Se o SQL Editor recusar alguma linha por falta de privilégio no schema
-- `storage`, o bucket pode ser criado em Storage > New bucket com: nome
-- `service-attachments`, Public = OFF, file size limit 10 MB, MIME types
-- conforme a lista abaixo.

-- =========================================================
-- Bucket privado. O limite casa com MAX_ATTACHMENT_BYTES em
-- src/lib/validation.ts e com o bodySizeLimit de next.config.ts.
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-attachments',
  'service-attachments',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Nenhuma policy de leitura nem de escrita para anon/authenticated: o mesmo
-- desenho da 0007. Upload, remoção e geração de URL assinada passam pelo
-- servidor com a service_role, depois de conferir sessão e dono do estúdio.

-- =========================================================
-- service_attachments — um arquivo do bucket ligado a um serviço.
-- =========================================================
create table if not exists service_attachments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  -- Apagar o serviço de verdade leva os anexos junto. O objeto no Storage é
  -- removido pelo app (deleteService), já que o Postgres não alcança o bucket.
  service_id uuid not null references services (id) on delete cascade,
  -- Caminho dentro do bucket, sempre prefixado por `<studio_id>/`.
  storage_path text not null unique,
  -- Nome original, só para exibir e para o download sair com nome legível.
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  created_at timestamptz not null default now(),

  constraint service_attachments_path_in_studio
    check (storage_path like studio_id::text || '/%'),
  constraint service_attachments_file_name_length
    check (char_length(file_name) between 1 and 200),
  constraint service_attachments_size
    check (size_bytes > 0 and size_bytes <= 10485760)
);

create index if not exists service_attachments_service_idx
  on service_attachments (service_id, created_at);

alter table service_attachments enable row level security;

drop policy if exists "owner manages own service_attachments" on service_attachments;
create policy "owner manages own service_attachments"
  on service_attachments for all
  using (studio_id in (select id from studios where owner_id = auth.uid()))
  with check (studio_id in (select id from studios where owner_id = auth.uid()));

grant select, insert, update, delete on service_attachments to authenticated;
grant all on service_attachments to service_role;

comment on table service_attachments is
  'Fotos e anexos internos de um serviço. Bucket privado service-attachments; não aparece na página pública.';
