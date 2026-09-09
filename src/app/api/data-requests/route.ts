import { NextResponse, type NextRequest } from "next/server";
import { getPublicStudioBySlug } from "@/lib/data/studios";
import { createDataSubjectRequest } from "@/lib/data/data-requests";
import { dataSubjectRequestSchema } from "@/lib/validation";

/**
 * Canal do art. 18 da LGPD, aberto na página pública de cada estúdio.
 *
 * Terceiro caminho de escrita pública do sistema, e segue o desenho dos dois
 * primeiros (/api/bookings e /api/leads): Zod no servidor e gravação por
 * service role, sem policy de escrita anônima no Postgres.
 *
 * NÃO EXIGE PROVA DE IDENTIDADE, e isso é deliberado: pedir documento para
 * abrir uma solicitação transformaria o exercício de um direito numa nova
 * coleta de dado sensível. A verificação de quem é quem acontece quando o
 * estúdio for atender o pedido — ele já conhece a cliente pelo telefone, que é
 * o mesmo identificador do agendamento. O que se grava aqui é o PEDIDO.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const slug =
    typeof (body as { slug?: unknown })?.slug === "string"
      ? (body as { slug: string }).slug
      : null;
  if (!slug) {
    return NextResponse.json({ error: "Estúdio não informado" }, { status: 400 });
  }

  const parsed = dataSubjectRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }

  const studio = await getPublicStudioBySlug(slug);
  if (!studio) {
    return NextResponse.json({ error: "Estúdio não encontrado" }, { status: 404 });
  }

  const result = await createDataSubjectRequest({
    studioId: studio.id,
    kind: parsed.data.kind,
    clientName: parsed.data.clientName,
    clientPhone: parsed.data.clientPhone,
    message: parsed.data.message,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Não foi possível registrar agora. Tente novamente em instantes." },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true });
}
