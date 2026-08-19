-- Agenda Online — Promatic Solutions
-- Migração 0008: configuração de lembretes de agendamento (item 7).
-- Rode depois de 0001..0007.
--
-- ESCOPO: só a configuração. O ENVIO não existe ainda e depende da conexão
-- com o WhatsApp (0009 + Evolution API). Esta tabela é o contrato que o
-- futuro disparador vai ler.

create table if not exists reminder_settings (
  -- 1 estúdio = 1 configuração: a PK é o próprio studio_id, o que torna
  -- impossível criar duas configurações conflitantes para o mesmo estúdio.
  studio_id uuid primary key references studios (id) on delete cascade,

  enabled boolean not null default false,

  -- Antecedência em MINUTOS (não em horas): permite "45 min antes" sem
  -- mudar o schema, e a interface oferece os presets em horas/dias.
  lead_time_minutes integer not null default 1440
    check (lead_time_minutes between 5 and 10080), -- 5 min .. 7 dias

  -- Corpo da mensagem, com marcadores substituídos no envio.
  -- Suportados: {cliente} {servico} {data} {hora} {salao}
  -- A lista canônica vive em src/lib/reminders.ts (REMINDER_PLACEHOLDERS) —
  -- se mudar lá, atualize o comentário aqui.
  message_template text not null default
    'Olá {cliente}! Passando para confirmar seu horário de {servico} em {data} às {hora}. Até logo! — {salao}',

  -- Link opcional ao fim da mensagem (Instagram, site, localização...).
  include_link boolean not null default false,
  link_url text,

  updated_at timestamptz not null default now(),

  constraint reminder_settings_template_length
    check (char_length(trim(message_template)) between 10 and 1000),

  -- Se o link está ligado, precisa existir e ser http(s). Guardar a regra
  -- aqui evita que uma configuração inconsistente chegue ao disparador.
  constraint reminder_settings_link_required
    check (
      include_link = false
      or (link_url is not null and link_url ~* '^https?://[^[:space:]]+$')
    )
);

alter table reminder_settings enable row level security;

drop policy if exists "owner manages own reminder_settings" on reminder_settings;
create policy "owner manages own reminder_settings"
  on reminder_settings for all
  using (studio_id in (select id from studios where owner_id = auth.uid()))
  with check (studio_id in (select id from studios where owner_id = auth.uid()));

-- Mesmo gotcha de 0002_grants.sql: RLS não dispensa o GRANT de tabela.
grant all on reminder_settings to anon, authenticated, service_role;

comment on table reminder_settings is
  'Configuração de lembrete por estúdio. O envio ainda não é implementado — ver 0009_whatsapp_connections.sql.';
comment on column reminder_settings.lead_time_minutes is
  'Antecedência do lembrete, em minutos antes de bookings.start_at.';
comment on column reminder_settings.message_template is
  'Marcadores aceitos: {cliente} {servico} {data} {hora} {salao}.';
