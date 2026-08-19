-- Agenda Online — Promatic Solutions
-- Migração 0006: banner do estúdio (item 5) + dados cadastrais do
-- responsável, que alimentam o módulo Configurações (item 6).
-- Rode depois de 0001..0005.

-- =========================================================
-- Identidade visual: studios.logo_url já existia; o banner é a imagem
-- larga de topo da página pública.
-- =========================================================
alter table studios add column if not exists banner_url text;

-- =========================================================
-- Dados cadastrais do responsável.
--
-- Ficam em `studios` e não em `auth.users.raw_user_meta_data` de propósito:
-- metadata de Auth é gravável pelo próprio usuário via API do client (com o
-- access token ele consegue chamar updateUser), então não serve para dado
-- cadastral que a operação precisa considerar confiável. Em `studios` a
-- escrita passa por RLS + Server Action.
--
-- `studios.name` continua sendo o NOME DO SALÃO (exibido ao cliente final).
-- `owner_name` é o nome da pessoa responsável — os dois aparecem separados
-- na tela de Configurações porque frequentemente divergem.
--
-- LGPD: owner_cpf é dado pessoal. Guardado apenas em dígitos, exibido
-- mascarado na interface, nunca em log e nunca na página pública.
-- =========================================================
alter table studios add column if not exists owner_name text;
alter table studios add column if not exists owner_cpf text;
alter table studios add column if not exists owner_birth_date date;
alter table studios add column if not exists acquired_at date;

alter table studios drop constraint if exists studios_owner_cpf_format;
alter table studios
  add constraint studios_owner_cpf_format
  check (owner_cpf is null or owner_cpf ~ '^\d{11}$');

-- Nascimento: nem no futuro, nem implausível. O app também valida idade
-- mínima de 16 anos no Zod; aqui fica só a sanidade grosseira do banco.
alter table studios drop constraint if exists studios_owner_birth_date_range;
alter table studios
  add constraint studios_owner_birth_date_range
  check (
    owner_birth_date is null
    or (owner_birth_date > date '1900-01-01' and owner_birth_date < current_date)
  );

-- Data de aquisição do sistema. Default para os estúdios que já existem:
-- a própria data de criação do registro.
update studios set acquired_at = created_at::date where acquired_at is null;

comment on column studios.banner_url is
  'Imagem larga de topo da página pública. Upload via bucket studio-media (0007).';
comment on column studios.owner_name is
  'Nome do responsável (pessoa). Distinto de studios.name, que é o nome do salão.';
comment on column studios.owner_cpf is
  'CPF do responsável, somente dígitos. Dado pessoal (LGPD) — nunca exposto na página pública.';
comment on column studios.acquired_at is
  'Data de aquisição do sistema pelo estúdio.';
