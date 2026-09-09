-- Agenda Online — Promatic Solutions
-- Índices que sustentam os tetos anti-abuso dos caminhos públicos de escrita.
-- Rode depois de 0017.

-- =========================================================
-- Por que este índice existe
-- =========================================================
-- `/api/bookings` passou a contar quantos agendamentos o estúdio recebeu nos
-- últimos minutos antes de aceitar mais um. A contagem roda a cada POST da
-- página pública, e o único índice que começa por `studio_id`
-- (bookings_studio_id_start_at_idx) ordena por `start_at` — o Postgres
-- alcançaria as linhas do estúdio por ele, mas teria que filtrar `created_at`
-- uma a uma. Num salão com anos de histórico isso é varrer tudo a cada
-- marcação nova.
--
-- `data_subject_requests` já nasceu com (studio_id, created_at desc) em 0016,
-- então o teto daquele canal não precisa de índice novo.
create index if not exists bookings_studio_created_at_idx
  on bookings (studio_id, created_at desc);

comment on index bookings_studio_created_at_idx is
  'Sustenta a contagem por janela do teto anti-abuso em /api/bookings.';
