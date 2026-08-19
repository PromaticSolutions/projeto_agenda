import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseServiceConfigured } from "@/lib/supabase/env";
import { runReminderDispatch } from "@/lib/data/dispatch";

/**
 * Rota do disparador de lembretes.
 *
 * Deliberadamente agnóstica de agendador: é uma requisição HTTP autenticada
 * por segredo, então serve tanto para o Cron da Vercel quanto para um
 * `curl` no crontab da VPS. Isso importa aqui em particular — o Cron da
 * Vercel no plano gratuito roda UMA VEZ POR DIA, o que inviabiliza lembrete
 * de "1 hora antes". Com a VPS que já vai existir para a Evolution, um
 * crontab de 5 em 5 minutos batendo nesta rota resolve sem plano pago. Ver
 * README.
 *
 * Chamar duas vezes seguidas é seguro: o planejamento é idempotente por
 * índice único e o envio reivindica cada mensagem com FOR UPDATE SKIP LOCKED.
 */

// A execução fala com o Postgres e com o gateway; o padrão de 10s da
// plataforma é curto para um lote de 25 mensagens.
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Sem segredo configurado a rota fica FECHADA. O contrário — abrir quando
  // não há segredo — deixaria qualquer um na internet disparando mensagens do
  // sistema inteiro no dia em que a variável faltasse no ambiente.
  if (!secret) return false;

  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  // Alternativa para agendadores que não deixam customizar o Authorization.
  return request.headers.get("x-cron-secret") === secret;
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    // 404, e não 401: a rota não anuncia a própria existência para quem não
    // tem o segredo.
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  if (!isSupabaseServiceConfigured) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY não configurada — o disparador não roda em modo mock" },
      { status: 503 }
    );
  }

  try {
    const report = await runReminderDispatch();
    return NextResponse.json({ ok: true, ...report });
  } catch (cause) {
    // O corpo precisa ser JSON mesmo em erro: um cron externo lê a resposta
    // para decidir se alerta (mesma decisão de /api/bookings, ver DECISIONS).
    const message = cause instanceof Error ? cause.message : "Falha no disparador";
    console.error("[cron/reminders]", cause);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// GET para o Cron da Vercel (que só faz GET) e POST para agendadores externos.
export const GET = handle;
export const POST = handle;
