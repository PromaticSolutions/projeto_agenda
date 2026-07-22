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
