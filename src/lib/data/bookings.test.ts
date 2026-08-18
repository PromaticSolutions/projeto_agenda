/**
 * Cobre o agendamento MANUAL feito pelo dono (grade + encaixe) rodando contra
 * o store em memória — o mesmo modo mock que o app usa sem .env.local.
 */
import { describe, expect, it } from "vitest";
import {
  createOwnerBooking,
  listOwnerAvailableSlots,
} from "@/lib/data/bookings";
import { MOCK_STUDIO_ID, mockListBookings, mockListServices } from "@/lib/mock/store";
import { localDateTimeToUtc, nextLocalDate, utcToLocalDate, weekdayOfDate } from "@/lib/availability";

/** Próxima terça-feira a partir de hoje (mock tem expediente seg-sex 09-12 / 13-18). */
function nextTuesday(): string {
  let d = utcToLocalDate(new Date());
  for (let i = 0; i < 14; i++) {
    d = nextLocalDate(d);
    if (weekdayOfDate(d) === 2) return d;
  }
  throw new Error("sem terça");
}

const service = mockListServices(MOCK_STUDIO_ID, { activeOnly: true })[0]; // 40 min
const date = nextTuesday();

describe("agendamento manual (dono)", () => {
  it("lista horários livres do dia", async () => {
    const slots = await listOwnerAvailableSlots(MOCK_STUDIO_ID, service.id, date);
    expect(slots).not.toBeNull();
    expect(slots!.length).toBeGreaterThan(0);
    expect(slots![0].start).toBe(localDateTimeToUtc(date, "09:00").toISOString());
  });

  it("cria na grade e depois recusa o mesmo horário", async () => {
    const slots = (await listOwnerAvailableSlots(MOCK_STUDIO_ID, service.id, date))!;
    const chosen = slots[0];

    const created = await createOwnerBooking({
      studioId: MOCK_STUDIO_ID,
      serviceId: service.id,
      clientName: "Cliente Balcão",
      clientPhone: "5511999998888",
      startAt: new Date(chosen.start),
      durationMin: service.duration_min,
      allowOffGrid: false,
    });
    expect(created.ok).toBe(true);

    const again = await createOwnerBooking({
      studioId: MOCK_STUDIO_ID,
      serviceId: service.id,
      clientName: "Outra Cliente",
      clientPhone: "5511999997777",
      startAt: new Date(chosen.start),
      durationMin: service.duration_min,
      allowOffGrid: false,
    });
    expect(again).toEqual({ ok: false, error: "conflict" });

    // o slot some da grade depois de ocupado
    const after = (await listOwnerAvailableSlots(MOCK_STUDIO_ID, service.id, date))!;
    expect(after.some((s) => s.start === chosen.start)).toBe(false);
  });

  it("recusa horário fora da grade quando NÃO é encaixe", async () => {
    const result = await createOwnerBooking({
      studioId: MOCK_STUDIO_ID,
      serviceId: service.id,
      clientName: "Fora da Grade",
      clientPhone: "5511999996666",
      startAt: localDateTimeToUtc(date, "20:00"),
      durationMin: service.duration_min,
      allowOffGrid: false,
    });
    expect(result).toEqual({ ok: false, error: "conflict" });
  });

  it("aceita encaixe fora do expediente", async () => {
    const result = await createOwnerBooking({
      studioId: MOCK_STUDIO_ID,
      serviceId: service.id,
      clientName: "Encaixe Noturno",
      clientPhone: "5511999995555",
      startAt: localDateTimeToUtc(date, "20:00"),
      durationMin: 25,
      allowOffGrid: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.booking.end_at).toBe(localDateTimeToUtc(date, "20:25").toISOString());
      expect(result.booking.status).toBe("agendado");
    }
  });

  it("encaixe NÃO pode sobrepor outro atendimento", async () => {
    const result = await createOwnerBooking({
      studioId: MOCK_STUDIO_ID,
      serviceId: service.id,
      clientName: "Sobreposto",
      clientPhone: "5511999994444",
      startAt: localDateTimeToUtc(date, "20:10"),
      durationMin: 30,
      allowOffGrid: true,
    });
    expect(result).toEqual({ ok: false, error: "conflict" });
  });

  it("recusa serviço inexistente", async () => {
    const result = await createOwnerBooking({
      studioId: MOCK_STUDIO_ID,
      serviceId: "00000000-0000-0000-0000-000000000000",
      clientName: "Sem Serviço",
      clientPhone: "5511999993333",
      startAt: localDateTimeToUtc(date, "10:00"),
      durationMin: 30,
      allowOffGrid: true,
    });
    expect(result).toEqual({ ok: false, error: "service_not_found" });
  });

  it("grava os agendamentos criados no dia", () => {
    const range = { from: localDateTimeToUtc(date, "00:00").toISOString(), to: localDateTimeToUtc(nextLocalDate(date), "00:00").toISOString() };
    const list = mockListBookings(MOCK_STUDIO_ID, range);
    expect(list.map((b) => b.client_name)).toEqual(["Cliente Balcão", "Encaixe Noturno"]);
  });
});
