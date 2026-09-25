import type { NextRequest } from "next/server";
import { getMessageMedia } from "@/lib/data/conversationMedia";

/**
 * GET /api/conversations/media/:messageId — a foto, o áudio ou o documento de
 * uma mensagem, para o balão da conversa.
 *
 * O arquivo sai do WhatsApp a cada pedido (o app não guarda mídia), então a
 * resposta fica no cache PRIVADO do navegador: abrir a mesma conversa de novo
 * não baixa tudo outra vez, e nenhum cache compartilhado guarda foto de
 * cliente.
 */

export const maxDuration = 30;

export async function GET(request: NextRequest, ctx: RouteContext<"/api/conversations/media/[messageId]">) {
  const { messageId } = await ctx.params;

  let media;
  try {
    media = await getMessageMedia(messageId);
  } catch (cause) {
    console.error("[conversations/media]", cause);
    return new Response(null, { status: 502 });
  }
  if (!media) return new Response(null, { status: 404 });

  const download = request.nextUrl.searchParams.get("download") === "1";
  const name = (media.fileName ?? "arquivo").replace(/["\r\n\\]/g, "");
  return new Response(Buffer.from(media.bytes), {
    headers: {
      "Content-Type": media.mimeType,
      "Cache-Control": "private, max-age=86400",
      // Arquivo que chegou de fora: o navegador não deve adivinhar outro tipo
      // (um "documento" HTML rodando no domínio do app, por exemplo).
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
    },
  });
}
