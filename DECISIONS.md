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

### O histórico de migrations estava vazio (2026-09-04)

Ao aplicar a 0012 o Supabase respondeu `type "message_outbox_kind" does not
exist`. A causa não era a 0012: **o banco remoto estava na 0009**. As 0010
(fila de mensagens) e 0011 (faturamento) nunca tinham sido aplicadas, e é a
0010 que cria esse tipo.

O porquê ficou claro em `supabase migration list`: a coluna `remote` estava
vazia nas doze migrations. As 0001–0009 foram aplicadas **à mão no SQL
Editor**, então `supabase_migrations.schema_migrations` nunca registrou nada —
e sem registro ninguém percebeu que duas migrations ficaram para trás.

`supabase db push` NÃO era o caminho: com o histórico vazio ele começaria na
0001, que tem `create table studios` e `create type booking_status` sem
guarda, além de `add column` sem `if not exists` e um `insert into clients`
desprotegido na 0004. A correção foi `migration repair --status applied
0001..0009` (escreve só o histórico, não executa DDL) e depois `db push`, que
aplicou exatamente 0010, 0011 e 0012.

Lição operacional: aplicar migration pelo SQL Editor deixa o CLI cego. Use
`db push`, ou registre com `migration repair` na sequência.

### Índice composto, não parcial, por causa do enum

A 0012 nasceu com um índice parcial `where kind = 'manual'` e isso estava
errado: o PostgreSQL recusa USAR um valor de enum acrescentado na mesma
transação ("unsafe use of new value of enum type"), e tanto o SQL Editor
quanto o `db push` rodam cada migração em transação. O `alter type` e um
índice que menciona o valor novo não cabem no mesmo arquivo.

Trocado por `(studio_id, kind, created_at desc)`, que não menciona o valor: a
consulta do limitador é igualdade, igualdade, faixa — a ordem exata das
colunas —, resolve com a mesma eficiência, serve qualquer outro recorte por
`kind`, e cabe em uma migração só. Dividir em 0012 + 0013 resolveria também,
mas duas migrations para um índice é pior que um índice melhor.

## Landing page (2026-09-04)

A rota `/` era `redirect("/login")`. Agora é a landing.

Uma primeira versão foi construída e descartada na revisão: doze seções, ~2.400
palavras e um formulário de pesquisa de nove etapas. Explicava bem e convertia
mal — o visitante precisava LER para entender o produto. A versão atual tem
nove seções e ~700 palavras.

### Não existe logo "Interavia"

O briefing pedia para usar "a logo Interavia já presente no projeto". Ela não
existe: zero ocorrências de "interavia" em qualquer arquivo. A única marca do
projeto é o nó de vidro do Timely — `public/brand/logo.png` (via `SystemLogo`)
e a versão em WebGL (`GlassKnotMark`/`GlassKnotBackdrop`). Decisão do dono do
produto: usar a marca existente.

### A landing usa a mesma superfície das telas de auth

Hero e seção de custo são `bg-plum-900` com `AuthParticles`, e o hero tem o
`GlassKnotBackdrop` — os mesmos componentes do `AuthShell`. É o que faz quem
clica em "Criar conta" cair numa tela com o mesmo fundo, sem sensação de ter
trocado de site. Nenhuma cor, fonte ou raio novo foi introduzido; o CSS já
registrava que gradiente violeta→magenta e `rounded-[2rem] shadow-2xl` foram
removidos de propósito, e isso foi respeitado.

Só um canvas 3D por página: as outras seções escuras repetem as partículas
mas não o nó. Dois contextos WebGL na mesma rota dobrariam o custo de GPU para
repetir um efeito já visto.

### O CTA final não é uma pesquisa

Cinco campos: nome, negócio (opcional), profissão, WhatsApp, e-mail. Cada
campo obrigatório extra é uma chance de desistir no último passo, e quem chega
ao fim do funil é exatamente quem não pode esbarrar em pergunta que ninguém
pediu.

A inteligência de mercado vem por dois caminhos que não pesam na conversão:

1. **A faixa da interação de custo** viaja com o lead (`hours_lost_band`). A
   pessoa respondeu porque queria ver o número, não porque perguntamos — por
   isso vale mais que uma pergunta direta, e não é perguntada de novo. O
   transporte entre a seção e o formulário é um store de módulo com
   `useSyncExternalStore` (`hours-band.tsx`), e não Context: as duas são
   irmãs dentro de um Server Component, e um provider carregaria JavaScript em
   volta de seções que não precisam de nenhum.
