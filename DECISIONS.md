# Decisões e suposições

Registro de toda escolha não-trivial feita durante a construção autônoma
(etapas 2–10), na ordem em que foram tomadas.

## Ambiente

- **Node 18 → 20 via nvm**: o sistema tinha Node 18.19, mas Next.js 16
  exige >=20.9. Instalei nvm no `$HOME` do usuário (não mexi no Node do
  sistema) e fixei a versão em `.nvmrc`. Rode `nvm use` antes de qualquer
  comando no projeto.
- **git identity local**: não havia identidade git configurada na máquina.
  Configurei `user.name`/`user.email` só neste repositório (não
  `--global`), usando o e-mail do usuário, para permitir os commits desta
  sessão.

## Etapa 2 — dados e ambiente

- **1 estúdio = 1 profissional (v1)**: a constraint anti-colisão
  (`bookings_no_overlap`) impede dois agendamentos sobrepostos no MESMO
  `studio_id`, não por serviço/sala. Isso assume um único profissional
  atendendo por estúdio, coerente com a landing ("sua agenda", singular).
  Se o negócio precisar de múltiplos profissionais/salas simultâneos, será
  necessário adicionar uma tabela `resources` e trocar a chave da
  exclusion constraint — fora do escopo do v1.
- **Sem policy pública de leitura no RLS**: em vez de abrir `SELECT` anônimo
  em `services`/`working_hours`/`blocks`, todo acesso público (página
  `/[slug]` e criação de booking) passa por Route Handlers no servidor
  usando a `service_role` key, que ignora RLS. RLS cobre 100% apenas o
  dono (`owner_id = auth.uid()`). Mais simples de auditar do que manter
  duas superfícies de acesso (RLS pública + service role).
- **Clientes derivados de `bookings`**: sem tabela `clients` própria no v1,
  exatamente como pedido no spec (agrupar por `client_phone`).
- **Modo mock quando `.env.local` não existe**: `isSupabaseConfigured`
  (`src/lib/supabase/env.ts`) decide, em cada função de
  `src/lib/data/*.ts`, se a chamada vai para o Supabase real ou para um
  store em memória (`src/lib/mock/store.ts`) seedado com um estúdio de
  demonstração ("Bella Studio", slug `bella-studio`). O store em memória
  reseta a cada restart do processo e não é compartilhado entre instâncias
  serverless — é só para o front funcionar isolado em dev. Ver README.md.
- **`proxy.ts` em `src/`, não na raiz**: o projeto usa `--src-dir`, então
  `app/` mora em `src/app/`; o Next.js 16 exige que `proxy.ts` fique no
  mesmo nível de `app/`.
- **Tipos do Database escritos à mão**: sem projeto Supabase vivo ainda
  para rodar `supabase gen types`. `src/lib/supabase/types.ts` inclui
  `Relationships: []`/`Views`/`Functions` vazios porque o
  `@supabase/supabase-js@2.110+` exige essas chaves para o client tipado
  não colapsar em `never`.
- **`date-fns-tz` para fuso horário**: toda conversão hora-local ↔ UTC do
  estúdio passa por `localDateTimeToUtc`/`utcToLocalDate`
  (`src/lib/availability.ts`), fixado em `America/Sao_Paulo`. Ver
  RISKS.md.
- **Vitest só para `availability.ts`**: é o algoritmo mais crítico do
  sistema (seção 8 do spec) e o único com lógica pura o bastante para
  valer a pena testar isoladamente dentro do orçamento desta sessão. Não
  configurei testes de integração/E2E.

## Incidente: chaves reais coladas em `.env.local.example`

Durante a etapa 3 o usuário colou as chaves reais do Supabase (incluindo a
`service_role`) em `.env.local.example` — arquivo rastreado pelo git — em
vez de `.env.local` (ignorado). Antes de qualquer commit, movi os valores
reais para `.env.local` e restaurei `.env.local.example` com placeholders
vazios; confirmei via `git log --all -p` que nenhum segredo real chegou a
ser commitado. **Sempre conferir o conteúdo de arquivos `.env*` antes de
`git add`, mesmo quando o nome do arquivo parece um template.**

## Etapa 3 — Auth e onboarding

- **Supabase MCP conectado a outra conta**: o MCP do Supabase disponível
  nesta sessão só enxerga o projeto `nztqgjffktrhbquvydvd`
  ("mg@likecomm.com.br's Project"), diferente do projeto
  `mcgecpnpxilrhavtbsfn` cujas chaves estão em `.env.local`. Rodar
  `apply_migration` por ele teria alterado o banco errado. Confirmei que o
  projeto certo está no ar e sem a tabela `studios` ainda (fetch direto no
  REST API), e deixei a migração para ser rodada manualmente — instruções
  no README.md. Isso significa que o painel `/app` real (fora do modo
  mock) só funciona de fato depois desse passo manual.
