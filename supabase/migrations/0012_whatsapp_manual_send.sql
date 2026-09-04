-- Agenda Online — Promatic Solutions
-- Migração 0012: envio manual de WhatsApp (seções 20–24 do plano de integração).
-- Rode depois de 0001..0011.
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

-- `alter type ... add value` roda em transação a partir do PG 12 desde que o
-- valor novo não seja USADO na mesma transação — esta migração só o declara.
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
-- O índice de 0010 é (studio_id, created_at desc) sem recorte de `kind`;
-- este é parcial e cobre exatamente a pergunta do limitador.
create index if not exists message_outbox_manual_rate_idx
  on message_outbox (studio_id, created_at desc)
  where kind = 'manual';

comment on index message_outbox_manual_rate_idx is
  'Sustenta o teto de envios manuais por janela de tempo (rate limit de /api/whatsapp/send).';