2. **Três perguntas opcionais na tela de confirmação**, gravadas uma a uma por
   `PATCH /api/leads` sem botão de enviar. Fechar a página ali não perde nada:
   o lead já está completo.

O CTA fica sempre clicável e diz o que falta no envio. Desabilitá-lo até tudo
estar preenchido deixava um botão cinza na primeira olhada — parece defeito, e
não informa o que fazer.

### Mockup em HTML, não screenshot

As prévias de produto são a interface montada com os primitivos do sistema
(`panel`, `Badge`, fonte mono para dado tabular) — a anatomia de
`components/app/booking-card.tsx`. Imagem estática seria mais fácil e pior:
não acompanha o tema claro/escuro, desalinha da interface real no primeiro
ajuste de layout, e um PNG legível no desktop pesa demais no celular.

### O que a landing NÃO afirma

- **Múltiplos profissionais**: não existe cadastro de equipe no banco (nenhuma
  tabela de staff em `supabase/migrations`). A seção de dúvidas diz isso
  explicitamente. Prometer geraria cadastro frustrado no primeiro dia.
- **Responder mensagem**: o produto envia, não recebe. A demo do WhatsApp
  mostra a cliente respondendo para o DONO, não para um robô.
- **Depoimentos**: não há nenhum. O carousel de cenários da primeira versão
  foi REMOVIDO — era o bloco mais pesado da página e ainda assim não era prova
  social. Sem depoimento real, melhor não ter a seção.
- **Dinheiro no simulador**: a interação de custo estima só tempo. Multiplicar
  por um ticket médio que ninguém informou produziria "R$ 4.200/mês perdidos"
  — número inventado, e o tipo de afirmação que destrói a confiança no resto
  da página.
- **Links de privacidade e termos no rodapé**: essas páginas não existem, e um
  link para 404 custa mais confiança do que a ausência dele.

### Leads em tabela própria, sem policy de RLS

`market_research_leads` (0013) não é `clients`: cliente é quem marca horário
num estúdio, com `studio_id` obrigatório. Lead é um profissional avaliando o
produto, sem estúdio. Juntar os dois obrigaria `studio_id` nulo e desmontaria
a RLS que isola cliente por estúdio.

A tabela não tem policy nenhuma, igual a `message_outbox`: a landing é
pública, e uma policy de insert para `anon` deixaria qualquer pessoa despejar
linhas direto no PostgREST sem passar pela validação. Escrita e leitura só por
`service_role`, via `/api/leads`.

Preencher o formulário NÃO cria conta e não toca `auth.users` — nenhuma
autenticação paralela. Quem quiser testar passa pelo `/signup` existente.

A 0014 tornou opcionais os campos que a 0013 exigia e acrescentou
`business_name`, `email`, `hours_lost_band` e `privacy_accepted_at`. Este
último é separado de `contact_allowed` de propósito: um é aceite de tratamento
de dados, o outro é permissão de contato, e juntar os dois faria a base perder
a distinção justamente quando ela for questionada.

### O aviso do lead entra na fila existente

`enqueueLeadNotification` grava em `message_outbox` com `kind = 'lead'` em vez
de chamar o gateway na hora. Se a Evolution estiver fora do ar quando o lead
chega — justamente quando ninguém está olhando —, um envio direto perderia o
aviso. Na fila ele herda a retentativa, a contagem de tentativas e o histórico
do disparador que roda de 5 em 5 minutos.

`LEADS_NOTIFY_STUDIO_ID` existe porque a arquitetura amarra instância a
estúdio e a landing não tem sessão. Falhar no aviso nunca derruba o envio: o
lead já está gravado, e é o dado que interessa.

O resumo OMITE o que não foi respondido, em vez de imprimir "(não respondeu)":
ele chega no primeiro envio, quando quase todo o contexto está vazio, e uma
lista de dez "não respondeu" enterraria os cinco dados que importam.

Consequência conhecida: `STALE_AFTER_MINUTES = 120` no disparador cancela
mensagem vencida há mais de 2h. Se a fila travar esse tempo, o aviso é
descartado — o lead permanece no banco. Aceitável para notificação.

