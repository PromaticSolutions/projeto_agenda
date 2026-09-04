import { NextResponse, type NextRequest } from "next/server";
import { sendManualWhatsAppMessage, type SendErrorCode } from "@/lib/data/whatsappSend";

/**
 * POST /api/whatsapp/send — envio manual de mensagem (seções 23, 24 e 31).
 *
 * A rota existe para que nada no navegador conheça a Evolution: o cliente fala
 * este caminho, e trocar de gateway amanhã não muda uma linha do frontend.
 *
 * A tela de /app/whatsapp usa a Server Action equivalente, que é o padrão do
 * projeto para operação autenticada de painel. As duas chamam a MESMA função
 * (`sendManualWhatsAppMessage`), então a checagem de propriedade, o teto de
 * envio e as validações não existem em duplicidade — que é como uma das duas
 * portas acaba sem alguma delas meses depois.
 *
 * Autenticação: o cookie de sessão do Supabase Auth, o mesmo do resto de /app.
 * O corpo NÃO carrega estúdio nem instância; quem decide o inquilino é a
 * sessão (seção 6). Não há parâmetro para o cliente A apontar para o
 * WhatsApp do cliente B.
 */

// Fala com o gateway e com o Postgres; o padrão de 10s é curto quando a
// Evolution está lenta.
export const maxDuration = 30;

/** Código de erro do domínio → status HTTP. */
const STATUS_BY_CODE: Record<SendErrorCode, number> = {
  sem_estudio: 401,
  sem_gateway: 503,
  dados_invalidos: 400,
  desconectado: 409,
  numero_invalido: 422,
  limite: 429,
  falha_gateway: 502,
  erro_interno: 500,
};

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;

  try {
    // `instanceId` do payload conceitual do plano é ignorado de propósito: com
    // uma conexão por estúdio, quem a resolve é a sessão. Aceitar o campo
    // seria criar exatamente o parâmetro que a seção 6 manda não confiar.
    const result = await sendManualWhatsAppMessage({
      phone: payload.phone,
      message: payload.message,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        {
          status: STATUS_BY_CODE[result.code],
          // Sem Retry-After, um cliente que bateu no teto reenviaria na hora.
          ...(result.code === "limite" ? { headers: { "Retry-After": "600" } } : {}),
        }
      );
    }

    return NextResponse.json({
      ok: true,
      to: result.to,
      // O ID do gateway serve para rastrear entrega numa reclamação. Não
      // expõe nada da infraestrutura.
      providerMessageId: result.providerMessageId,
    });
  } catch (cause) {
    console.error("[api/whatsapp/send]", cause);
    return NextResponse.json(
      { error: "Não foi possível enviar a mensagem. Tente novamente.", code: "erro_interno" },
      { status: 500 }
    );
  }
}
