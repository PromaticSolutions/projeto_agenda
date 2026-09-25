import type { NextRequest } from "next/server";
import { getContactPicture } from "@/lib/data/conversationMedia";

/**
 * GET /api/conversations/avatar/:chatId — a foto de perfil do contato.
 *
 * Passa pelo servidor em vez de o navegador ir direto ao CDN do WhatsApp: a
 * URL de lá expira em poucas horas e só se consegue pela chave do gateway.
 * 404 (sem foto, foto privada, WhatsApp desconectado) faz a tela mostrar as
 * iniciais.
 */

export const maxDuration = 20;

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/conversations/avatar/[chatId]">) {
  const { chatId } = await ctx.params;

  let picture;
  try {
    picture = await getContactPicture(decodeURIComponent(chatId));
  } catch (cause) {
    console.error("[conversations/avatar]", cause);
    picture = null;
  }
  if (!picture) {
    // Curto: quem não tinha foto pode pôr uma, e a conexão pode voltar.
    return new Response(null, { status: 404, headers: { "Cache-Control": "private, max-age=600" } });
  }

  return new Response(Buffer.from(picture.bytes), {
    headers: {
      "Content-Type": picture.mimeType,
      "Cache-Control": "private, max-age=21600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