### Sem instalar analytics

O projeto não tem nenhum. `src/lib/analytics.ts` marca os pontos de medição e
despacha um `CustomEvent` no `window`; ligar um provedor depois é um
`addEventListener` num lugar só. Escolher ferramenta de analytics é decisão de
produto (custo, LGPD, onde o dado fica), não algo para um arquivo de landing
resolver — e instrumentar as seções depois seria varrer a landing de novo.

### Detalhes que custaram tempo

- **`setState` dentro de efeito** é recusado pelo lint do React Compiler. O
  tratamento de `prefers-reduced-motion` virou CSS (`motion-reduce:opacity-100`)
  em vez de JavaScript — melhor de qualquer forma: quem pediu menos movimento
  não deve depender de um observer disparar para ler a página.
- **`nativeButton={false}`** é obrigatório no `Button` do Base UI quando ele
  renderiza um `<Link>`/`<a>`: sem isso o componente promete semântica de
  `<button>`, entrega um `<a>`, e reclama no console. O mesmo padrão existe em
  cinco lugares fora da landing (error.tsx, superadmin/layout.tsx,
  demo-mode-notice.tsx, entre outros) e continua sem a correção.
- **`scroll-mt-16`** nas seções com âncora: o header é sticky com `h-16`, e sem
  isso clicar num link do menu esconde o topo da seção atrás dele.
- **`noscript`**: as seções entram com `opacity-0`. Sem JavaScript a página
  ficaria em branco (cenário de rastreador ou bundle abortado), então há uma
  regra `<noscript>` que neutraliza o efeito.
- A rota `/` sai **estática** no build, apesar das seções interativas.

## Reposicionamento visual para o setor de estética

### A tipografia sóbria foi revertida — de propósito

O par IBM Plex Sans + IBM Plex Mono foi escolhido para o sistema ler como
"software profissional de gestão", e lia. O problema é que essa era a leitura
errada para o público: quem contrata o Timely trabalha com estética, e um
grotesco corporativo com dado em mono faz a página parecer ferramenta de TI.

Agora são **Playfair Display** em título (a serifa editorial que o setor
reconhece de revista e de vitrine) e **Nunito Sans** no corpo (humanista, de
terminações arredondadas, com a altura-x que tela densa exige). O IBM Plex Mono
sobreviveu com papel bem menor: só IDENTIFICADOR — nome de instância, slug,
chave. Horário e valor saíram do mono e viraram `tabular-nums`, que alinha a
coluna sem o ar de terminal.

**A serifa só entra a partir de ~1.25rem.** A regra base aplicava
`font-heading` até `h4`; com uma sans isso era inofensivo, com uma display de
alto contraste não é — `h3`/`h4` sem classe de tamanho caem em 1rem, e a
Playfair a 16px perde as hastes finas. A regra agora cobre `h1`/`h2`, `h3`/`h4`
voltaram para a sans, e `font-heading` foi removido de `card.tsx`,
`dialog.tsx`, `onboarding-preview.tsx` e dos preços do `booking-flow.tsx`, que
eram usos em corpo pequeno. O `tracking-tight` saiu dos títulos: tracking
negativo fecha os brancos internos da serifa e come justamente o desenho pelo
qual ela foi escolhida.

### Neutros quentes e cantos macios

Nenhum cinza do sistema é neutro puro agora — todos carregam um resto de
vermelho. O fundo saiu de `#f4f5f7` (cinza frio) para `#faf7f4` (marfim), e o
tema escuro seguiu junto, de cinza azulado para cinza com resto de vinho: a
marca é roxa e ficava mal acomodada sobre um fundo frio.

A escala de raio parava em 10px no MAIOR passo, deixando botão e campo com 4px.
Canto duro é um dos sinais mais fortes de "ferramenta técnica". Agora
`rounded-lg` (botão, campo — 41 usos) vale 10px e `rounded-2xl` (o `panel`)
vale 16px. Continua uma escala curta: nada aqui vira pílula.

O `panel` ganhou `--shadow-panel`, uma sombra baixa e quente. Só a borda de 1px
era o desenho de planilha; só a sombra deixaria o bloco sem contorno no tema
escuro, onde ela some. Os dois juntos dão separação com ar de papel apoiado.

