-- Agenda Online — Promatic Solutions
-- Migração 0003: quem pode acessar o painel super admin (/superadmin).
--
-- Tabela separada de `studios` de propósito — "dono de estúdio" e "admin da
-- plataforma" são papéis diferentes e não devem se misturar. Sem policy de
-- SELECT/INSERT/UPDATE/DELETE para anon/authenticated: só a service_role key
-- (usada no servidor, nunca exposta ao browser) enxerga essa tabela. Ou seja,
-- mesmo um usuário autenticado não consegue nem confirmar se o próprio ID
-- está aqui via client comum — a checagem de admin sempre passa pelo server.
--
-- Depois de rodar esta migração, adicione o primeiro admin manualmente no
-- SQL Editor do projeto Supabase (pegue o id em Authentication > Users):
--   insert into platform_admins (user_id) values ('<uuid-do-usuario>');

create table platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table platform_admins enable row level security;

-- Mesmo gotcha documentado em 0002_grants.sql: RLS não dispensa o GRANT de
-- tabela que o PostgREST exige antes de sequer avaliar as policies. Sem
-- isso, a service_role key também tomaria "permission denied".
grant all on platform_admins to anon, authenticated, service_role;
