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
npm run test        # vitest (disponibilidade, cobrança, conversas, assinatura…)
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

Há mais variáveis (WhatsApp, cron, AbacatePay) — todas opcionais para
rodar, cada uma comentada em `.env.local.example`.

**Depois de preencher as chaves, rode TODAS as migrações de
[`supabase/migrations/`](supabase/migrations/) em ordem numérica** (0001,
0002, … 0028) no SQL Editor do seu projeto (Dashboard → SQL Editor → New
query, cole o arquivo inteiro e rode), ou via qualquer conexão direta ao
Postgres. Elas criam as tabelas, a constraint anti-colisão de horário, as
policies de RLS, os grants de tabela, o CRM de clientes, a fila de
mensagens, a cobrança da plataforma, o registro de consentimento, o
WhatsApp da própria plataforma, a caixa de conversas, os anexos dos
serviços, a mídia das conversas, a cobrança pela AbacatePay, a hierarquia
salão/gerente/atendente, o agente de IA e os chamados de suporte.

Cada tela avisa quando falta a migração dela em vez de estourar erro — se
o painel disser "rode a migração 00XX", é literalmente isso.

> No projeto `mcgecpnpxilrhavtbsfn` referenciado em `.env.local`, a base
> (0001: as 5 tabelas, RLS, a exclusion constraint `bookings_no_overlap` e
> os grants) foi confirmada via consulta direta ao Postgres e via PostgREST
> em 2026-07-23 — `npm run dev` lê/escreve no banco real. **As migrações
> posteriores não foram reconferidas desde então**: se uma tela pedir uma
> migração, rode-a. As 0019–0028 são as mais recentes; 0020, 0022 criam
> buckets de Storage.

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
- `src/app/app/(dashboard)/conversations` — caixa de atendimento do WhatsApp
  (lista, conversa e atalhos de disponibilidade, agendamento, orçamento e fotos).
- `src/app/app/(dashboard)/assinatura` — plano do estúdio: estado, assinar,
  cancelar e histórico de pagamentos.
- `src/app/app/gerencia` — área da **gerente**: visão geral do salão, atendentes
  (cadastrar, editar, desativar) e a leitura de clientes, conversas e
  agendamentos das atendentes, com filtro por atendente.
- `src/lib/access.ts` — regra centralizada de quem pode o quê na hierarquia
  atendente → gerente (com testes). Não é a defesa: a defesa é a RLS da 0024.
- `src/lib/data/salons.ts` — resolução do papel a partir da sessão e as leituras
  e escritas do salão.
- `src/app/api/bookings` — API route que revalida disponibilidade e cria o booking.
- `src/lib/availability.ts` — algoritmo de horários livres (com testes).
- `src/lib/data/*` — camada de dados; alterna Supabase real ↔ mock conforme `.env.local`.
- `src/lib/mock/store.ts` — dados fictícios usados quando o Supabase não está configurado.
- `src/app/superadmin` — painel da plataforma (visão geral, clientes,
  faturamento, leads, WhatsApp).
- `src/lib/billing.ts` — vocabulário e aritmética da cobrança (com testes).
- `src/lib/data/billing.ts` / `src/lib/data/platformMetrics.ts` — leituras do superadmin (dinheiro e uso).
- `src/lib/abacatepay.ts` — adaptador do gateway que cobra a assinatura (com testes).
- `src/lib/subscription-state.ts` — regra pura que traduz a assinatura no que a
  tela mostra, e que vai decidir o bloqueio depois do teste (com testes).
- `src/lib/conversations.ts` / `src/lib/data/conversations.ts` — identidade do
  chat, leitura e escrita das conversas.
- `src/lib/data/conversationMedia.ts` — download e guarda da mídia no bucket privado.
- `src/lib/working-week.ts` / `src/lib/bookings-filter.ts` — semana de trabalho
  em Horários e filtros da lista de agendamentos (ambos com testes).
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
- `supabase/migrations/0018_rate_limit_indexes.sql` — índice
  `(studio_id, created_at desc)` em `bookings`, que sustenta o teto anti-abuso
  por janela de `/api/bookings`.
- `supabase/migrations/0019_whatsapp_messages.sql` — as conversas de WhatsApp.
  É aqui que o produto deixa de só enviar e passa a receber.
