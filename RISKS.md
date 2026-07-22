# Análise de risco e mitigação

Cada item abaixo é um risco real do domínio (agendamento multi-tenant
público), com a mitigação efetivamente aplicada no código — não só
descrita. Atualizado conforme as etapas avançam.

## 1. Race condition de agendamento duplo

**Cenário**: dois clientes abrem a página pública, veem o mesmo horário
livre e clicam em confirmar quase simultaneamente.

**Mitigação em 3 camadas**:
1. *Cliente*: a lista de horários é só sugestão (seção 8 do spec); nunca é
   tratada como fonte de verdade.
2. *Servidor*: `createBookingServerSide`
   ([bookings.ts](src/lib/data/bookings.ts)) recarrega working_hours,
   blocks e bookings vigentes e roda `isSlotStillAvailable` (mesma função
   pura de [availability.ts](src/lib/availability.ts)) antes do INSERT.
3. *Banco*: `bookings_no_overlap`
   ([0001_init.sql](supabase/migrations/0001_init.sql)) é uma
   `EXCLUDE USING gist` sobre `(studio_id, tstzrange(start_at, end_at))`
   para bookings não cancelados. Mesmo que dois requests passem a camada 2
   ao mesmo tempo (TOCTOU), o Postgres recusa o segundo INSERT com
   `23P01 exclusion_violation`, e o código trata esse erro como
   `{ok:false, error:"conflict"}` — nunca deixa vazar como erro 500.
   Esta é a garantia real; as camadas 1–2 são só UX.

**Limite conhecido**: o store mock (sem Supabase configurado) reimplementa
a checagem de colisão em JS (`mockCreateBooking`) sem constraint de banco
de verdade — aceitável para demo, não é a garantia de produção.

## 2. Fuso horário e horário de verão (America/Sao_Paulo)

**Risco**: horários de turno cadastrados como "09:00" sendo interpretados
no fuso do servidor (ex.: UTC em produção) em vez do fuso do estúdio,
deslocando toda a agenda; ou quebra se o Brasil reintroduzir horário de
verão.

**Mitigação**: `working_hours.start_time`/`end_time` são `time` (hora de
parede, sem fuso) e SÓ são convertidos para instantes UTC via
`localDateTimeToUtc` (`date-fns-tz`, IANA tz `America/Sao_Paulo`) — nunca
por aritmética manual de offset. `bookings.start_at`/`end_at` são sempre
`timestamptz` (UTC) no banco. Isso é correto tanto no cenário atual (BR
sem DST desde 2019) quanto se o DST voltar, porque `date-fns-tz` resolve o
offset a partir do calendário IANA, não de uma constante fixa.

## 3. Validação server-side além da client-side

**Risco**: validar só no formulário do navegador permite enviar preço,
duração, horário ou status manipulados via DevTools/curl direto na API.

**Mitigação**: a API route de criação de booking
(`src/app/api/bookings/route.ts`) nunca confia em `price`/`duration`
vindos do client — recarrega o `service` do banco pelo `service_id` e
calcula `end_at = start_at + service.duration_min` no servidor. Todo
payload passa por `zod` antes de tocar o banco. RLS (item 4) garante que
mesmo uma escrita autenticada não vaze para outro estúdio.

## 4. RLS: um dono nunca vê dados de outro estúdio

**Mitigação**: toda tabela tem `enable row level security` +
policy `using/with check (studio_id in (select id from studios where
owner_id = auth.uid()))` (studios usa `owner_id = auth.uid()` direto). Não
existe policy pública de leitura — a página `/[slug]` nunca usa a chave
anônima, só a service role no servidor (item 5), então RLS nem entra em
jogo nesse caminho por design.

**Como testar** (quando o Supabase estiver plugado): criar 2 usuários via
Auth, um estúdio para cada, e confirmar via SQL Editor/anon key que o
usuário A não consegue `select`/`update` linhas do estúdio B. Não há teste
automatizado disso nesta sessão (exigiria um projeto Supabase real) — ver
REPORT.md.

## 5. Exposição da service_role key

**Mitigação**: `createServiceRoleSupabaseClient`
([service.ts](src/lib/supabase/service.ts)) importa `"server-only"` no
topo — qualquer tentativa de importar esse módulo a partir de código que
acaba num bundle de cliente quebra o build. A variável
`SUPABASE_SERVICE_ROLE_KEY` não tem prefixo `NEXT_PUBLIC_`, então o
Next.js nunca a injeta no bundle do browser.

## 6. Validação/sanitização de nome e telefone

**Mitigação**: schema `zod` compartilhado (`src/lib/validation.ts`) usado
tanto no formulário do cliente quanto na API route:
- `client_name`: trim, 2–80 caracteres, bloqueia string vazia/só espaços.
- `client_phone`: normalizado para dígitos (remove máscara), validado
  como E.164 BR (`55` + DDD + número, 12–13 dígitos) antes de gravar —
  mesmo formato exigido pelo `wa.me`.
Isso também é reforçado pelas `check constraints` no banco
(`client_name`/`client_phone`/`whatsapp` na migração).

## 7. Falha no redirect do WhatsApp (fallback)

**Risco**: pop-up blocker, `wa.me` fora do ar, ou o navegador do cliente
bloqueando o redirect deixam o cliente "preso" numa tela de sucesso sem
saber se o dono foi avisado — mas o booking JÁ FOI CRIADO no banco nesse
ponto, então não pode parecer que "deu erro".

**Mitigação**: a tela de sucesso sempre mostra a confirmação do
agendamento primeiro (não depende do redirect para provar que funcionou),
com o link `wa.me` como `<a href>` normal (não só `window.location`,
que pode ser bloqueado) + botão "Copiar mensagem" como fallback manual.
