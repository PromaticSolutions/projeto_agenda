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

**Depois de preencher as chaves, rode TODAS as migrações de
[`supabase/migrations/`](supabase/migrations/) em ordem numérica** (0001,
0002, … 0017) no SQL Editor do seu projeto (Dashboard → SQL Editor → New
query, cole o arquivo inteiro e rode), ou via qualquer conexão direta ao
Postgres. Elas criam as tabelas, a constraint anti-colisão de horário, as
policies de RLS, os grants de tabela, o CRM de clientes, a fila de
mensagens, a cobrança da plataforma, o registro de consentimento e o
WhatsApp da própria plataforma.

Cada tela avisa quando falta a migração dela em vez de estourar erro — se
o painel disser "rode a migração 00XX", é literalmente isso.

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
- `src/app/superadmin` — painel da plataforma (visão geral, clientes,
  faturamento, leads, WhatsApp).
- `src/lib/billing.ts` — vocabulário e aritmética da cobrança (com testes).
- `src/lib/data/billing.ts` / `src/lib/data/platformMetrics.ts` — leituras do superadmin (dinheiro e uso).
- `supabase/migrations/0001_init.sql` — schema + RLS + constraint anti-colisão.
- `supabase/migrations/0011_billing.sql` — planos, assinaturas, faturas e pagamentos.
- `supabase/migrations/0015_consents.sql` — prova datada de consentimento do
  titular (LGPD), amarrada ao agendamento. Sem ela o agendamento público
  falha ao registrar o aceite — o horário é gravado do mesmo jeito, mas a
  API devolve `consent: "falhou"` e o log acusa.
- `supabase/migrations/0016_data_subject_requests.sql` — canal do art. 18
  (acesso, correção, exclusão), em `/[slug]/meus-dados`, resolvido em
  `/app/privacidade`.
- `supabase/migrations/0017_platform_whatsapp.sql` — instância de WhatsApp da
  PLATAFORMA, separada da de cada estúdio. É por ela que o aviso de lead novo
  chega; configura-se em `/superadmin/whatsapp`. Também torna
  `message_outbox.studio_id` opcional: nulo = mensagem da plataforma.

Decisões e riscos documentados em [DECISIONS.md](DECISIONS.md) e
[RISKS.md](RISKS.md). Status do projeto em [REPORT.md](REPORT.md).

## Painel da plataforma (`/superadmin`)

Só entra quem está em `platform_admins` (migração 0003) — dono de estúdio
comum vê "acesso restrito", não um loop de login. Todas as leituras usam a
`service_role` key e atravessam RLS de propósito; a autorização acontece
uma vez, no layout.

Cinco telas:

- **Visão geral** — receita recorrente, uso da base e um bloco "precisa de
  atenção" (faturas em atraso, testes vencendo, estúdios que pararam de
  agendar, mensagens que falharam).
- **Clientes** (`/superadmin/studios`) — uma linha por estúdio com uso e
  cobrança juntos, com filtro e ordenação na URL; clique abre a **ficha**
  (`/superadmin/studios/[id]`): cadastro, assinatura, faturas, agenda,
  serviços, clientes recorrentes, ocupação e automação.
- **Faturamento** (`/superadmin/billing`) — MRR, receita realizada por mês,
  método de pagamento, inadimplência por faixa de atraso e a lista de
  faturas com filtro.
- **Leads** (`/superadmin/leads`) — quem preencheu o formulário da página
  inicial, do mais recente para o mais antigo, com link direto para o WhatsApp
  e para o e-mail. É o REGISTRO; o aviso no WhatsApp é a notificação, e ela
  tem três pontos de falha (sessão caída, destino não configurado, disparador
  parado). Quando algum deles está em pé, a tela diz qual.
- **WhatsApp** (`/superadmin/whatsapp`) — a instância da plataforma (quem
  ENVIA o aviso de lead) e o número que RECEBE. São dois campos porque o
  WhatsApp não entrega mensagem sem remetente.

### O que cada número significa

Duas contas diferentes convivem no painel, e a tela não mistura as duas:

| Número | É | Não é |
| --- | --- | --- |
| **MRR** | soma das assinaturas `ativa` + `inadimplente`, plano anual dividido por 12 | não inclui `trial` — teste não é receita |
| **Receita realizada** | faturas com status `paga`, pela data de pagamento | não é o contratado |
| **Projeção anual** | MRR × 12 | não é receita fechada (a tela diz isso) |
| **Volume atendido** | preço dos atendimentos finalizados **nos estúdios** | não é dinheiro da plataforma |
| **Ocupação** | minutos agendados ÷ minutos de expediente | estimativa: ignora folga e bloqueio pontual |

### Cobrança e o gateway (Pix / cartão)

A migração [`0011_billing.sql`](supabase/migrations/0011_billing.sql) cria
`plans`, `subscriptions`, `invoices`, `payments` e `billing_events` — e é
**agnóstica de gateway**: cada linha guarda `gateway` (texto) mais o ID
externo, então plugar Mercado Pago, Asaas, Stripe ou Pagar.me depois não
exige nova migração. Nada de segredo no banco: chave de API e secret de
webhook ficam em variável de ambiente. Cartão nunca é armazenado — só marca
e 4 últimos dígitos, o que o gateway devolve.

Enquanto não houver integração, o painel mostra assinatura e faturamento a
partir do que existe no banco (a 0011 coloca os estúdios já cadastrados em
teste de 14 dias) e nenhum número é inventado: sem pagamento registrado, a
receita aparece como zero, não como estimativa.