**A ação primária continua violeta, não magenta.** Magenta sobre branco fica em
~4,9:1 e o violeta em ~6,6:1 — trocar a cor de todo botão do sistema por uma
menos legível seria pagar acessibilidade por charme. O rosa ganhou espaço onde
decora sem carregar texto pequeno. Os dez pares de cor do sistema foram medidos
e todos passam em AA (4,5:1) nos dois temas.

### Consentimento de cookies

O aviso é FLUTUANTE e não bloqueante, e as duas opções têm o mesmo peso visual.
Modal que trava a página até o clique irrita quem chegou para ler e, por coagir,
enfraquece o consentimento que diz coletar; recusa escondida tem o mesmo
problema. Não há X que fecha sem escolher — fechar sem responder viraria
consentimento presumido.

O texto descreve o que o site FAZ, conferido no navegador: a landing e o login
não escrevem cookie nenhum antes de entrar, e não existe analytics instalado.
Por isso nada de "parceiros de publicidade".

O que a escolha controla de fato é o `track()` de `lib/analytics.ts`, que agora
só despacha com consentimento. O corte fica ali, e não no provedor futuro, para
que ligar uma ferramenta continue sendo um `addEventListener` num lugar só —
ela nasce sem receber dado de quem recusou, sem precisar saber que
consentimento existe.

A escolha vive num cookie próprio (`timely.consent`, 180 dias), lido por
`useSyncExternalStore` — cookie é estado externo, e `useState`+`useEffect` aqui
gera o render em cascata que o compilador do React 19 aponta. O instantâneo do
servidor é `"desconhecida"`, não `"nenhuma"`: chutar "nenhuma" colocaria o
cartão no HTML de toda visita, inclusive de quem já respondeu, para escondê-lo
na hidratação.

## Base de conformidade com a LGPD

### O aviso de cookies tem um botão só, e isso é honestidade

Não existe cookie de rastreamento neste site — conferido no navegador: a
landing, a página pública e o login não escrevem cookie nenhum, e os de sessão
do Supabase só nascem depois de entrar. O "Aceitar" grava `analytics: false`,
porque não há analytics para autorizar. Um botão "Recusar" ao lado sugeriria
que existe algo sendo recusado, que é teatro de consentimento.

A categoria `analytics` existe mesmo assim em `lib/consent.ts`, e nasce
`false`. Quando um provedor for ligado, o banner ganha o segundo botão sem que
cookie, gate ou política precisem ser refeitos.

### `policyVersion` dentro do cookie, e comparação por igualdade

O cookie guarda a versão da política aceita. `isConsentCurrent` compara por
IGUALDADE, não por ordem: versões são rótulos ("2026-09"), e `<` daria a
resposta errada no dia em que o formato mudar. Cookie de versão desconhecida —
anterior OU posterior — manda perguntar de novo, que é o lado seguro. Registro
corrompido cai no mesmo caminho: `parseConsent` devolve `null` e o banner volta.

A data exibida em `/politica-de-privacidade` é DERIVADA de `POLICY_VERSION`,
não digitada. Se as duas pudessem divergir, o texto mudaria sem ninguém ser
perguntado de novo.

### `consent.ts` e `consent-server.ts` são dois arquivos por necessidade

`next/headers` lança fora do runtime de servidor, e o núcleo é importado pelo
banner, que é Client Component. Num arquivo só, o bundle do navegador
arrastaria `next/headers` e a página quebraria na hidratação. O que os dois
lados compartilham — parse, categorias, versão — ficou num lugar só.

O instantâneo de `useSyncExternalStore` devolve a STRING crua do cookie, não o
registro parseado: o hook compara por identidade, e um objeto novo a cada
leitura seria laço infinito de render. E o instantâneo do servidor é
`"desconhecida"`, distinto de "não existe cookie" — chutar "não existe" poria o
cartão no HTML de toda visita, inclusive de quem já respondeu, para escondê-lo
na hidratação.

### Consentimento do agendamento é tabela, não coluna

`consents` (0015) guarda um FATO DATADO: quem aceitou qual versão da política,
quando. Um booleano em `bookings` responderia "aceitou?" e perderia qual texto
foi aceito — que é justamente o que muda quando a política é reescrita. Em
tabela à parte o registro sobrevive ao agendamento ser excluído (`on delete set
null`), e é isso que mantém a prova de pé.

