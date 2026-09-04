import "server-only";
import { getMyStudio } from "@/lib/data/studios";
import { syncWhatsAppConnection } from "@/lib/data/dispatch";
import {
  MANUAL_SEND_LIMIT,
  MANUAL_SEND_WINDOW_MINUTES,
  countRecentManualSends,
  recordManualMessage,
} from "@/lib/data/outbox";
import { getWhatsAppProvider, friendlyProviderError } from "@/lib/whatsapp/provider";
import { manualWhatsAppMessageSchema } from "@/lib/validation";
import { isSupabaseServiceConfigured } from "@/lib/supabase/env";

/**
 * Envio manual de mensagem: uma implementação, dois caminhos de entrada.
 *
 * A Server Action de /app/whatsapp e a rota POST /api/whatsapp/send chamam
 * ESTA função. A duplicação alternativa — validar em dois lugares — é como uma
 * das duas portas acaba sem a checagem de propriedade meses depois.
 *
 * A ordem das etapas não é acidental:
 *   1. o estúdio sai da SESSÃO, nunca do corpo da requisição (seção 6);
 *   2. o teto de envio vem antes de qualquer chamada ao gateway, senão o
 *      limitador não protege o que deveria proteger;
 *   3. o estado da conexão é RELIDO no gateway, porque o banco é espelho e
 *      pode estar velho — dizer "enviado" com a sessão caída é o pior
 *      resultado possível aqui;
 *   4. o número é conferido no WhatsApp antes do envio: mandar para número que
 *      não existe é o caminho conhecido para o número do salão ser marcado
 *      como spam.
 */

export type SendResult =
  | { ok: true; to: string; providerMessageId: string | null }
  | { ok: false; error: string; code: SendErrorCode };

/**
 * Código estável para quem consome a rota. A mensagem muda de redação sem
 * quebrar cliente; o código não.
 */
export type SendErrorCode =
  | "sem_estudio"
  | "sem_gateway"
  | "dados_invalidos"
  | "desconectado"
  | "numero_invalido"
  | "limite"
  | "falha_gateway"
  | "erro_interno";

export interface SendManualInput {
  phone: unknown;
  message: unknown;
}

export async function sendManualWhatsAppMessage(input: SendManualInput): Promise<SendResult> {
  // 1. Propriedade. O estúdio vem da sessão do Supabase Auth; nada no corpo da
  // requisição escolhe o inquilino. É isto que faz o cliente A não conseguir
  // enviar pelo WhatsApp do cliente B — não há parâmetro para ele trocar.
  const studio = await getMyStudio();
  if (!studio) {
    return { ok: false, code: "sem_estudio", error: "Estúdio não encontrado." };
  }

  if (!isSupabaseServiceConfigured) {
    return {
      ok: false,
      code: "erro_interno",
      error: "O histórico de mensagens não está disponível neste ambiente.",
    };
  }

  const parsed = manualWhatsAppMessageSchema.safeParse({
    phone: input.phone,
    message: input.message,
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "dados_invalidos",
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const { phone, message } = parsed.data;

  // 2. Teto de envio, antes de tocar no gateway.
  const recent = await countRecentManualSends(studio.id);
  if (recent >= MANUAL_SEND_LIMIT) {
    return {
      ok: false,
      code: "limite",
      error: `Você já enviou ${MANUAL_SEND_LIMIT} mensagens nos últimos ${MANUAL_SEND_WINDOW_MINUTES} minutos. Aguarde alguns minutos antes de enviar outra — disparo em sequência faz o WhatsApp bloquear o seu número.`,
    };
  }

  const provider = await getWhatsAppProvider();
  if (!provider) {
    return {
      ok: false,
      code: "sem_gateway",
      error: "O envio de WhatsApp ainda não está disponível neste ambiente.",
    };
  }

  // 3. Estado real da conexão, relido agora.
  let connection;
  try {
    connection = await syncWhatsAppConnection(studio.id, provider);
  } catch (cause) {
    console.error("[whatsapp/send] sync", cause);
    return { ok: false, code: "falha_gateway", error: friendlyProviderError(cause) };
  }

  if (connection.status !== "conectado" || !connection.instance_name) {
    return {
      ok: false,
      code: "desconectado",
      error: "WhatsApp desconectado. Conecte o WhatsApp antes de enviar mensagens.",
    };
  }
  const instanceName = connection.instance_name;

  // 4. O número existe no WhatsApp?
  try {
    const existence = await provider.checkNumbers(instanceName, [phone]);
    // `has` distingue "respondeu que não existe" de "não respondeu". Tratar
    // resposta vazia como número inválido barraria envio legítimo sempre que o
    // gateway mudasse o formato da resposta — melhor seguir e deixar o envio
    // dar o veredito.
    if (existence.has(phone) && existence.get(phone) === false) {
      return {
        ok: false,
        code: "numero_invalido",
        error: "Este número não tem WhatsApp. Confira o DDD e os dígitos.",
      };
    }
  } catch (cause) {
    // Verificação é proteção, não requisito. Se ela cair, o envio ainda pode
    // funcionar — e falhar aqui deixaria o recurso inteiro dependente de uma
    // rota secundária do gateway.
    console.error("[whatsapp/send] checkNumbers", cause);
  }

  // 5. Envio, com o resultado gravado no histórico dos dois jeitos.
  try {
    const { providerMessageId } = await provider.sendText({
      instanceName,
      toPhone: phone,
      body: message,
    });
    await recordManualMessage({
      studioId: studio.id,
      toPhone: phone,
      body: message,
      outcome: "enviado",
      providerMessageId,
    });
    return { ok: true, to: phone, providerMessageId };
  } catch (cause) {
    // O detalhe técnico vai para o log do servidor e para a coluna de erro do
    // histórico (que só o dono lê); para a tela vai a versão amigável.
    console.error("[whatsapp/send] sendText", cause);
    const technical = cause instanceof Error ? cause.message : "Falha desconhecida no envio";
    try {
      await recordManualMessage({
        studioId: studio.id,
        toPhone: phone,
        body: message,
        outcome: "falhou",
        error: technical,
      });
    } catch (recordCause) {
      console.error("[whatsapp/send] recordManualMessage", recordCause);
    }
    return { ok: false, code: "falha_gateway", error: friendlyProviderError(cause) };
  }
}
