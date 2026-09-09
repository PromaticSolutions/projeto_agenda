import { NextResponse, type NextRequest } from "next/server";
import { getPublicStudioBySlug } from "@/lib/data/studios";
import { createBookingServerSide } from "@/lib/data/bookings";
import { createBookingSchema } from "@/lib/validation";
import { clientIpFromRequest, recordBookingConsent } from "@/lib/data/consents";

/**
 * Único caminho de escrita pública do sistema. Recebe o slug do estúdio +
 * serviceId + dados do cliente + horário candidato, e SEMPRE revalida a
 * disponibilidade no servidor antes de gravar (ver src/lib/data/bookings.ts
 * e RISKS.md item 1) — a lista de horários do client é só sugestão.
 *
 * O ACEITE DA POLÍTICA é validado aqui pelo Zod, antes de qualquer escrita: sem
 * `privacyAccepted: true` a requisição morre em 400 e nenhum agendamento
 * nasce. Depois de gravado, o consentimento vira linha em `consents` (migração
 * 0015) amarrada ao `booking_id` — a prova datada de qual versão da política
 * foi aceita. Ver a nota em `lib/data/consents.ts` sobre por que uma falha
 * nesse registro não derruba o agendamento.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const slug = typeof (body as { slug?: unknown })?.slug === "string" ? (body as { slug: string }).slug : null;
  if (!slug) {
    return NextResponse.json({ error: "Estúdio não informado" }, { status: 400 });
  }

  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }

  try {
    const studio = await getPublicStudioBySlug(slug);
    if (!studio) {
      return NextResponse.json({ error: "Estúdio não encontrado" }, { status: 404 });
    }

    const result = await createBookingServerSide({
      studioId: studio.id,
      serviceId: parsed.data.serviceId,
      clientName: parsed.data.clientName,
      clientPhone: parsed.data.clientPhone,
      startAt: new Date(parsed.data.startAt),
    });

    if (!result.ok) {
      const message =
        result.error === "conflict"
          ? "Esse horário acabou de ser ocupado. Escolha outro, por favor."
          : "Serviço indisponível. Atualize a página e tente novamente.";
      return NextResponse.json({ error: message, code: result.error }, { status: 409 });
    }

    const consent = await recordBookingConsent({
      studioId: studio.id,
      bookingId: result.booking.id,
      clientId: result.booking.client_id,
      clientPhone: parsed.data.clientPhone,
      ipAddress: clientIpFromRequest(request.headers),
    });

    return NextResponse.json({
      booking: {
        id: result.booking.id,
        startAt: result.booking.start_at,
        endAt: result.booking.end_at,
        status: result.booking.status,
      },
      whatsapp: studio.whatsapp,
      // Não muda o status da resposta: o agendamento está feito de qualquer
      // jeito. Volta para dar visibilidade a quem monitora conformidade.
      consent,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Não foi possível confirmar o agendamento. Tente novamente." },
      { status: 500 }
    );
  }
}