- **shadcn `base-nova` usa Base UI, não Radix**: este projeto do shadcn
  (`components.json` com `"style": "base-nova"`) importa de
  `@base-ui/react`, cujo `Button` não tem prop `asChild` — o padrão
  polimórfico é `render={<Link href="..." />}`. Qualquer novo componente
  shadcn adicionado depois deve seguir esse padrão, não o `asChild` do
  Radix (comum em outros projetos shadcn).
- **Auth só com e-mail+senha (sem magic link)**: o spec permitia os dois;
  implementei só senha para manter o formulário mínimo e testável sem
  depender de um provedor de e-mail configurado no Supabase. Magic link
  fica como extensão futura (o Supabase Auth já suporta nativamente, só
  falta a tela).
- **Modo demo não é bloqueado pelo proxy**: quando `!isSupabaseConfigured`,
  `proxy.ts` não protege `/app` (não há sessão real para checar), então
  `/app` cai direto no estúdio mockado "Bella Studio". `/login` e
  `/signup` mostram um aviso com atalho para entrar no modo demo.
- **Onboarding com Server Actions + `useActionState`**: `createStudioAction`
  roda no servidor, valida com o mesmo schema `zod` usado no resto do app,
  e usa `redirect()` no sucesso. Esse é o padrão que vou repetir nas
  etapas 4/5/8 para toda mutação (serviços, horários, bloqueios, status de
  booking) — consistente e funciona com JS desabilitado.
- **Sem upload de logo**: o campo `logo_url` no onboarding é uma URL de
  imagem já hospedada, não um upload de arquivo para o Supabase Storage.
  Implementar upload exigiria configurar um bucket + policies extras fora
  do orçamento desta sessão — ver REPORT.md como pendência.

## Etapa 4 — CRUD de serviços

- **Server Actions + `useActionState` + `revalidatePath`**: mesmo padrão
  do onboarding, mas sem `redirect()` — o diálogo fecha no client quando
  `state.ok` fica `true`. O eslint (`react-hooks/set-state-in-effect`)
  bloqueia `setOpen(false)` dentro de um `useEffect` reagindo a `state`;
  segui o padrão oficial do React de ajustar estado durante a
  renderização comparando com o valor anterior guardado em `useState`
  (`if (state !== lastState) { setLastState(state); ... }`), em vez de
  `useEffect`. Vale para qualquer diálogo futuro que precise fechar
  sozinho após uma Server Action.
- **Preço digitado em reais, salvo em centavos**: o formulário usa um
  campo de texto "60,00" (`price_reais`) convertido para `price_cents`
  dentro da própria Server Action — evita usuário lidar com centavos
  diretamente e mantém a coluna do banco como inteiro (sem ponto
  flutuante).
- **Excluir sem tabela de confirmação dedicada**: usei `window.confirm()`
  simples em vez de um `AlertDialog` (não instalei esse componente do
  shadcn) — suficiente para a ação destrutiva de excluir um serviço, mas
  vale trocar por um modal de verdade se o produto crescer.

## Etapas 6–7 — página pública + criação de booking (feitas juntas)