A policy é `for select`, não `for all`: o dono precisa consultar para responder
ao titular, mas registro de consentimento que o interessado pode reescrever não
prova nada.

**A falha ao gravar o consentimento NÃO derruba o agendamento.** O horário já
está reservado quando o registro roda, e a constraint anti-colisão significa
que desfazer abriria a vaga que a pessoa acabou de garantir — ela veria "não
foi possível confirmar" para um horário que é dela. O aceite em si é validado
ANTES, pelo `createBookingSchema` no servidor: nada é criado sem ele. O que se
perde numa falha é a prova, não o ato, e por isso o resultado volta na resposta
da API (`consent`) e a falha vai para o log.

### O canal do art. 18 fica sob `/[slug]`, não na plataforma

O controlador dos dados de agendamento é o estúdio, não o Timely. Um canal
único da plataforma daria a impressão errada de quem decide e ainda obrigaria a
cliente a lembrar em qual estúdio marcou — o link já carrega isso.

O formulário NÃO pede documento: exigir prova de identidade para exercer um
direito transformaria isso numa nova coleta de dado sensível. A verificação
acontece quando o estúdio for atender, e ele já conhece a cliente pelo telefone.

O atendimento é manual de propósito. Apagar dados pode esbarrar em guarda
fiscal ou atendimento em andamento; automatizar exclusão sem essa avaliação
criaria um botão de apagar histórico disfarçado de conformidade.

## O aviso de lead ganhou um remetente próprio

### Por que não bastava "cadastrar o WhatsApp que recebe"

WhatsApp não tem caixa de entrada avulsa: para a mensagem chegar, alguma sessão
conectada precisa ENVIAR. Quem lê o QR vira o remetente, não o destinatário —
daí a tela pedir dois números em vez de um. Se forem o mesmo, a mensagem cai em
"Mensagem para você mesmo", que é o arranjo de quem tem um chip só.

### A instância da plataforma é separada da de cada estúdio

Até aqui `message_outbox.studio_id` era `not null` e o disparador derivava a
instância de `instanceNameForStudio(studio_id)` — ou seja, todo envio saía pela
sessão de um inquilino. Mandar aviso de lead por ali significaria usar o
WhatsApp de um cliente para tráfego que não é dele.

A 0017 torna `studio_id` opcional (nulo = mensagem da plataforma) e cria
`platform_whatsapp`, linha única com a sessão própria e o número de destino. A
policy de leitura do outbox compara `studio_id in (...)`, e nulo não casa com
nada — então nenhum dono passa a ver mensagem da plataforma. O índice único de
idempotência já era parcial em `booking_id is not null`, então avisos sem
agendamento não colidem entre si.

No disparador o desvio é de três linhas: a instância vem da plataforma quando
`studio_id` é nulo, do estúdio quando não é. Expiração, tentativa e erro não
sabem a diferença.

### A fila só nasce com a sessão de pé

`leadNotifyTarget()` devolve número apenas quando existe destino E o status é
`conectado`. Sem essa checagem o aviso entraria na fila para ser adiado a cada
rodada do cron até expirar — barulho no log para um envio que nunca ia sair. O
lead em si é gravado de qualquer jeito: perder a notificação é um problema,
perder o lead é outro.

### As variáveis de ambiente viraram fallback

`LEADS_NOTIFY_PHONE` e `LEADS_NOTIFY_STUDIO_ID` continuam funcionando para quem
já as tinha, mas a fonte preferida é a tabela. Variável de ambiente exige
redeploy para trocar um número e obriga alguém a descobrir o UUID de um estúdio
para preencher o remetente — que nem é mais o desenho.

### Cada server action repete o `checkPlatformAdmin`

Server Action é endpoint público. O layout do /superadmin esconder a tela não
impede alguém de chamar a action direto, então o guard está em cada uma, não só
na rota. Mesmo raciocínio do lado do estúdio, onde o guard é `getMyStudio()`.

## Auditoria do funil de leads e da fila (2026-09-09)

### O QR da plataforma nunca esteve quebrado no gateway

