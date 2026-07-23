-- Agenda Online — Promatic Solutions
-- Migração 0002: privilégios de tabela para anon/authenticated/service_role.
--
-- Necessária quando 0001_init.sql é aplicada por uma conexão direta ao
-- Postgres (ex.: `psql`/CLI como role `postgres`) em vez do SQL Editor do
-- Dashboard: o RLS por si só não basta, o Postgres também exige GRANT em
-- nível de tabela antes de avaliar as policies. Sem isso, toda query via
-- PostgREST (inclusive com a service_role key, que ignora RLS mas não
-- ignora GRANT) falha com "permission denied for table ...".
--
-- Idempotente — pode ser rodada de novo sem efeito colateral.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on routines to anon, authenticated, service_role;
