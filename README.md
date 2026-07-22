# Agenda Online — Promatic Solutions

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

**Depois de preencher as chaves, rode a migração** —
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — no
SQL Editor do seu projeto (Dashboard → SQL Editor → New query, cole o
arquivo inteiro e rode). Isso cria as tabelas, a constraint anti-colisão
de horário e as policies de RLS.

> Esta sessão não conseguiu aplicar a migração automaticamente: o MCP do
> Supabase disponível aqui está autenticado numa conta diferente da dona
> das chaves em `.env.local`, então rodar a migração por ele teria alterado
> o projeto errado. Rode o SQL manualmente uma vez — depois disso tudo no
> app já aponta para o banco real.

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
- `src/app/app/(dashboard)` — painel do dono (serviços, horários, agenda do dia).
- `src/app/api/bookings` — API route que revalida disponibilidade e cria o booking.
- `src/lib/availability.ts` — algoritmo de horários livres (com testes).
- `src/lib/data/*` — camada de dados; alterna Supabase real ↔ mock conforme `.env.local`.
- `src/lib/mock/store.ts` — dados fictícios usados quando o Supabase não está configurado.
- `supabase/migrations/0001_init.sql` — schema + RLS + constraint anti-colisão.

Decisões e riscos documentados em [DECISIONS.md](DECISIONS.md) e
[RISKS.md](RISKS.md). Status do projeto em [REPORT.md](REPORT.md).
