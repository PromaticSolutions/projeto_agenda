-- Agenda Online — Promatic Solutions
-- Migração 0012: envio manual de WhatsApp (seções 20–24 do plano de integração).
-- Rode depois de 0001..0011 — em especial DEPOIS DA 0010, que é quem cria o
-- tipo `message_outbox_kind` e a tabela `message_outbox` alterados aqui.
--
-- POR QUE O ENVIO MANUAL ENTRA NA MESMA FILA:
-- a alternativa era mandar direto pelo gateway e não guardar nada. Isso
-- deixaria a tela de WhatsApp mentindo por omissão — "Últimas mensagens"
-- mostraria só os lembretes automáticos, e a mensagem que o dono mandou na mão
-- há dois minutos não apareceria em lugar nenhum. Quando a cliente reclamar
-- que não recebeu, é justamente esse histórico que responde.
--
-- A diferença em relação ao lembrete é o momento: o lembrete é planejado e
-- espera a hora; o manual é tentado na hora e a linha nasce com o resultado
-- (`enviado` ou `falhou`) já gravado. O disparador nunca reivindica essas
-- linhas porque elas não nascem `pendente`.

-- `if not exists` deixa a migração re-executável, como as demais do diretório.
alter type message_outbox_kind add value if not exists 'manual';

-- ---------------------------------------------------------------------------
-- Índice do teto de envio
-- ---------------------------------------------------------------------------
-- A seção 30 pede proteção contra abuso em /api/whatsapp/send. O contador não
-- ganha tabela própria: a fila JÁ é o registro de todo envio manual do
-- estúdio, então o teto é uma contagem por janela de tempo — e ao contrário de
-- um limitador em memória, esta contagem funciona igual em qualquer número de
-- instâncias serverless, que é o cenário real na Vercel.
--
-- A consulta que ele sustenta é
--   where studio_id = ? and kind = 'manual' and created_at >= ?
-- ou seja igualdade, igualdade, faixa — exatamente a ordem das colunas abaixo.
--
-- POR QUE COMPOSTO E NÃO PARCIAL (`where kind = 'manual'`):
-- um índice parcial precisaria escrever o literal 'manual' no DDL, e o
-- PostgreSQL recusa USAR um valor de enum acrescentado na MESMA transação —
-- "unsafe use of new value of enum type". Como o SQL Editor do Supabase e o
-- `supabase db push` rodam cada migração em transação, o `alter type` acima e
-- um índice parcial não cabem no mesmo arquivo: a migração falharia inteira.
--
-- O índice composto não menciona o valor novo, resolve a mesma consulta com a
-- mesma eficiência, e ainda serve qualquer outro recorte por `kind` (o índice
-- da 0010 é (studio_id, created_at desc), sem `kind`). Uma migração, sem
-- armadilha de transação.
create index if not exists message_outbox_studio_kind_created_idx
  on message_outbox (studio_id, kind, created_at desc);

comment on index message_outbox_studio_kind_created_idx is
  'Sustenta o teto de envios manuais por janela de tempo (rate limit de /api/whatsapp/send) e qualquer leitura da fila recortada por kind.';