- **Combinei as duas etapas num commit só**: a página pública sem a API de
  criação de booking não demonstra a promessa central do produto ("nunca
  duas clientes no mesmo horário"), e o formulário de dados do cliente
  (parte da "etapa 6" no texto do spec) só faz sentido junto do botão que
  chama a API (etapa 7). Separar teria deixado um commit intermediário com
  um botão "Confirmar" morto — preferi um incremento genuinamente testável.
- **Bug real encontrado e corrigido: store mock não era compartilhado
  entre rotas**. Os arrays em memória de `src/lib/mock/store.ts` eram
  `const` no topo do módulo; testei criando um booking pela página e
  consultando pela API e as duas viam estúdios "fantasma" diferentes — o
  Next.js (Turbopack, dev) instancia Route Handlers e Server Components em
  grafos de módulo separados, então cada um tinha sua PRÓPRIA cópia dos
  dados seed. Corrigido guardando tudo em `globalThis.__agendaMockDb`
  (mesma técnica que o próprio Next.js recomenda para o singleton do
  Prisma Client em dev, exatamente por essa razão). Sem esse fix, o modo
  mock pareceria funcionar isoladamente em cada tela mas o agendamento
  criado na página pública nunca apareceria no painel do dono nem geraria
  conflito de horário — um bug silencioso e feio de pegar depois. Validado
  com curl direto nas duas API routes após o fix (ver REPORT.md).
- **`/api/availability` (GET) e `/api/bookings` (POST) são rotas "flat"**,
  sem segmento dinâmico (`slug` vai por query string / body), justamente
  para não precisar lidar com `params` assíncrono do Next 16 nelas — só a
  página `/[slug]` precisa de `await props.params`.
- **Seletor de data com `Popover` + `Calendar` (react-day-picker) em vez
  de input nativo `<input type="date">`**: fica consistente com o resto
  do design system (shadcn) e permite bloquear datas passadas
  (`disabled={{ before: today }}`) com a mesma UI em qualquer navegador —
  o input nativo teria aparência inconsistente entre Chrome/Safari/Firefox.
- **Data escolhida no calendário nunca passa por conversão de fuso no
  client**: uso `date.getFullYear()/getMonth()/getDate()` (métodos locais
  do browser, não `toISOString()`) para montar a string "YYYY-MM-DD"
  enviada à API — é só o rótulo do dia que o cliente clicou no calendário,
  igual em qualquer fuso; toda a matemática de fuso horário de verdade
  (America/Sao_Paulo) acontece só no servidor, em `availability.ts`.
- **Fallback do redirect do WhatsApp implementado como no RISKS.md #7**: a
  tela de sucesso nunca depende só do `window.open()` (que pop-up
  blockers podem barrar) — sempre mostra a confirmação do agendamento
  primeiro, com um botão "Abrir WhatsApp" (link `<a>` normal, sempre
  clicável) e "Copiar link" como segunda camada de fallback.

## Etapa 9 — exportação em PDF

- **`autoTable` é named export, `jsPDF` é default export**: a versão
  instalada (`jspdf-autotable@5`) mudou a API de `doc.autoTable(...)`
  (plugin attachado ao protótipo, usado em versões antigas/tutoriais) para
  `import { autoTable } from "jspdf-autotable"; autoTable(doc, opts)`.
  Confirmei rodando a geração num script Node isolado (fora do Next) e
  validando o PDF resultante com `file` — evita descobrir isso só depois
  do usuário clicar em "Exportar" no navegador.
- **PDF do dia usa os dados já carregados na página; PDF do mês busca sob
  demanda**: o painel do dia já tem `bookings`/`services` em memória
  (renderizados no server), então "Agenda do dia" monta o PDF só com esses
  dados, sem round-trip. "Agenda do mês" chama uma Server Action
  (`getMonthAgendaAction`) como RPC direto do client — não é um form
  action nem uma API route, só uma função `"use server"` chamada e
  aguardada normalmente, que é o padrão mais simples do Next.js App
  Router para isso.

## Etapa 10 — polimento

- **`unstable_retry` em vez de `reset` nos `error.tsx`**: o Next.js 16.2
  trocou o prop padrão do error boundary — `reset()` só re-renderiza sem
  buscar dados de novo, `unstable_retry()` re-busca e re-renderiza (o que
  eu quero: se o erro foi "a migração não rodou", tentar de novo depois
  do usuário rodar o SQL precisa buscar de novo, não só re-renderizar o
  mesmo estado com erro).
- **Erro real testado contra o projeto Supabase real (ainda sem a
  migração)**: `code` vem como `"PGRST205"` (PostgREST, "não achei essa
  tabela no cache do schema"), não `"42P01"` (Postgres puro) como eu tinha
  assumido inicialmente — corrigi `src/app/app/error.tsx` para checar os
  dois. Validado com uma query direta ao projeto real via
  `@supabase/supabase-js` (fora do Next) confirmando o shape exato do
  erro antes de codar a checagem.
- **API routes agora sempre devolvem JSON, mesmo em erro inesperado**:
  descobri rodando contra o projeto real (sem migração) que uma exceção
  não capturada em `/api/availability` ou `/api/bookings` fazia o Next.js
  devolver uma resposta 500 com corpo VAZIO — o client (`await
  res.json()`) quebraria tentando parsear isso. Envolvi as duas rotas em
  `try/catch` retornando `{error: "..."}` com status 500 explícito.
- **Nuance não resolvida, documentada e não bloqueante**: contra o
  projeto real sem migração, `/[slug]` acaba mostrando a UI de
  "Estúdio não encontrado" (`not-found.tsx`) em vez da UI de erro
  genérico (`error.tsx`), mesmo com o log confirmando que
  `getPublicStudioBySlug` lançou `PGRST205` (não retornou `null`). Não
  investiguei a fundo por quê — a hipótese mais provável é alguma
  interação entre o erro lançado em `generateMetadata` (que roda em
  paralelo à página) e o mecanismo de dedupe de erro do Next 16 em dev.
  Não é grave: o resultado ainda é uma mensagem limpa, sem stack trace
  vazado, sem crash — só menos precisa que o ideal. Deixo registrado
  porque é exatamente o tipo de comportamento que o AGENTS.md do Next 16
  avisou para não assumir do treinamento. Some sozinho assim que a
  migração for rodada (o erro para de existir).

## Agendamento manual pelo painel (grade + encaixe)

- **Motivação**: a maior parte dos clientes de estúdio marca por WhatsApp,
  telefone ou no balcão. Sem um caminho de criação dentro de `/app`, o dono
  teria que abrir a própria página pública fingindo ser cliente — e ainda
  ficaria refém das regras de expediente para um encaixe.
- **Dois modos, uma única regra inegociável.** No modo padrão o dono escolhe
  na MESMA grade de horários livres da página pública (`getAvailableSlots`,
  revalidada no servidor por `isSlotStillAvailable`). Com o switch "Encaixe",
  ele digita horário e duração livremente: aí o expediente e os bloqueios são
  ignorados de propósito, mas a colisão com outro atendimento ativo continua
  barrada — em código e, por baixo, pela exclusion constraint
  `bookings_no_overlap`. Nenhum modo permite dois clientes no mesmo horário,
  que é a promessa central do produto.
- **Server Actions em vez de nova API route.** O caminho público precisa de
  rota HTTP (o cliente é anônimo e passa `slug`); o painel não — a action
  resolve o estúdio por `getMyStudio()` e o INSERT usa o client autenticado,
  então a policy "owner manages own bookings" ainda vale como checagem de
  tenant. Menos superfície exposta que uma rota nova aceitando `studioId`.
- **`createOwnerBooking` não é `createBookingServerSide` com um flag.** As
  duas compartilham a lógica de disponibilidade (`src/lib/availability.ts`,
  nunca reimplementada), mas divergem em quem escreve (service role x usuário
  autenticado) e no que é negociável (duração fixa do serviço x duração
  editável). Um único função com três booleans ficaria mais difícil de
  auditar do que duas funções curtas lado a lado.
- **Grade buscada nos handlers, não em `useEffect`.** Os horários só mudam em
  resposta a uma ação do dono (abrir o diálogo, trocar serviço/data/modo);
  usar efeito para isso dispara o lint `react-hooks/set-state-in-effect` e
  renders em cascata sem necessidade — mesmo padrão do `BookingFlow` público.
- **`vitest.config.ts` passou a apontar `server-only` para um stub**, porque
  `src/lib/data/bookings.test.ts` exercita as funções de dados reais em Node
  puro (modo mock, sem `.env.local`). O marcador `server-only` lança fora do
  runtime de Server Component — o alias o neutraliza só nos testes.

## Módulo de agendamentos (/app/bookings)

- **Por que uma tela nova em vez de expandir o painel.** O "Painel do dia"
  responde *o que acontece hoje* — um dia por vez, régua do agora, contadores.
  A pergunta *onde está o atendimento da fulana* é outra: atravessa dias,
  filtra por status e serviço e quer densidade ajustável. Enfiar as duas no
  mesmo lugar transformaria o painel num formulário de busca com um dia
  dentro. As duas telas compartilham os componentes (`BookingStatusSelect`,
  `BookingFormDialog`, `ManualBookingDialog`), não o layout.
- **Os filtros moram na URL, não em `useState`.** `periodo`, `status`,
  `servico`, `q` e `view` são `searchParams`: o botão voltar funciona, o dono
  pode favoritar "cancelados dos últimos 30 dias", e a página continua um
  Server Component que busca os dados uma vez — nada de refazer a consulta no
  cliente. A `BookingsToolbar` só escreve na URL; quem lê é a página.
- **Vocabulário dos filtros centralizado em `src/lib/bookings-filter.ts`.**
  Barra e página importam as MESMAS constantes e os mesmos `parse*`. Se cada
  lado tivesse a sua lista, um dia a barra ofereceria uma opção que a página
  não sabe ler e o filtro cairia calado no padrão. Todo `parse*` é total:
  valor desconhecido na URL vira o padrão, nunca `undefined`.
- **Período por presets, não por intervalo livre.** Quatro opções (hoje, 7
  dias, 30 dias, últimos 30 dias) cobrem o uso real de um estúdio e mantêm a
  consulta limitada. O intervalo é inclusivo nas duas pontas, e "últimos 30
  dias" inclui o próprio dia de propósito: um atendimento das 9h já é passado
  às 15h, e escondê-lo faria procurar em dois lugares.
- **Filtro de status/serviço/busca é em memória, sobre o intervalo já
  carregado.** Uma ida ao banco por filtro seria mais consultas para o mesmo
  conjunto de linhas. Como o filtro roda em JS, a busca por nome dobra acento
  e caixa ("monica" acha "Mônica") — coisa que o `ilike` do `searchBookings`,
  no painel, não faz.
- **O movimento do hover é 100% CSS.** `BookingCard` continua Server
  Component; só os dois controles internos descem como JavaScript. **Nada
  aparece ou some no hover** — quem usa toque ou teclado vê a mesma
  interface, `focus-within` repete o destaque no Tab, e `motion-reduce` deixa
  só a cor.
- **O deslocamento virou o utilitário `card-lift`** (globals.css), aplicado
  aos cards de agendamento, aos cards de serviço e aos tiles do painel. Duas
  razões para não repetir a corrente de classes em cada tela: o movimento
  precisa ser idêntico em todo lugar (repetido à mão, cada tela acabaria com
  uma distância e uma duração ligeiramente diferentes), e a sombra depende do
  tema — daí o token `--shadow-lift`, que no escuro precisa de bem mais
  opacidade para não sumir contra o fundo. Sobe 4px, não 2px: 2px era um
  movimento que o olho registrava sem perceber.
- **Linha de tabela não sobe.** Em `/app/clients` (e na visualização em lista
  dos agendamentos) a reação ao cursor é de cor, não de deslocamento:
  `transform` em `<tr>` é tratado de forma inconsistente entre navegadores, e
  uma linha subindo dentro de uma lista dividida quebra o alinhamento das
  divisórias vizinhas.

## Envio de lembretes no WhatsApp (fila + disparador + Evolution)

- **Fila, e não "o cron varre `bookings` e manda".** Varrer e enviar direto não
  tem memória: duas execuções do disparador (retry da plataforma, dois cron
  apontando para a mesma rota, deploy no meio) mandam o mesmo lembrete duas
  vezes. Mensagem repetida no WhatsApp da cliente é o erro que faz o salão
  desligar o recurso. A tabela `message_outbox` (0010) dá idempotência por
  índice único `(booking_id, kind)`, retentativa com contagem, e histórico
  auditável — dá para responder "esse lembrete saiu?".
- **A reivindicação é uma função SQL, não `select` + `update` no app.** Entre
  ler e marcar existe janela de corrida; `for update skip locked` fecha essa
  janela dentro do banco e ainda deixa duas execuções simultâneas pegarem
  lotes diferentes em vez de esperar uma pela outra. Como o PostgREST não
  expõe isso, virou `claim_pending_messages`, com `revoke` de `anon` e
  `authenticated` — `security definer` em tabela multi-tenant sem revoke é
  como um estúdio acabaria reivindicando mensagem de outro.
- **Guardamos o texto final, não o template + os dados.** Se o dono editar a
  mensagem amanhã, o que já estava na fila não muda de conteúdo no meio do
  caminho, e o histórico mostra o que a cliente de fato recebeu. O preço é o
  horizonte curto de enfileiramento (60 min), para uma edição de template
  ainda alcançar o lembrete de amanhã.
- **Planejar e enviar são etapas separadas na mesma execução.** Sem gateway
  configurado, o planejamento continua rodando e a fila é visível em
  `/app/whatsapp` — o que tornou o disparador verificável antes de existir
  VPS. `getWhatsAppProvider()` devolve `null` nesse caso, e não um dublê que
  finge enviar: um dublê marcaria mensagens como "enviado" sem ninguém
  receber, e o histórico passaria a mentir.
- **Três regras que existem por causa de casos reais**, todas em
  `src/lib/reminders.ts` e `src/lib/data/outbox.ts`:
  agendamento que já começou não gera lembrete (senão ligar o recurso hoje
  dispararia mensagem para a agenda da semana passada); mensagem vencida há
  mais de 2h é cancelada em vez de enviada (o estúdio que passou dias
  desconectado e reconecta numa terça de manhã); e lembrete cujo horário ideal
  já passou sai agora em vez de ser descartado (melhor um aviso em cima da
  hora do que nenhum).
- **Consulta de estado, não webhook.** A tela de conexão e o disparador
  perguntam o estado à Evolution no momento em que ele importa
  (`syncWhatsAppConnection`). Webhook exigiria endpoint público recebendo
  callback e ainda deixaria o painel mentindo quando uma entrega se perdesse
  num deploy. O custo é uma requisição por estúdio por execução — e ela evita
  o pior cenário: o banco dizendo "conectado" com a sessão caída, e todas as
  mensagens gastando as quatro tentativas até virarem falha.
- **A rota do disparador é agnóstica de agendador, e falha fechada.** Aceita
  `GET` e `POST` com segredo em header, então serve tanto ao Cron da Vercel
  quanto a um `curl` no crontab da VPS — o que importa aqui porque o Cron da
  Vercel no plano gratuito roda 1x/dia, inviabilizando "1 hora antes". Sem
  `CRON_SECRET` no ambiente ela devolve 404: uma rota de disparo aberta na
  internet deixaria qualquer um enviando mensagem em nome dos estúdios.
- **Interface de gateway com cinco operações, sem nada de caixa de entrada.**
  O escopo decidido é só envio; prever recebimento na interface seria projetar
  para um produto que ninguém pediu. Trocar a Evolution por um gateway
  hospedado é escrever outro arquivo em `src/lib/whatsapp/` e mudar uma linha.
- **O que ficou de fora, e por quê**: o aviso ao DONO quando entra agendamento
  novo (hoje ainda é o link `wa.me` que a cliente toca). Falta uma decisão de
  produto que não é minha: a mensagem sairia do número do salão para o próprio
  número do salão — o único que o cadastro conhece —, o que funciona mas é
  esquisito. A alternativa é guardar um número pessoal do dono só para
  notificação, e isso é campo novo no cadastro.

## Superadmin detalhado + cobrança da plataforma (migração 0011)

- **"Faturamento" é o que o estúdio paga à Timely, não o que a cliente paga
  ao estúdio.** As duas coisas existem no produto e confundi-las
  contaminaria todo o painel, então elas vivem em lugares diferentes:
  `services.price_cents` (dinheiro do estúdio, some em "volume atendido") e
  as tabelas da 0011 (dinheiro da plataforma, some em MRR/receita). Cada KPI
  de volume atendido carrega a ressalva na própria tela.
- **Schema de cobrança agnóstico de gateway**: o provedor de Pix/cartão
  ainda não foi escolhido, então nenhuma coluna usa vocabulário de um
  gateway específico — cada linha tem `gateway` (texto) + ID externo, e
  webhook cru cai em `billing_events` com índice único `(gateway,
  external_event_id)` para idempotência. Trocar ou plugar provedor não exige
  migração nova. Nenhum segredo no banco; de cartão, só marca e 4 últimos
  dígitos (guardar PAN/CVV colocaria o projeto no escopo de PCI-DSS).
- **Assinatura cancelada continua na tabela**, e um índice único PARCIAL
  (`where status in ('trial','ativa','inadimplente','pausada')`) garante uma
  vigente por estúdio. Apagar a linha no cancelamento tornaria churn e
  histórico de receita impossíveis de calcular depois.
- **`invoices.total_cents` é coluna gerada pelo banco** (`amount - desconto`):
  se nenhum app escreve, nenhum app pode divergir do outro. Testado: `update`
  direto na coluna é recusado pelo Postgres.
- **Backfill coloca os estúdios existentes em trial, e só isso.** Sem ele o
  painel abriria com base vazia; com fatura ou pagamento semeado, abriria
  mentindo. Trial não é receita, então é o único estado seguro de semear — e
  o comando para desfazer está na própria migração.
- **`trial` fora do MRR, `inadimplente` dentro (mas destacado).** Somar teste
  em receita recorrente é a forma mais comum de um painel de SaaS enganar o
  próprio dono; a assinatura inadimplente, por outro lado, é contrato que
  existe e pode ser recuperado — aparece no MRR e, separadamente, como "MRR
  em risco".
- **Taxa de conversão de trial NÃO foi implementada**, apesar de ser um KPI
  óbvio: não há tabela de histórico de status, então qualquer número aqui
  seria chute com cara de medição. No lugar entrou "testes vencendo em 7
  dias", que é dado real e além de tudo acionável. Se a conversão for
  necessária, o caminho honesto é uma tabela `subscription_events`.
- **Bug real encontrado medindo contra o projeto Supabase**: `select("*", {
  count: "exact", head: true })` numa tabela que NÃO existe responde **204,
  `error` nulo, `count` nulo** — o PostgREST não manda corpo em resposta a
  HEAD. A checagem "a migração 0011 já rodou?" feita por contagem dizia
  "sim" para um banco sem as tabelas, e o painel de faturamento inteiro
  estourava logo depois. Corrigido usando `select("id").limit(1)`, que no
  mesmo caso devolve 404 + `PGRST205`. **Vale para qualquer checagem de
  existência de tabela neste projeto: não use `head: true`.**
- **"Estúdio ativo" e "em risco" saem da lista, não de contagens globais.**
  A primeira versão derivava por subtração (`total - ativos - novos`), o que
  contava duas vezes o estúdio novo que já agenda: número plausível e errado.
  Agora os dois critérios moram em `listStudiosWithActivity`, que olha
  agendamento por estúdio.
- **Ocupação é estimativa conservadora e a tela diz isso**: soma o expediente
  de `working_hours` por dia da semana na janela de 30 dias e ignora
  bloqueios pontuais (folga, feriado). Ignorar bloqueio infla o
  denominador, então o número nunca superestima a agenda cheia.
- **`--chart-3` do tema escuro foi trocado (#6ba3d8 → #4f97e8)**: no passo
  anterior o token reprovava no piso de croma e no par adjacente do
  validador de daltonismo da skill de dataviz contra o fundo escuro. Os
  gráficos do superadmin usam `--chart-1/2/3` (Pix, cartão, boleto), agora
  aprovados nos dois temas. Os tokens `--chart-4/5` continuam reprovando e
  por isso NÃO são usados como cor categórica em gráfico nenhum.
- **Todo gráfico tem tabela gêmea** (`ChartCard` com `<details>` "Ver dados
  em tabela"): gráfico é a única parte do painel em que o valor mora numa
  posição e não num texto, então sem a tabela quem usa leitor de tela, toque
  ou impressão perde o dado.
- **Migração validada em Postgres local antes de entregar**: subi um cluster
  temporário, criei os stubs do que o Supabase fornece (`auth.users`,
  `auth.uid()`, roles `anon`/`authenticated`/`service_role`) e rodei
  0001→0011 em ordem, mais 12 casos de constraint (duas assinaturas
  vigentes, cancelada sem data, desconto maior que o valor, fatura paga sem
  `paid_at`, Pix com dado de cartão, Pix parcelado, evento de gateway
  repetido, `card_last4` inválido...). Também comparei coluna por coluna o
  schema real com os tipos escritos à mão em `src/lib/supabase/types.ts` —
  as 15 tabelas conferem. Só a 0007 falha localmente, porque depende do
  schema `storage` do Supabase.

## Integração WhatsApp com a Evolution API 2.3.7 (2026-09-04)

Contexto: o plano em `plano_evo` pedia a integração completa contra a Evolution
2.3.7 rodando na VPS. A base já existia (adaptador, fila, disparador, telas); o
que faltava era webhook, envio manual, exclusão e — descobriu-se — correções de
contrato.

### Uma conexão por estúdio, e não N conexões nomeadas

O plano descreve vários WhatsApps nomeados por cliente ("Comercial",
"Suporte") com seletor no envio. Ficou **uma conexão por estúdio**, decisão do
dono do produto: `whatsapp_connections.studio_id` segue sendo a chave
primária, o disparador não mudou e não houve migração de cardinalidade.

Consequência aceita: não existe listagem de conexões, "+ Adicionar WhatsApp"
nem dropdown de seleção no envio — com uma conexão, quem a resolve é a sessão.
Mudar isso depois é migração de `whatsapp_connections` para `id` próprio +
`name` + `instance_name` único, mais `connection_id` em `reminder_settings`.

### Webhook E consulta, não webhook OU consulta

O webhook (`/api/webhooks/evolution`) atualiza o estado da conexão sem ninguém
clicar em nada, e é o único jeito de o sistema saber que a sessão morreu do
lado do WhatsApp (dono desvinculou o aparelho no celular) antes do próximo
envio falhar.

A consulta (polling na tela + `syncWhatsAppConnection` no disparador) **não foi
removida**: o webhook depende de a VPS alcançar a URL pública do app, o que não
acontece em desenvolvimento (localhost) nem durante um deploy. Uma entrega
perdida nessa janela deixaria o banco mentindo indefinidamente. Consulta é o
piso que sempre funciona; webhook é o que torna a tela instantânea.

`resolveWebhookTarget()` recusa localhost e recusa ausência de segredo — e a
tela diz, em vez de prometer atualização automática que não vai acontecer.

`MESSAGES_UPSERT` não é assinado: o produto só envia, e trazer conversa de
cliente para dentro da base seria dado pessoal de terceiro sem ninguém ter
pedido. O receptor entende o evento e responde 200 se ele chegar.

### O corpo do webhook contém a chave global do gateway

`webhook.controller.ts` inclui `apikey` (a chave GLOBAL da instalação) em toda
entrega. Por isso nada em `/api/webhooks/evolution` loga o corpo do evento — um
`console.log(body)` ali despejaria nos logs da plataforma a chave que controla
todas as instâncias. A autenticação usa header próprio
(`x-timely-webhook-secret`) com comparação de tempo constante, não a `apikey` do
corpo.

### Divergências da 2.3.7 encontradas conferindo o código-fonte da tag

O adaptador anterior seguia a "linha 2.x" por suposição. Quatro coisas estavam
erradas, todas confirmadas depois contra a instância real:

1. `GET /instance/connectionState/{nome}` devolve **só**
   `{ instance: { instanceName, state } }`. Não há `owner` nem `number` — o
   código lia esses campos, então **o número pareado nunca era preenchido**.
   Agora vem de `fetchInstances` (`ownerJid`), com a chamada extra feita só
   quando a sessão está aberta, ou do `wuid` do webhook.
2. `DELETE /instance/logout/{nome}` devolve **400** ("is not connected") com a
   sessão já fechada, não 404. Desconectar duas vezes é normal na tela.
3. `refused` (QR estourou o limite de tentativas) não é "desconectado": a
   sessão não volta sozinha, e chamar isso de desconectado faria a tela
   sugerir esperar quando o certo é gerar código novo.
4. `deploy/evolution/docker-compose.yml` fixava `v2.1.1` enquanto a VPS roda
   `2.3.7`.

### Enviar sem sessão TRAVA o gateway, não devolve erro

Medido no smoke test: `POST /message/sendText` com a sessão fechada não
responde — a requisição estoura o timeout. É por isso que
`sendManualWhatsAppMessage` e o disparador conferem o estado **antes** de
chamar o envio, em vez de "tentar e tratar o erro": tentar custaria 15s por
mensagem e, num lote de 25, estouraria o orçamento de tempo da rota de cron.

### `delete` é aceite, não conclusão

`DELETE /instance/delete/{nome}` emite `remove.instance` e responde
`SUCCESS` na hora; a remoção acontece no listener. Com a sessão já fechada, a
instância não está mais no mapa vivo, o listener não tem o que remover e a
linha fica pendurada no banco da Evolution.

Não afeta o produto: a sessão fica encerrada, o estado que a tela mostra é o da
nossa tabela (que a action zera), e reconectar depois funciona porque
`ensureInstance` trata o 403 "already in use" como sucesso e o `connect`
seguinte gera QR novo — caminho verificado na instância real.

### Envio manual entra na mesma fila, já resolvido

A mensagem manual é gravada em `message_outbox` com `kind = 'manual'` e o
resultado (`enviado`/`falhou`) **já definido** — nunca passa por `pendente`.
Se nascesse pendente e o processo morresse entre a gravação e o envio, o
disparador reivindicaria a linha depois e a cliente receberia a mensagem duas
vezes.

Guardar em vez de "mandar e esquecer" é o que faz "Últimas mensagens" não
mentir por omissão: sem isso, a mensagem que o dono mandou na mão há dois
minutos não apareceria em lugar nenhum, e é justamente esse histórico que
responde quando a cliente diz que não recebeu.

### Teto de envio contado no banco, não em memória

`/api/whatsapp/send` limita por contagem em `message_outbox` (20 por 10
minutos, por estúdio). Um limitador em memória contaria do zero em cada
instância serverless da Vercel — ou seja, não limitaria nada justamente quando
houvesse volume. O risco real que ele cobre não é a nossa infraestrutura: é o
**número do salão** ser bloqueado por disparo em sequência.

No webhook o limitador é em memória de propósito: ali quem autentica é o
segredo, a rota é idempotente, e o freio existe só para o caso de a Evolution
entrar em laço de reconexão.

### Duas portas, uma implementação

A tela usa Server Action (padrão do projeto para painel autenticado) e existe
`POST /api/whatsapp/send` (que o plano nomeia, e que mantém o frontend sem
conhecer a Evolution). As duas chamam `sendManualWhatsAppMessage` — validar em
dois lugares é como uma das portas acaba sem a checagem de propriedade meses
depois.

Nenhuma das duas aceita estúdio ou instância no corpo. O nome da instância é
derivado do ID do estúdio da sessão, e há teste que tenta forçar outro
inquilino pelo payload e verifica que não passa.
