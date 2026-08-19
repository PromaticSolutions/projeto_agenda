# Timely — Promatic Solutions

Sistema de agendamento online multi-tenant: cada estúdio tem sua página
pública (`/[slug]`) para clientes marcarem horário sem login, e um painel
autenticado (`/app`) para o dono gerenciar serviços, horários e agenda.

## Rodando o projeto

```bash
nvm use          # o projeto está fixado em Node 20 (.nvmrc)
npm install
npm run dev       # http://localhost:3000
```

Outros comandos úteis:

```bash
npm run typecheck # tsc --noEmit
npm run lint       # eslint
npm run test        # vitest (algoritmo de disponibilidade)
npm run build       # build de produção
```

## Configurando o Supabase

Copie `.env.local.example` para `.env.local` e preencha com as chaves do
seu projeto (supabase.com → seu projeto → Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...       # secreta! nunca comitar, nunca prefixar com NEXT_PUBLIC_
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Depois de preencher as chaves, rode as migrações, em ordem** —
[`0001_init.sql`](supabase/migrations/0001_init.sql),
[`0002_grants.sql`](supabase/migrations/0002_grants.sql),
[`0003_platform_admins.sql`](supabase/migrations/0003_platform_admins.sql) e
[`0004_clients.sql`](supabase/migrations/0004_clients.sql) — no SQL Editor
do seu projeto (Dashboard → SQL Editor → New query, cole o arquivo inteiro
e rode), ou via qualquer conexão direta ao Postgres. Isso cria as tabelas,
a constraint anti-colisão de horário, as policies de RLS, os grants de
tabela e (0004) a tabela de clientes + o backfill a partir dos bookings
já existentes.

> Já aplicadas no projeto `mcgecpnpxilrhavtbsfn` referenciado em
> `.env.local` (2026-07-23): as 5 tabelas, RLS, a exclusion constraint
> `bookings_no_overlap` e os grants estão todos confirmados via consulta
> direta ao Postgres e via PostgREST. `npm run dev` já lê/escreve no banco
> real — não precisa rodar nada manualmente para este projeto.

Se quiser testar sem Supabase, **não precisa fazer nada**: sem
`.env.local`, o app inteiro roda contra um store em memória (estúdio
fictício "Bella Studio", slug `bella-studio`) — dá pra navegar em `/app` e
em `/bella-studio` sem configurar nada. Ver `src/lib/mock/store.ts` e
[DECISIONS.md](DECISIONS.md).

### Confirmação de e-mail no Supabase Auth

Por padrão, projetos novos do Supabase exigem confirmação de e-mail no
cadastro (`/signup`). Se quiser testar o fluxo de onboarding sem configurar
um provedor de e-mail, desative em Authentication → Providers → Email →
"Confirm email" no dashboard do seu projeto.

## Estrutura

- `src/app/[slug]` — página pública de agendamento.
- `src/app/app/onboarding` — criação do estúdio (fora do grupo autenticado).
- `src/app/app/(dashboard)` — painel do dono (serviços, horários, agenda do dia, agendamento manual, clientes).
- `src/app/app/(dashboard)/clients` — CRM básico: lista de clientes, histórico de agendamentos e notas.
- `src/app/api/bookings` — API route que revalida disponibilidade e cria o booking.
- `src/lib/availability.ts` — algoritmo de horários livres (com testes).
- `src/lib/data/*` — camada de dados; alterna Supabase real ↔ mock conforme `.env.local`.
- `src/lib/mock/store.ts` — dados fictícios usados quando o Supabase não está configurado.
- `supabase/migrations/0001_init.sql` — schema + RLS + constraint anti-colisão.

Decisões e riscos documentados em [DECISIONS.md](DECISIONS.md) e
[RISKS.md](RISKS.md). Status do projeto em [REPORT.md](REPORT.md).

## Lembretes no WhatsApp

O envio tem três peças: uma **fila** no Postgres, um **disparador** exposto
como rota HTTP, e um **gateway** (Evolution API) que fala com o WhatsApp.

```
cron (a cada 5 min)  →  /api/cron/reminders  →  planeja + envia
                                                  ↓
                                     message_outbox (fila, 0010)
                                                  ↓
                                        Evolution API → WhatsApp
```

Sem `EVOLUTION_API_URL`/`EVOLUTION_API_KEY` o app **não quebra**: a fila
continua sendo planejada e dá para acompanhá-la em `/app/whatsapp`, mas nada é
enviado. Isso é de propósito — permite conferir o planejamento antes da VPS
existir. O que nunca acontece é uma mensagem ser marcada como enviada sem ter
saído.

### 1. Rode a migração 0010

[`0010_message_outbox.sql`](supabase/migrations/0010_message_outbox.sql) cria a
fila e a função `claim_pending_messages`. Sem ela o disparador devolve 500.

### 2. Suba a Evolution na VPS

Ponto de partida em [`deploy/evolution/`](deploy/evolution/): copie o
`.env.example` para `.env`, preencha, e

```bash
docker compose up -d
```

Depois ponha um proxy com HTTPS na frente (a porta fica no loopback de
propósito — a chave de API viaja em cada requisição).

### 3. Confira os endpoints antes de confiar

O adaptador em [`src/lib/whatsapp/evolution.ts`](src/lib/whatsapp/evolution.ts)
foi escrito contra a linha 2.x. A v1 usava outro formato no envio, e o projeto
muda endpoint entre versões menores. Cinco chamadas resolvem a dúvida:

```bash
export EVO=https://evolution.seudominio.com.br
export KEY=sua-chave

curl -s -H "apikey: $KEY" "$EVO/instance/fetchInstances"

curl -s -X POST -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"instanceName":"teste","qrcode":true,"integration":"WHATSAPP-BAILEYS"}' \
  "$EVO/instance/create"

# devolve o QR em base64 — leia no aparelho
curl -s -H "apikey: $KEY" "$EVO/instance/connect/teste"

# depois de ler, tem que responder state: "open"
curl -s -H "apikey: $KEY" "$EVO/instance/connectionState/teste"

curl -s -X POST -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"number":"5511999999999","text":"teste"}' \
  "$EVO/message/sendText/teste"
```

Se algum formato divergir, o ajuste é só em `evolution.ts` — nem o disparador
nem a tela precisam mudar.

### 4. Agende o disparador

A rota `/api/cron/reminders` aceita `GET` e `POST`, e exige o segredo em
`Authorization: Bearer <CRON_SECRET>` **ou** no header `x-cron-secret`. Sem
`CRON_SECRET` no ambiente ela devolve 404 — falha fechada, de propósito.

**Recomendado — crontab da própria VPS**, de 5 em 5 minutos:

```cron
*/5 * * * * curl -fsS -H "x-cron-secret: SEU_SEGREDO" https://seu-app.vercel.app/api/cron/reminders >/dev/null
```

**Alternativa — Cron da Vercel** (`vercel.json` na raiz). Atenção: no plano
gratuito ele roda **uma vez por dia**, o que inviabiliza lembrete de "1 hora
antes". Serve como rede de segurança, não como cadência principal:

```json
{
  "crons": [{ "path": "/api/cron/reminders", "schedule": "0 9 * * *" }]
}
```

A Vercel manda o `Authorization: Bearer $CRON_SECRET` sozinha quando a variável
existe no projeto.

Chamar duas vezes seguidas é seguro: o planejamento é idempotente por índice
único e o envio reivindica cada mensagem com `FOR UPDATE SKIP LOCKED`.

### 5. Conecte o número em /app/whatsapp

Botão "Conectar número" → QR na tela → ler no aparelho. A tela pergunta o
estado ao gateway a cada 4 segundos e muda sozinha quando parear. Abaixo dela
fica o histórico das últimas mensagens, com status e erro de cada uma.
