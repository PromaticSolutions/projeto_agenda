-- Timely — Promatic Solutions
-- Migração 0027: integrações de IA — as chaves de API viram um cadastro só.
-- Rode depois de 0001..0026.
--
-- Antes (0026) cada estúdio guardava a própria chave. Agora a chave é
-- cadastrada UMA vez em /superadmin/integracoes, com apelido, e o app descobre
-- o provedor e os modelos que ela libera. No agente de cada estúdio só se
-- escolhe a integração e o modelo.
--
-- As colunas de chave da 0026 continuam em `studio_agents` como caminho
-- antigo: um agente sem integração escolhida ainda usa a chave própria.

create table if not exists ai_integrations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  provider text not null
    check (provider in ('gemini', 'groq', 'openrouter', 'openai', 'anthropic', 'custom')),
  base_url text,
  -- Cifrada pelo app (AES-256-GCM), como na 0026.
  api_key_encrypted text not null,
  api_key_last4 text not null,
  -- Lista de modelos lida do provedor: [{ id, name, kind, free }].
  models jsonb not null default '[]'::jsonb,
  models_updated_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ai_integrations enable row level security;

alter table studio_agents
  add column if not exists integration_id uuid references ai_integrations(id) on delete set null;
alter table studio_agents
  add column if not exists transcription_integration_id uuid references ai_integrations(id) on delete set null;

comment on table ai_integrations is
  'Chaves de API de IA cadastradas no superadmin, com os modelos de cada uma (0027). Só service_role.';
comment on column studio_agents.integration_id is
  'Integração que responde as conversas deste estúdio (0027). Nula = usa a chave própria da 0026.';
comment on column studio_agents.transcription_integration_id is
  'Integração que transcreve os áudios (0027). Nula = usa a configuração da 0026.';