## Lembretes no WhatsApp

O envio tem três peças: uma **fila** no Postgres, um **disparador** exposto
como rota HTTP, e um **gateway** (Evolution API) que fala com o WhatsApp.

```
cron (a cada 5 min)  →  /api/cron/reminders  →  planeja + envia
                                                  ↓
/app/whatsapp (envio manual) ────────→  message_outbox (fila, 0010)
                                                  ↓
                                        Evolution API → WhatsApp
                                                  ↓
                     /api/webhooks/evolution ← estado da conexão
```

Nada no navegador fala com a Evolution: a chave é global da instalação (quem a
tem controla todas as instâncias) e vive só no servidor. A tela usa Server
Actions, e `POST /api/whatsapp/send` existe para que o frontend não precise
conhecer o gateway — trocar de gateway amanhã é escrever outro arquivo em
`src/lib/whatsapp/`.

Sem `EVOLUTION_API_URL`/`EVOLUTION_API_KEY` o app **não quebra**: a fila
continua sendo planejada e dá para acompanhá-la em `/app/whatsapp`, mas nada é
enviado. Isso é de propósito — permite conferir o planejamento antes da VPS
existir. O que nunca acontece é uma mensagem ser marcada como enviada sem ter
saído.

### 1. Rode as migrações 0010 e 0012

[`0010_message_outbox.sql`](supabase/migrations/0010_message_outbox.sql) cria a
fila e a função `claim_pending_messages`. Sem ela o disparador devolve 500.

[`0012_whatsapp_manual_send.sql`](supabase/migrations/0012_whatsapp_manual_send.sql)
acrescenta o tipo `manual` à fila (o envio feito à mão em `/app/whatsapp`
entra no mesmo histórico) e o índice que sustenta o teto de envio.

### 2. Suba a Evolution na VPS

Ponto de partida em [`deploy/evolution/`](deploy/evolution/): copie o
`.env.example` para `.env`, preencha, e

```bash
docker compose up -d
```

Depois ponha um proxy com HTTPS na frente (a porta fica no loopback de
propósito — a chave de API viaja em cada requisição).

### 3. Confira o gateway com o smoke test

O adaptador em [`src/lib/whatsapp/evolution.ts`](src/lib/whatsapp/evolution.ts)
foi escrito contra o código-fonte da tag **2.3.7**. A Evolution muda contrato
entre versões menores, então há um smoke test que pergunta ao SEU gateway se
ele se comporta como o adaptador espera:

```bash
node --env-file=.env.local scripts/whatsapp-smoke.mjs
```

Ele cria uma instância descartável (`smoke_*`), percorre o ciclo de vida
inteiro e a remove no fim. Cada verificação corresponde a uma característica
real da 2.3.7 — por exemplo, que `connectionState` **não** devolve o número
pareado (por isso `status()` consulta `fetchInstances`), e que enviar com a
sessão fechada **trava** em vez de devolver erro (por isso o app confere o
estado antes de enviar).

Para exercitar o próprio adaptador contra o gateway real, e não só os
endpoints:

```bash
EVOLUTION_LIVE=1 node --env-file=.env.local \
  ./node_modules/.bin/vitest run src/lib/whatsapp/evolution.live.test.ts
```

Se algum formato divergir, o ajuste é só em `evolution.ts` — nem o disparador
nem a tela precisam mudar.

### 3.1. O que só dá para testar com um celular

O smoke test não lê QR code. Com um aparelho na mão, o roteiro é:

1. `/app/whatsapp` → **Conectar número** → leia o QR no WhatsApp
   (Aparelhos conectados → Conectar aparelho).
2. A tela deve virar **Conectado** sozinha em segundos, com o número ao lado.
3. Em **Enviar mensagem**, mande um texto para o seu próprio número.
4. A mensagem deve aparecer em **Últimas mensagens** como *Enviado*.
5. **Desconectar** → a tela volta para Desconectado e o envio fica bloqueado.
6. **Excluir** → pede confirmação; depois, **Reconectar número** gera QR novo.

### 3.2. Webhook (opcional, mas é o que deixa a tela instantânea)

`POST /api/webhooks/evolution` recebe `connection.update`, `qrcode.updated`,
`logout.instance` e `remove.instance`, e é o único jeito de o sistema saber que
a sessão morreu do lado do WhatsApp (o dono desvinculou o aparelho no celular)
antes de um envio falhar.

Ele é registrado automaticamente em cada instância quando o estúdio conecta —
não precisa configurar nada na Evolution. Exige duas coisas:

- `EVOLUTION_WEBHOOK_SECRET` (`openssl rand -hex 32`). Sem ele a rota devolve
  404 e nenhum webhook é registrado: um receptor aberto deixaria qualquer um na
  internet marcar o WhatsApp de um estúdio como conectado.
- uma URL **pública**. Quem chama é a VPS, então `localhost` não serve — em
  desenvolvimento o webhook fica desligado (a tela avisa) e o estado é
  atualizado por consulta. Para testar local, aponte `EVOLUTION_WEBHOOK_URL`
  para um túnel.

A consulta (polling na tela, `syncWhatsAppConnection` no disparador) continua
existindo de propósito: uma entrega de webhook perdida durante um deploy
deixaria o banco mentindo. Webhook acelera; consulta é o piso.

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
