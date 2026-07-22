import { describe, expect, it } from "vitest";
import { getAvailableSlots, localDateTimeToUtc, weekdayOfDate } from "@/lib/availability";

const wednesdayHours = [{ weekday: 3, start_time: "09:00", end_time: "12:00" }];

describe("weekdayOfDate", () => {
  it("2026-07-22 é uma quarta-feira", () => {
    expect(weekdayOfDate("2026-07-22")).toBe(3);
  });
});

describe("getAvailableSlots", () => {
  it("gera slots de 60min cobrindo o turno inteiro", () => {
    const slots = getAvailableSlots({
      date: "2026-07-22",
      durationMin: 60,
      workingHours: wednesdayHours,
      blocks: [],
      bookings: [],
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(slots).toHaveLength(3);
    expect(slots[0].start).toEqual(localDateTimeToUtc("2026-07-22", "09:00"));
    expect(slots.at(-1)!.end).toEqual(localDateTimeToUtc("2026-07-22", "12:00"));
  });

  it("não gera slot quando o serviço não cabe no turno", () => {
    const slots = getAvailableSlots({
      date: "2026-07-22",
      durationMin: 200,
      workingHours: wednesdayHours,
      blocks: [],
      bookings: [],
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(slots).toHaveLength(0);
  });

  it("remove slots que colidem com um booking ativo", () => {
    const booking = {
      start: localDateTimeToUtc("2026-07-22", "10:00"),
      end: localDateTimeToUtc("2026-07-22", "11:00"),
    };
    const slots = getAvailableSlots({
      date: "2026-07-22",
      durationMin: 60,
      workingHours: wednesdayHours,
      blocks: [],
      bookings: [booking],
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(slots.map((s) => s.start.getTime())).not.toContain(booking.start.getTime());
    expect(slots).toHaveLength(2);
  });

  it("remove slots que colidem com um bloqueio parcial (folga)", () => {
    const block = {
      start: localDateTimeToUtc("2026-07-22", "09:30"),
      end: localDateTimeToUtc("2026-07-22", "10:30"),
    };
    const slots = getAvailableSlots({
      date: "2026-07-22",
      durationMin: 30,
      workingHours: wednesdayHours,
      blocks: [block],
      bookings: [],
      now: new Date("2026-01-01T00:00:00Z"),
    });
    const starts = slots.map((s) => s.start.getTime());
    expect(starts).not.toContain(localDateTimeToUtc("2026-07-22", "09:30").getTime());
    expect(starts).not.toContain(localDateTimeToUtc("2026-07-22", "10:00").getTime());
    expect(starts).toContain(localDateTimeToUtc("2026-07-22", "09:00").getTime());
    expect(starts).toContain(localDateTimeToUtc("2026-07-22", "10:30").getTime());
  });

  it("respeita a antecedência mínima e ignora horários que já passaram", () => {
    const now = localDateTimeToUtc("2026-07-22", "09:45");
    const slots = getAvailableSlots({
      date: "2026-07-22",
      durationMin: 60,
      workingHours: wednesdayHours,
      blocks: [],
      bookings: [],
      now,
      minLeadMin: 30,
    });
    // 09:00 e 10:00 caem antes de now+30min (10:15); só 11:00 sobra dentro do turno de 60min
    expect(slots).toHaveLength(1);
    expect(slots[0].start).toEqual(localDateTimeToUtc("2026-07-22", "11:00"));
  });

  it("não gera slots para um dia da semana sem turno cadastrado", () => {
    const slots = getAvailableSlots({
      date: "2026-07-23", // quinta-feira
      durationMin: 60,
      workingHours: wednesdayHours,
      blocks: [],
      bookings: [],
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(slots).toHaveLength(0);
  });

  it("usa slotStepMin diferente da duração quando configurado", () => {
    const slots = getAvailableSlots({
      date: "2026-07-22",
      durationMin: 60,
      slotStepMin: 30,
      workingHours: wednesdayHours,
      blocks: [],
      bookings: [],
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(slots).toHaveLength(5); // 09:00,09:30,10:00,10:30,11:00 (todos cabem em até 12:00)
  });
});