A tela do superadmin mostrava o rótulo "aguardando leitura do QR" e uma imagem
quebrada. A causa não era a Evolution: `connect()` remove o prefixo
`data:image/png;base64,` da resposta (o adaptador devolve base64 puro, como o
tipo `ProviderPairing` declara), e o painel entregava essa string ao
`next/image` como se fosse uma URL. O painel do estúdio sempre montou a data
URL na hora de renderizar; o da plataforma foi escrito depois e ficou fora do
padrão.

Duas consequências do mesmo desalinhamento foram corrigidas junto:

- O QR só era exibido enquanto `status === "conectando"`, e o polling de 3s
  sobrescreve esse status. Durante o pareamento a Evolution alterna entre
  `connecting` e `close` a cada código novo, então o QR sumia da tela no
  primeiro `close`. Agora o material de pareamento tem estado próprio e só sai
  quando conecta, quando dá erro, ou quando o teto de polling expira.
- Quando a 2.3.7 responde à primeira conexão sem QR (ela espera 2s e o código
  pode não ter nascido), a tela ficava muda. Agora diz para gerar de novo.

### O webhook não conhecia a instância da plataforma

`handleEvent` procurava a instância em `whatsapp_connections` e devolvia
"não é nossa" para qualquer nome que não estivesse lá — inclusive
`<prefixo>_plataforma`, que mora na linha única de `platform_whatsapp`. O
efeito: a sessão da plataforma podia morrer no celular e o banco seguir dizendo
"conectado" até alguém abrir a tela e clicar em atualizar, com o aviso de lead
sendo enfileirado para um remetente que não existia mais.

### A tela de leads é o registro; o WhatsApp é a notificação

O aviso tem três pontos de falha fora do controle de quem espera por ele:
sessão caída, destino não configurado, disparador parado. Enquanto o único
canal era o WhatsApp, um lead que caísse em qualquer um dos três ficava
gravado e invisível dentro do produto. `/superadmin/leads` fecha isso, e quando
o aviso não pode sair a tela diz qual condição falta em vez de deixar a
pergunta para outra tela.

### Mensagem presa em "enviando" agora volta para a fila

`claim_pending_messages` marca o lote como "enviando" ANTES do envio — é o que
impede dois disparadores de mandarem a mesma mensagem duas vezes. O preço é que
um processo morto no meio (timeout, deploy, crash) deixa a linha pendurada:
nenhuma execução futura a reivindica, porque o claim só olha "pendente", e ela
nunca vira "falhou". O lembrete não sai e não aparece como problema em lugar
nenhum.

`requeueStuckMessages` roda ANTES do claim, para que o resgate possa sair na
mesma rodada. A tentativa consumida não é devolvida: uma mensagem que derruba o
processo toda vez precisa esbarrar em `MAX_SEND_ATTEMPTS` em vez de tentar para
sempre.

### Teto anti-abuso nos dois caminhos públicos que não tinham

`/api/leads` já contava envios por janela no banco; `/api/bookings` e
`/api/data-requests` não contavam nada.

- Agendamentos: a constraint anti-colisão impede duas marcações no mesmo
  horário, não impede encher a agenda inteira com horários diferentes. Trinta
  por estúdio a cada dez minutos é folgado o bastante para nenhum salão real
  esbarrar — e dez minutos de espera custa muito menos que uma agenda
  inutilizada.
- Solicitações do titular: não exigir identidade é o que torna o canal
  utilizável, e é também o que o deixa aberto. Dez por estúdio a cada dez
  minutos nunca alcança quem realmente precisa exercer um direito.

A contagem é no banco nos dois casos, pelo mesmo motivo do lead: na plataforma
cada requisição pode cair numa instância diferente, e um contador em memória
começaria do zero em cada uma. A 0018 acrescenta o índice que a contagem de
agendamentos usa.

### O que foi encontrado e NÃO foi mexido

- `message_outbox_kind` tem `'novo_agendamento'` desde a 0010, e nada no código
  produz esse tipo. O aviso ao dono acontece pelo `wa.me` que a própria cliente
  dispara na tela de sucesso (RISKS.md #7). Ligar o envio automático somaria um
  segundo aviso para o mesmo fato — é decisão de produto, não conserto.
- `PATCH /api/leads` e `updateLeadContext` não têm chamador: o formulário virou
  multi-etapas e manda o contexto inteiro na captura. A rota continua de pé e
  validada; remover é limpeza, não correção.
