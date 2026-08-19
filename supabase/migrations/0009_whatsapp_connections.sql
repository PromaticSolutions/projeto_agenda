-- Agenda Online — Promatic Solutions
-- Migração 0009: estado da conexão com o WhatsApp (item 8).
-- Rode depois de 0001..0008.
--
-- ESCOPO DESTA ETAPA: só a estrutura. A integração com a Evolution API NÃO
-- está implementada — não há chamada de rede, não há pareamento real. A
-- tabela existe para que a tela de conexão tenha onde persistir estado e
-- para que o adaptador da Evolution, quando entrar, não precise de migração
-- de schema.
--
-- IMPORTANTE — o que NÃO fica aqui: a API key e a URL base da Evolution API
-- são credenciais de serviço e vão em variável de ambiente
-- (EVOLUTION_API_URL / EVOLUTION_API_KEY), nunca em coluna de banco lida
-- pelo app. Guardar segredo em tabela multi-tenant é como o vazamento
-- costuma começar.

-- `create type` não aceita `if not exists`; o bloco deixa a migração
-- re-executável, como as demais deste diretório.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'whatsapp_connection_status') then
    create type whatsapp_connection_status as enum (
      'desconectado',  -- estado inicial e após desconectar
      'conectando',    -- QR code emitido, aguardando leitura no aparelho
      'conectado',     -- sessão ativa na Evolution API
      'erro'           -- falha de pareamento ou sessão derrubada
    );
  end if;
end $$;

create table if not exists whatsapp_connections (
  -- 1 estúdio = 1 número conectado.
  studio_id uuid primary key references studios (id) on delete cascade,

  status whatsapp_connection_status not null default 'desconectado',

  -- Nome da instância na Evolution API. Preenchido pelo adaptador futuro;
  -- por ora fica nulo.
  instance_name text,

  -- Número efetivamente pareado, em E.164 sem "+" (mesmo formato de
  -- studios.whatsapp e bookings.client_phone).
  connected_phone text check (connected_phone is null or connected_phone ~ '^\d{10,15}$'),

  -- Mensagem de erro legível da última tentativa, para a tela mostrar em vez
  -- de um estado "erro" mudo.
  last_error text,

  last_connected_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table whatsapp_connections enable row level security;

drop policy if exists "owner manages own whatsapp_connection" on whatsapp_connections;
create policy "owner manages own whatsapp_connection"
  on whatsapp_connections for all
  using (studio_id in (select id from studios where owner_id = auth.uid()))
  with check (studio_id in (select id from studios where owner_id = auth.uid()));

grant all on whatsapp_connections to anon, authenticated, service_role;

comment on table whatsapp_connections is
  'Estado da sessão de WhatsApp por estúdio. Estrutura preparada para a Evolution API — integração ainda NÃO implementada.';
comment on column whatsapp_connections.instance_name is
  'Identificador da instância na Evolution API. Nulo enquanto a integração não existir.';
