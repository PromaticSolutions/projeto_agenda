-- Timely — Promatic Solutions
-- Migração 0026: agente de IA que responde o WhatsApp do estúdio.
-- Rode depois de 0001..0025.
--
-- O que entra:
--   1. `studio_agents` — a configuração do agente de CADA estúdio: ligado ou
--      não, qual IA (provedor, modelo, chave), transcrição de áudio e como ele
--      fala. Configurada só pelo superadmin.
--   2. `agent_chat_state` — pausa por conversa. Quando um humano responde (pelo
--      celular ou pelo painel), o agente se cala naquela conversa por um tempo,
--      senão os dois respondem ao mesmo tempo.
--   3. `agent_runs` — o registro de cada vez que o agente agiu ou deixou de
--      agir, e por quê. É o que a tela do superadmin mostra para dizer se está
--      funcionando.
--   4. `whatsapp_messages.sent_by` e `.transcript` — quem mandou a resposta
--      (agente ou painel) e o texto do áudio transcrito.
--
-- As três tabelas novas ficam com RLS ligada e SEM policy: só a service_role
-- lê e escreve. Nem o dono do estúdio vê — a chave de API mora aqui, e quem
-- configura é a Promatic.

create table if not exists studio_agents (
  studio_id uuid primary key references studios(id) on delete cascade,
  enabled boolean not null default false,

  -- A IA que conversa. `custom` = qualquer API no formato da OpenAI.
  provider text not null default 'gemini'
    check (provider in ('gemini', 'groq', 'openrouter', 'openai', 'anthropic', 'custom')),
  base_url text,
  model text,
  -- Cifrada pelo app (AES-256-GCM). O banco nunca vê a chave em claro.
  api_key_encrypted text,
  api_key_last4 text,

  -- Transcrição de áudio (Whisper). `desligado` = o agente pede para escrever.
  transcription_provider text not null default 'desligado'
    check (transcription_provider in ('desligado', 'groq', 'openai', 'custom')),
  transcription_base_url text,
  transcription_model text,
  transcription_key_encrypted text,
  transcription_key_last4 text,

  -- Como ele fala e até onde vai.
  assistant_name text,
  tone text not null default 'acolhedor'
    check (tone in ('acolhedor', 'profissional', 'descontraido')),
  instructions text,
  can_book boolean not null default true,
  handoff_hours integer not null default 6 check (handoff_hours between 1 and 168),
  max_replies_per_day integer not null default 300 check (max_replies_per_day between 1 and 5000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table studio_agents enable row level security;

create table if not exists agent_chat_state (
  studio_id uuid not null references studios(id) on delete cascade,
  chat_id text not null,
  paused_until timestamptz,
  paused_reason text,
  updated_at timestamptz not null default now(),
  primary key (studio_id, chat_id)
);

alter table agent_chat_state enable row level security;

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  chat_id text not null,
  status text not null
    check (status in ('respondeu', 'pausado', 'humano', 'limite', 'erro', 'simulacao')),
  detail text,
  reply text,
  tools_used text[] not null default '{}',
  input_tokens integer,
  output_tokens integer,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists agent_runs_studio_idx on agent_runs (studio_id, created_at desc);

alter table agent_runs enable row level security;

alter table whatsapp_messages
  add column if not exists sent_by text check (sent_by in ('agente', 'painel'));
alter table whatsapp_messages
  add column if not exists transcript text;

comment on table studio_agents is
  'Agente de IA do WhatsApp por estúdio (0026). Só service_role; a chave de API é cifrada pelo app.';
comment on table agent_chat_state is
  'Pausa do agente por conversa depois que um humano responde (0026).';
comment on table agent_runs is
  'Registro de cada ação do agente de IA — o que a tela do superadmin mostra (0026).';
comment on column whatsapp_messages.sent_by is
  'Quem mandou a resposta: agente ou painel. Nulo = recebida ou digitada no celular (0026).';
comment on column whatsapp_messages.transcript is
  'Texto do áudio, transcrito para o agente de IA (0026).';
