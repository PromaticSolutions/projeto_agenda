import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  findWhatsAppConnectionByInstanceName,
  saveWhatsAppConnection,
} from "@/lib/data/whatsapp";
import { mapState } from "@/lib/whatsapp/evolution";
import { WEBHOOK_SECRET_HEADER, evolutionWebhookSecret } from "@/lib/whatsapp/provider";
import { isSupabaseServiceConfigured } from "@/lib/supabase/env";

/**
 * Receptor dos eventos da Evolution API (seções 13 e 14 do plano).
 *
 * O que ele resolve: sem webhook, a tela só descobre que o QR foi lido quando
 * alguém pergunta — e o pior caso não é a tela, é a sessão que MORRE (dono
 * desvinculou o aparelho no celular) e ninguém saber até o lembrete não sair.
 *
 * O que ele NÃO substitui: a consulta de estado. O webhook depende de a VPS
 * alcançar a URL pública do app, o que não acontece em desenvolvimento
 * (localhost) nem durante um deploy — uma entrega perdida nessa janela
 * deixaria o banco mentindo para sempre. Por isso os dois convivem: consulta é
 * o piso que sempre funciona, webhook é o que torna a tela instantânea.
 *
 * FORMATO CONFERIDO NA 2.3.7 (webhook.controller.ts): o corpo chega como
 *   { event, instance, data, destination, date_time, sender, server_url, apikey }
 * com `event` em minúsculas e pontos ("connection.update"), mesmo que os
 * eventos sejam ASSINADOS em maiúsculas ("CONNECTION_UPDATE").
 *
 * ATENÇÃO: o corpo inclui `apikey` — a chave GLOBAL do gateway. Nada aqui
 * loga o corpo inteiro por causa disso; um `console.log(body)` neste arquivo
 * despejaria a chave que controla todas as instâncias nos logs da plataforma.
 */

// Handler curto de propósito: a Evolution tem timeout de 30s por entrega e
// repete o que falha. Trabalho longo aqui viraria evento duplicado.
export const maxDuration = 15;

/** Corpo maior que isto é descartado sem parse. */
const MAX_BODY_BYTES = 256 * 1024;

/**
 * Teto de eventos por instância, em memória.
 *
 * Não é o controle de acesso — quem autentica é o segredo do header. É freio
 * para o caso de a Evolution entrar em laço de reconexão e martelar a rota
 * (cenário real quando o QR expira em sequência).
 *
 * Em memória, e portanto por instância serverless: o limite efetivo é mais
 * alto que o número abaixo quando a plataforma escala. Isso é aceitável aqui
 * porque a rota é autenticada e idempotente — ao contrário de
 * /api/whatsapp/send, cujo teto precisa ser exato e por isso é contado no
 * banco.
 */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_INSTANCE = 120;
const hits = new Map<string, { count: number; resetAt: number }>();

function overRateLimit(key: string, now: number): boolean {
  const current = hits.get(key);
  if (!current || current.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    // Varredura oportunista: sem isto, o Map cresce com uma entrada por
    // instância que já foi excluída e nunca mais aparece.
    if (hits.size > 500) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    return false;
  }
  current.count++;
  return current.count > RATE_MAX_PER_INSTANCE;
}

