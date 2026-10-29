import { NextResponse, type NextRequest } from "next/server";
import { getBookablePublicStudioBySlug } from "@/lib/data/studios";
import { getPublicService } from "@/lib/data/services";
import {
  MAX_AVAILABILITY_DAYS,
  loadAvailabilityWindow,
  slotsByDay,
} from "@/lib/data/publicAvailability";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Horários livres de um serviço.
 *
 *   ?date=YYYY-MM-DD           → `{ slots }` daquele dia (contrato original).
 *   ?date=YYYY-MM-DD&days=N    → também `{ days: [{ date, slots }] }`, de
 *                                `date` até N-1 dias depois — a faixa de datas
 *                                da página pública.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const serviceId = searchParams.get("serviceId");
  const date = searchParams.get("date");
  const daysParam = Number(searchParams.get("days") ?? "1");

  if (!slug || !serviceId || !date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }
  if (!Number.isInteger(daysParam) || daysParam < 1 || daysParam > MAX_AVAILABILITY_DAYS) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  try {
    const studio = await getBookablePublicStudioBySlug(slug);
    if (!studio) {
      return NextResponse.json({ error: "Estúdio não encontrado" }, { status: 404 });
    }

    const service = await getPublicService(studio.id, serviceId);
    if (!service || !service.active) {
      return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });
    }

    const window = await loadAvailabilityWindow(studio.id, date, daysParam);
    const days = slotsByDay(window, service.duration_min, date, daysParam);

    return NextResponse.json({ slots: days[0]?.slots ?? [], days });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Não foi possível buscar os horários. Tente novamente." },
      { status: 500 }
    );
  }
}
