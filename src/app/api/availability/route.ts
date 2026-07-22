import { NextResponse, type NextRequest } from "next/server";
import { getPublicStudioBySlug } from "@/lib/data/studios";
import { getPublicService } from "@/lib/data/services";
import { listPublicWorkingHours } from "@/lib/data/workingHours";
import { listPublicBlocksInRange } from "@/lib/data/blocks";
import { listPublicBookingsInRange } from "@/lib/data/bookings";
import { getAvailableSlots, localDayRangeUtc } from "@/lib/availability";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const serviceId = searchParams.get("serviceId");
  const date = searchParams.get("date");

  if (!slug || !serviceId || !date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  try {
    const studio = await getPublicStudioBySlug(slug);
    if (!studio) {
      return NextResponse.json({ error: "Estúdio não encontrado" }, { status: 404 });
    }

    const service = await getPublicService(studio.id, serviceId);
    if (!service || !service.active) {
      return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });
    }

    const range = localDayRangeUtc(date);
    const [workingHours, blocks, bookings] = await Promise.all([
      listPublicWorkingHours(studio.id),
      listPublicBlocksInRange(studio.id, range.start.toISOString(), range.end.toISOString()),
      listPublicBookingsInRange(studio.id, range.start.toISOString(), range.end.toISOString()),
    ]);

    const slots = getAvailableSlots({
      date,
      durationMin: service.duration_min,
      workingHours,
      blocks: blocks.map((b) => ({ start: new Date(b.start_at), end: new Date(b.end_at) })),
      bookings: bookings
        .filter((b) => b.status !== "cancelado")
        .map((b) => ({ start: new Date(b.start_at), end: new Date(b.end_at) })),
      now: new Date(),
    });

    return NextResponse.json({
      slots: slots.map((slot) => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Não foi possível buscar os horários. Tente novamente." },
      { status: 500 }
    );
  }
}
