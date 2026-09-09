-- Agenda Online — Promatic Solutions
-- Remetente de nível PLATAFORMA: o WhatsApp por onde saem os avisos que não
-- pertencem a nenhum estúdio (hoje: lead novo na landing). Rode depois de 0016.

-- =========================================================
-- Por que o outbox precisa aceitar mensagem sem estúdio
-- =========================================================
-- Até aqui toda mensagem era de um inquilino: o disparador deriva a instância
-- da Evolution de `instanceNameForStudio(studio_id)`, e a policy de leitura
-- mostra ao dono só o que é dele. O aviso de lead não se encaixa nisso — ele é
-- da plataforma, e mandá-lo pela instância de algum estúdio significaria usar o
-- WhatsApp de um cliente para tráfego que não é dele.
--
-- Com `studio_id` nulo, a linha continua fora do alcance de qualquer dono: a
-- policy compara `studio_id in (...)`, e nulo não casa com nada. O índice
-- único de idempotência é parcial em `booking_id is not null`, então avisos
-- sem agendamento também não colidem entre si.
alter table message_outbox alter column studio_id drop not null;

comment on column message_outbox.studio_id is
  'Nulo = mensagem da própria plataforma (ver platform_whatsapp), enviada pela instância de plataforma em vez da instância do estúdio.';

-- =========================================================
-- A conexão da plataforma
-- =========================================================
-- LINHA ÚNICA por construção: `id boolean primary key default true` com o
-- check só aceita `true`, então a segunda inserção esbarra na chave primária.
-- Mais honesto que uma tabela livre com a convenção "use sempre a primeira
-- linha", que a primeira consulta errada quebra.
--
-- As colunas espelham `whatsapp_connections` (0009) de propósito: é a mesma
-- máquina de estados, e a tela de pareamento é a mesma. O que ela tem a mais é
-- `notify_phone` — o DESTINO do aviso, que aqui é config e não dado derivado.
create table if not exists platform_whatsapp (
  id boolean primary key default true check (id),

  status whatsapp_connection_status not null default 'desconectado',
  instance_name text,
  connected_phone text check (connected_phone is null or connected_phone ~ '^\d{10,15}$'),

  -- Para onde o aviso de lead vai. Pode ser o MESMO número conectado — nesse
  -- caso a mensagem cai em "Mensagem para você mesmo", que é o arranjo de quem
  -- só tem um chip. Nulo = ninguém é avisado, e a fila nem chega a nascer.
  notify_phone text check (notify_phone is null or notify_phone ~ '^\d{10,15}$'),

  last_error text,
  last_connected_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table platform_whatsapp enable row level security;

-- Só admin de plataforma enxerga, e mesmo assim só para LER: a escrita passa
-- por server action com service role, como o resto do superadmin. Dono de
-- estúdio não tem nada que ver a conexão da plataforma — nem o número.
drop policy if exists "platform admin reads platform_whatsapp" on platform_whatsapp;
create policy "platform admin reads platform_whatsapp"
  on platform_whatsapp for select
  using (exists (select 1 from platform_admins where user_id = auth.uid()));

grant all on platform_whatsapp to anon, authenticated, service_role;

-- A linha nasce junto com a tabela: a tela de configuração lê antes de existir
-- qualquer clique, e um `maybeSingle` devolvendo nulo obrigaria toda leitura a
-- tratar "ainda não inicializado" como caso à parte.
insert into platform_whatsapp (id) values (true) on conflict (id) do nothing;

comment on table platform_whatsapp is
  'Linha única: a sessão de WhatsApp da própria plataforma e o número que recebe os avisos de lead.';