- `supabase/migrations/0020_service_attachments.sql` — bucket **privado**
  `service-attachments` (10 MB; JPG/PNG/WebP/AVIF/PDF) para fotos e fichas do
  procedimento. Uso interno do dono: nada disso aparece na página pública.
- `supabase/migrations/0021_conversations_all_chats.sql` — a caixa deixa de ser
  só das clientes cadastradas: toda conversa do número conectado passa a ser
  gravada, inclusive grupo, e quem separa é o filtro da tela.
- `supabase/migrations/0022_conversation_media.sql` — bucket **privado**
  `conversation-media` e as colunas `media_path`/`media_status`. Sem ela, foto e
  áudio de cliente aparecem como "não está mais disponível".
- `supabase/migrations/0023_abacatepay.sql` — plano "Timely" (R$ 39,90/mês, 30
  dias de teste), gateway `abacatepay` aceito e trigger que faz todo estúdio
  novo nascer em teste.
- `supabase/migrations/0024_salons.sql` — salão, gerente e as policies de
  leitura da gerente. `studios.salon_id` é **nulo por default** e nulo é estado
  final: profissional autônoma. Ver **[Salão, gerente e
  atendentes](#salão-gerente-e-atendentes)**.
- `supabase/migrations/0025_conversations_view_perf.sql` — reescreve a view
  `whatsapp_conversations` (a lista de conversas travava depois de importar
  histórico).
- `supabase/migrations/0026_ai_agent.sql` e `0027_ai_integrations.sql` — agente
  de IA do WhatsApp por estúdio e as chaves de IA da plataforma (Integrações no
  `/superadmin`). Tabelas só da service_role.
- `supabase/migrations/0028_support_tickets.sql` — chamados de suporte: o dono
  lê só os do próprio estúdio (RLS); escrita só pelo servidor.

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

Essa aposta se pagou na [`0023_abacatepay.sql`](supabase/migrations/0023_abacatepay.sql):
ligar o gateway de verdade não exigiu mudar o modelo, só acrescentar o nome à
constraint. Ver **[Assinatura do estúdio](#assinatura-do-estúdio-abacatepay)**.

Nenhum número é inventado: sem pagamento registrado, a receita aparece como
zero, não como estimativa.

## Assinatura do estúdio (AbacatePay)

Quem cobra o estúdio é a [AbacatePay](https://abacatepay.com). O fluxo:

```
/app/assinatura  → "Assinar" → checkout na AbacatePay → o dono paga
                                                          ↓
                               /api/webhooks/abacatepay ← aviso de pagamento
                                                          ↓
                                      subscriptions.status = 'ativa'
```

A renovação dos meses seguintes é da AbacatePay; cada uma chega como outro
aviso. O `externalId` do checkout é o **ID do estúdio**, não o da assinatura —
um estúdio que cancelou e voltou não tem assinatura vigente para apontar, e o
webhook precisa saber de quem é o pagamento mesmo assim.

Três variáveis, uma por ambiente da AbacatePay (Dev Mode e produção têm as
suas):

```
ABACATEPAY_API_KEY=            # chave da API
ABACATEPAY_PRODUCT_ID=         # produto com ciclo mensal criado no painel deles
ABACATEPAY_WEBHOOK_SECRET=     # mínimo 32 caracteres
```

Sem `ABACATEPAY_WEBHOOK_SECRET` a rota devolve **404** e não anuncia que existe
— falha fechada, igual à da Evolution. E ela **nunca** devolve 410: a AbacatePay
desliga o webhook de vez ao receber esse código.

> A assinatura HMAC que vem no header `X-Webhook-Signature` usa uma chave
> **pública**, publicada na documentação deles. Ela prova que o corpo não foi
> alterado no caminho; não prova quem mandou. Quem autentica é o nosso segredo —
> por isso a rota confere os dois.

Todo estúdio novo nasce em teste de 30 dias, por trigger no banco (`studios`),
não por código no onboarding — o estúdio pode nascer por SQL Editor, superadmin
ou script, e o teste tem de existir em todos.

**Hoje o teste vencido só avisa, não bloqueia.** A regra que decidirá o bloqueio
já existe isolada e testada em `src/lib/subscription-state.ts`; ligá-la ao
acesso é trabalho pendente.

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

## Conversas (`/app/conversations`)

Até a migração 0019 o produto só **enviava** — lembrete, envio manual, aviso de
lead. Agora o estúdio lê e responde dentro do painel, no desenho de caixa de
atendimento: lista à esquerda, conversa no centro e, à direita, os cartões de
contato e de atendimento com atalhos de disponibilidade, agendamento, orçamento
e fotos. A ideia é que responder "tem horário quinta?" não exija sair da tela.

Exige a Evolution conectada em `/app/whatsapp` e as migrações **0019, 0021 e
0022**.

### O que fica gravado no nosso banco

Toda conversa do número conectado — **inclusive grupo, família e fornecedor**.
A 0019 nasceu restrita a quem já estivesse em `clients`, mas isso escondia
justamente quem pergunta preço antes de virar cliente, e a 0021 abriu o escopo.
Quem separa uma coisa da outra é o filtro "só clientes cadastradas", na tela.

Dito sem rodeio: é o número do estúdio e a escolha é de quem o conecta, mas o
produto ainda **não** avisa isso na tela de conexão. É pendência conhecida (ver
[DECISIONS.md](DECISIONS.md)).

A conversa é identificada pelo **chat**, não pela cliente. Quem é cliente se
decide por telefone na leitura, então cadastrar a pessoa depois faz a conversa
virar de cliente sozinha, sem backfill.

### Mídia

Foto, áudio, vídeo e documento são baixados **uma vez** e guardados no bucket
privado `conversation-media` (0022). Isso existe porque pedir o arquivo à
Evolution a cada balão depende de ela guardar as mensagens no banco dela, e a
instalação de referência roda com `DATABASE_SAVE_DATA_NEW_MESSAGE=false` — antes
da 0022, toda foto de cliente aparecia como "não está mais disponível".

Mensagem nova baixa pelo próprio webhook (que recebe a chave de mídia junto);
mensagem antiga baixa ao abrir o balão ou pela recuperação em lote da tela.
`media_status = 'indisponivel'` significa que o WhatsApp não tem mais o arquivo
— nesse caso não se tenta de novo, a tela diz direto.

Excluir a cliente apaga as mensagens em cascata e remove os objetos do bucket
(`deleteClient`, em `src/lib/data/clients.ts`).

### Importar o histórico

O botão de importação puxa o que já existe no gateway, em lotes de 15 conversas,
pulando o que já está no banco. É repetível e retomável: rodar duas vezes não
duplica, e uma queda no meio não obriga a recomeçar.

### Limites conhecidos

- **Grupo é só leitura.** Responder exigiria JID na fila de envio, e a fila
  (0010) só aceita telefone em dígitos.
- Grupo aparece como "Grupo &lt;4 últimos dígitos&gt;" — o evento não traz o assunto.
- `/chat/findChats` e `/chat/findMessages` não foram testados contra uma
  Evolution real; o adaptador tolera os três formatos conhecidos da 2.x.

## Fotos e anexos nos procedimentos

O formulário do serviço aceita imagem (JPG/PNG/WebP/AVIF) e PDF — foto de
antes/depois, ficha de anamnese, termo, tabela de preparo. Migração **0020**.

É uso interno do dono, como as observações do serviço: o bucket
`service-attachments` é **privado** e a tela lê por URL assinada. Nada disso
aparece na página pública, ao contrário de `studio-media` (0007).

O arquivo sobe na hora, mas o vínculo com o serviço só é gravado no **Salvar** —
fechar sem salvar não muda nada. O tipo é conferido pelos **bytes**, não pela
extensão, e o caminho é conferido contra a pasta do estúdio ao gravar.

O teto é 10 MB (`MAX_ATTACHMENT_BYTES`, e o mesmo no bucket). O
`bodySizeLimit` do `next.config.ts` subiu para 11 MB por causa disso, com folga
para o overhead de multipart. **Falta conferir o teto de corpo da Vercel contra
esse valor.**

## Salão, gerente e atendentes

Há três papéis, em dois eixos independentes:

```
atendente   dona de um estúdio. Vê só os próprios dados.
            salon_id pode ser NULL  →  profissional autônoma
gerente     vinculada a um salão. LÊ as atendentes daquele salão.
            não tem estúdio, nem página pública, nem agenda própria
admin       /superadmin, via platform_admins (0003). Eixo à parte, intocado.
```

A hierarquia é da migração **0024**. O eixo do `/superadmin` não passa por ela.

### Por que o salão fica ACIMA de `studios`, e não é o próprio `studios`

Porque `studios.owner_id` é `unique`: a 0001 fixou "1 usuário Auth = 1 dono = 1
estúdio", e serviços, horários, agendamentos, clientes, conversas e a instância
da Evolution penduram todos em `studio_id`.

Na prática o estúdio **é** a atendente — a conversa dela é a conversa do número
dela. O salão só podia entrar como um nível acima:

```
salons
  └── studios (salon_id NULL = autônoma)
        └── clients, bookings, whatsapp_messages, services, ...
salon_managers (user_id → salon_id)
```

### `salon_id` nulo não é pendência

É estado final e suportado. Existe profissional que compra o sistema sozinha, e
ela foi o único caso que o produto atendeu até a 0024. A coluna nasce nula,
nenhuma linha existente foi alterada, e nada no sistema exige preenchê-la.

### O isolamento entre salões está no banco

As onze policies da 0024 são **aditivas e só de SELECT**. Policy permissiva se
soma às outras por OR, então nenhuma policy da atendente mudou — e por isso as
funções da camada de dados dela também não mudaram: é a RLS que recorta o
resultado conforme quem pergunta.

Quem decide o recorte é `salon_studio_ids()`, função `security definer` que
**não aceita parâmetro** e deriva tudo de `auth.uid()`. Um id de outro salão
trocado na URL ou no corpo da requisição não encontra linha: o Postgres devolve
vazio.

`src/lib/access.ts` (com testes) é a regra centralizada do lado da aplicação.
Ela existe para recusar cedo e com mensagem legível, **não** para ser a defesa —
a defesa é a RLS. Toda Server Action de `/app/gerencia` repete `requireManager()`
pela mesma razão que as do `/superadmin` repetem `checkPlatformAdmin`: layout
não protege Server Action, que é uma porta HTTP própria.

### A gerente lê; ela não opera no lugar da atendente

Todas as policies são `for select`. Ela acompanha agenda, clientes e conversas,
mas não remarca horário nem responde mensagem fingindo ser outra pessoa.

As duas escritas que ela PODE fazer — cadastrar e editar atendente — passam pelo
servidor com a `service_role` (criar usuário no Auth exige), depois de conferir
o vínculo, e ainda carregam `.eq("salon_id", ...)` como segunda trava.

**O formulário de nova atendente não tem campo de salão**, nem oculto: o vínculo
é montado a partir da sessão da gerente. É o que impede cadastrar atendente em
salão alheio.

### O que a gerente NÃO vê, de propósito

Assinatura, faturas e pagamentos da atendente (contrato dela com a plataforma,
não operação do salão) e os registros de LGPD — `consents` e
`data_subject_requests`. Abrir qualquer um exige policy nova e decisão
registrada.

### Desativar ≠ excluir

- **Desativar** (`studios.deactivated_at`) tira a página pública do ar. **Não
  mexe no login nem apaga nada** — agendamento, cliente e conversa são dado de
  terceiro. O canal do art. 18 (`/[slug]/meus-dados`) continua no ar mesmo
  desativada: o direito da titular não depende do status comercial da
  profissional.
- **Remover do salão** é `salon_id = null`. A atendente volta a ser autônoma com
  tudo o que é dela, e dá para vinculá-la de novo.

### Criando o primeiro salão e a primeira gerente

Não há tela, pela mesma razão que não há tela para cadastrar admin da plataforma
(0003): é ato de quem vende o sistema, não operação do dia. No SQL Editor:

```sql
-- 1. o salão
insert into salons (name) values ('Salão da Ana') returning id;

-- 2. a gerente se cadastra sozinha em /signup e NÃO cria estúdio.
--    Pegue o id dela em Authentication > Users.

-- 3. o vínculo
insert into salon_managers (user_id, salon_id, name, email)
values ('<uuid-do-usuario>', '<uuid-do-salao>', 'Ana', 'ana@exemplo.com');

-- 4. atendentes que JÁ existem e vão para esse salão (opcional).
--    Nomeie uma a uma: um update sem `where` jogaria toda autônoma do
--    sistema dentro do salão.
update studios set salon_id = '<uuid-do-salao>'
where slug in ('atendente-1', 'atendente-2');
```

> Faça o passo 3 **antes** de entregar o acesso. Entre o cadastro e o vínculo a
> gerente vê a tela de criar estúdio — e se criar um, vira atendente, porque
> `getCurrentActor` resolve estúdio primeiro.

A partir daí, as atendentes novas saem de `/app/gerencia/atendentes` e já nascem
com o `salon_id` certo, sem SQL.
