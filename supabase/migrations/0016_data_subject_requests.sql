-- Agenda Online — Promatic Solutions
-- Canal formal de solicitação do titular (LGPD art. 18). Rode depois de 0015.

-- =========================================================
-- Por que existe
-- =========================================================
-- A LGPD dá ao titular o direito de pedir acesso, correção e exclusão dos
-- próprios dados, e obriga o controlador a ter POR ONDE receber esse pedido.
-- Num produto multi-tenant o controlador é cada estúdio (ver a seção 1 de
-- /politica-de-privacidade), então o canal precisa chegar ao estúdio certo —
-- daí a solicitação nascer amarrada a `studio_id`, e não numa caixa geral da
-- plataforma.
--
-- O atendimento é MANUAL de propósito: apagar dados de uma cliente pode
-- esbarrar em obrigação de guarda fiscal ou em atendimento em andamento, e
-- automatizar exclusão sem essa avaliação criaria um botão de apagar
-- histórico disfarçado de conformidade. Aqui se registra o pedido, o prazo
-- corre visível, e quem decide é o estúdio.

-- `create type` não aceita `if not exists`; o bloco deixa a migração
-- re-executável, como as demais deste diretório.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'data_request_kind') then
    create type data_request_kind as enum (
      'acesso',     -- art. 18, II — quais dados o estúdio tem sobre mim
      'correcao',   -- art. 18, III — dado incompleto ou desatualizado
      'exclusao',   -- art. 18, VI — eliminação dos dados
      'oposicao'    -- art. 18, § 2º — não quero mais receber lembretes
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'data_request_status') then
    create type data_request_status as enum (
      'aberta',
      'em_andamento',
      'concluida',
      'recusada'    -- com justificativa: guarda legal, por exemplo
    );
  end if;
end $$;

create table if not exists data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,

  kind data_request_kind not null,

  -- Sem FK para `clients`: quem pede exclusão pode nem estar cadastrada, e o
  -- pedido tem que ser aceito mesmo assim. O par (nome, telefone) é o que o
  -- estúdio usa para localizar a pessoa — mesmo identificador do agendamento.
  client_name text not null check (char_length(trim(client_name)) > 0),
  client_phone text not null check (client_phone ~ '^\d{10,15}$'),

  message text,

  status data_request_status not null default 'aberta',
  -- Anotação do estúdio ao fechar: o que foi feito, ou por que foi recusado.
  resolution_note text,
  resolved_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists data_subject_requests_studio_id_idx
  on data_subject_requests (studio_id, created_at desc);

-- Fila de trabalho: o que ainda está aberto, que é o que o estúdio precisa ver.
create index if not exists data_subject_requests_pendentes_idx
  on data_subject_requests (studio_id)
  where status in ('aberta', 'em_andamento');

alter table data_subject_requests enable row level security;

-- Mesma regra das demais tabelas: o dono só enxerga o próprio estúdio. Aqui o
-- `for all` é correto (diferente de `consents`, que é só leitura): resolver a
-- solicitação É a operação do dono, e ela muda `status` e `resolution_note`.
-- A inserção pública passa por /api/data-requests, no servidor, com a service
-- role key — a página pública não ganha escrita anônima direta.
create policy "owner manages own data requests"
  on data_subject_requests for all
  using (studio_id in (select id from studios where owner_id = auth.uid()))
  with check (studio_id in (select id from studios where owner_id = auth.uid()));

-- Mesmo gotcha documentado em 0002_grants.sql: RLS não dispensa o GRANT.
grant all on data_subject_requests to anon, authenticated, service_role;
