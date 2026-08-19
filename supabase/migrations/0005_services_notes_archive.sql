-- Agenda Online — Promatic Solutions
-- Migração 0005: campo "Observações" nos serviços + arquivamento.
-- Rode depois de 0001..0004.

-- =========================================================
-- services.notes — campo livre e OPCIONAL (item 2 do escopo).
-- Uso interno do dono (preparo, contraindicação, material): NÃO é exibido
-- na página pública. O limite de 2000 caracteres espelha clients.notes,
-- validado também no Zod (serviceInputSchema).
-- =========================================================
alter table services add column if not exists notes text;

alter table services drop constraint if exists services_notes_length;
alter table services
  add constraint services_notes_length
  check (notes is null or char_length(notes) <= 2000);

-- =========================================================
-- services.archived_at — resolve o BUG de exclusão.
--
-- bookings.service_id é `references services (id) on delete restrict`
-- (0001_init.sql), de propósito: apagar um serviço não pode apagar o
-- histórico financeiro nem deixar agendamento órfão. A consequência é que
-- `delete from services` estoura 23503 (foreign key violation) para
-- qualquer serviço que já tenha sido agendado alguma vez — era exatamente
-- o que acontecia na tela, sem mensagem nenhuma para o dono.
--
-- Solução: exclusão em dois regimes, decidida no servidor
-- (src/lib/data/services.ts → deleteService):
--   - serviço SEM nenhum booking  -> DELETE de verdade (linha some);
--   - serviço COM bookings        -> arquivamento (archived_at = now()),
--                                    sai de todas as listas e da página
--                                    pública, mas o histórico continua
--                                    íntegro e legível.
-- =========================================================
alter table services add column if not exists archived_at timestamptz;

-- Índice parcial: as listagens do app filtram `archived_at is null` em
-- praticamente toda query de serviço.
create index if not exists services_studio_active_idx
  on services (studio_id)
  where archived_at is null;

comment on column services.notes is
  'Observações internas do dono, opcional. Não aparece na página pública.';
comment on column services.archived_at is
  'Preenchido quando o serviço foi "excluído" mas possui bookings — preserva o histórico. Nulo = serviço vigente.';