/** Comparação de tamanho fixo: `===` em segredo vaza o prefixo pelo tempo. */
function secretMatches(received: string | null): boolean {
  if (!evolutionWebhookSecret || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(evolutionWebhookSecret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface EvolutionEvent {
  event?: unknown;
  instance?: unknown;
  data?: unknown;
}

export async function POST(request: NextRequest) {
  // Sem segredo configurado a rota fica FECHADA, como /api/cron/reminders.
  // Abrir quando a variável falta deixaria qualquer um na internet marcando o
  // WhatsApp de um estúdio como conectado — e, com isso, fazendo o disparador
  // gastar as tentativas de toda a fila daquele salão.
  if (!evolutionWebhookSecret) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  if (!secretMatches(request.headers.get(WEBHOOK_SECRET_HEADER))) {
    // 404, e não 401: a rota não anuncia a própria existência para quem não
    // tem o segredo.
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Corpo muito grande" }, { status: 413 });
  }

  let body: EvolutionEvent;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Corpo muito grande" }, { status: 413 });
    }
    body = JSON.parse(text) as EvolutionEvent;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const event = typeof body.event === "string" ? body.event.toLowerCase() : "";
  const instanceName = typeof body.instance === "string" ? body.instance : "";

  if (!event || !instanceName) {
    return NextResponse.json({ error: "Evento sem event/instance" }, { status: 400 });
  }

  if (overRateLimit(instanceName, Date.now())) {
    // 429 com Retry-After: a Evolution repete o que falha, e sem o cabeçalho
    // ela repetiria imediatamente.
    return NextResponse.json(
      { error: "Muitos eventos" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  if (!isSupabaseServiceConfigured) {
    // 200 de propósito: sem service_role não há onde gravar, mas devolver erro
    // faria a Evolution repetir eternamente um evento que nunca vai ser
    // aceito neste ambiente.
    return NextResponse.json({ ok: true, ignorado: "sem service_role" });
  }

  try {
    const handled = await handleEvent(event, instanceName, body.data);
    return NextResponse.json({ ok: true, event, handled });
  } catch (cause) {
    // Só a mensagem, nunca o corpo do evento — ele contém `apikey`.
    console.error(
      "[webhooks/evolution]",
      event,
      cause instanceof Error ? cause.message : "falha desconhecida"
    );
    // 500 faz a Evolution tentar de novo, o que é o certo para falha
    // transitória de banco: o evento ainda é útil daqui a alguns segundos.
    return NextResponse.json({ ok: false, error: "Falha ao processar evento" }, { status: 500 });
  }
}

async function handleEvent(
  event: string,
  instanceName: string,
  data: unknown
): Promise<boolean> {
  // Instância desconhecida: evento de outro sistema que compartilha o mesmo
  // gateway, ou conexão já excluída daqui. Nada a fazer, e responder 200
  // impede o laço de retentativa.
  const connection = await findWhatsAppConnectionByInstanceName(instanceName);
  if (!connection) return false;

  const studioId = connection.studio_id;
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};

  switch (event) {
    case "connection.update": {
      const raw = typeof record.state === "string" ? record.state : null;
      const status = mapState(raw);
      // `wuid` ("5511999999999@s.whatsapp.net") é o único lugar da 2.3.7 que
      // entrega o número pareado sem uma segunda chamada ao gateway.
      const phone = digitsFromJid(record.wuid);

      await saveWhatsAppConnection(studioId, {
        status,
        connected_phone: status === "conectado" ? (phone ?? connection.connected_phone) : null,
        last_error:
          status === "erro"
            ? "O pareamento não foi concluído. Gere um novo QR code."
            : null,
        ...(status === "conectado" ? { last_connected_at: new Date().toISOString() } : {}),
      });
      return true;
    }

    case "qrcode.updated": {
      // A Evolution emitiu um QR novo — ou seja, ninguém leu o anterior e o
      // pareamento segue em aberto. Só firma "conectando" quando o banco
      // ainda não diz "conectado": um QR atrasado chegando depois da conexão
      // não pode rebaixar o estado de uma sessão que já abriu.
      if (connection.status !== "conectado") {
        await saveWhatsAppConnection(studioId, { status: "conectando", last_error: null });
        return true;
      }
      return false;
    }

    case "logout.instance":
    case "remove.instance": {
      // A sessão morreu do lado do WhatsApp (aparelho desvinculado no celular,
      // por exemplo). Sem este evento, o sistema só descobriria no próximo
      // envio — e a tela seguiria dizendo "conectado" até lá.
      await saveWhatsAppConnection(studioId, {
        status: "desconectado",
        connected_phone: null,
        last_error: null,
      });
      return true;
    }

    case "messages.upsert":
      // Mensagem recebida. O produto só ENVIA (ver DECISIONS.md): guardar
      // conversa de cliente traria dado pessoal de terceiro para dentro da
      // nossa base sem ninguém ter pedido. O evento não é assinado por padrão
      // (ver EVOLUTION_WEBHOOK_EVENTS); este caso existe para responder 200 a
      // um gateway configurado à mão, em vez de deixá-lo repetindo.
      return false;

    default:
      // Evento fora do que o app trata. 200 sem trabalho é a resposta certa:
      // 4xx aqui só geraria retentativa de algo que nunca vamos usar.
      return false;
  }
}

function digitsFromJid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.split("@")[0]?.replace(/\D/g, "") ?? "";
  // O banco exige ^\d{10,15}$; devolver algo fora disso faria o upsert
  // estourar a check constraint e o evento virar 500 em laço.
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}
