-- Agenda Online — Promatic Solutions
-- Migração 0007: bucket de Storage para logo e banner do estúdio (item 5).
-- Rode depois de 0001..0006.
--
-- Se o SQL Editor recusar alguma linha por falta de privilégio no schema
-- `storage` (acontece em projetos mais antigos), o mesmo bucket pode ser
-- criado pelo Dashboard em Storage > New bucket, com: nome `studio-media`,
-- Public = ON, file size limit 4 MB, MIME types conforme a lista abaixo.

-- =========================================================
-- Bucket público: as imagens são exibidas na página de agendamento, que é
-- aberta e sem sessão — servir por URL pública é o comportamento desejado.
-- "Público" vale só para LEITURA; a escrita está fechada (ver policies).
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studio-media',
  'studio-media',
  true,
  4194304, -- 4 MB; o app rejeita antes disso, em validation.ts
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- =========================================================
-- Escrita: NENHUMA policy para anon/authenticated — de propósito.
--
-- O upload não acontece do browser direto para o Storage. O arquivo vai
-- para uma Server Action (uploadStudioImageAction), que confere sessão,
-- tipo MIME real e tamanho, e só então grava usando a service_role key —
-- que ignora RLS. Assim o browser nunca recebe permissão de escrita no
-- bucket, e validação de arquivo não fica do lado do cliente, onde seria
-- trivial burlar.
--
-- As duas policies abaixo são explícitas para deixar a intenção registrada
-- e evitar que alguém "conserte" o upload abrindo escrita para
-- authenticated mais tarde sem perceber o desenho.
-- =========================================================
drop policy if exists "studio-media public read" on storage.objects;
create policy "studio-media public read"
  on storage.objects for select
  using (bucket_id = 'studio-media');

drop policy if exists "studio-media owner writes via server" on storage.objects;
create policy "studio-media owner writes via server"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'studio-media');
