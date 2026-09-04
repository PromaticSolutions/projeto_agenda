import { describe, expect, it } from "vitest";
import {
  bookingPeriodRange,
  filterBookings,
  groupBookingsByDay,
  parseBookingPeriod,
  parseBookingStatusFilter,
  parseBookingView,
} from "@/lib/bookings-filter";
import { localDateTimeToUtc } from "@/lib/availability";
import type { Booking, BookingStatus } from "@/lib/types";

function makeBooking(overrides: {
  date: string;
  time: string;
  name?: string;
  phone?: string;
  status?: BookingStatus;
  serviceId?: string;
}): Booking {
  const start = localDateTimeToUtc(overrides.date, overrides.time);
  return {
    id: `${overrides.date}T${overrides.time}`,
    studio_id: "studio-1",
    service_id: overrides.serviceId ?? "svc-1",
    client_id: "client-1",
    client_name: overrides.name ?? "Ana Souza",
    client_phone: overrides.phone ?? "5511987654321",
    start_at: start.toISOString(),
    end_at: new Date(start.getTime() + 40 * 60_000).toISOString(),
    status: overrides.status ?? "agendado",
    created_at: start.toISOString(),
  };
}

describe("parse dos filtros", () => {
  it("cai no padrão quando o valor da URL não existe no vocabulário", () => {
    expect(parseBookingPeriod("mês-que-vem")).toBe("7d");
    expect(parseBookingStatusFilter("sumido")).toBe("todos");
    expect(parseBookingView("kanban")).toBe("cards");
  });

  it("aceita os valores conhecidos", () => {
    expect(parseBookingPeriod("passados")).toBe("passados");
    expect(parseBookingStatusFilter("cancelado")).toBe("cancelado");
    expect(parseBookingView("lista")).toBe("lista");
  });
});

describe("bookingPeriodRange", () => {
  it("'hoje' é um único dia", () => {
    expect(bookingPeriodRange("hoje", "2026-08-19")).toEqual({
      from: "2026-08-19",
      to: "2026-08-19",
    });
  });

  it("os períodos futuros incluem hoje e são inclusivos na ponta final", () => {
    expect(bookingPeriodRange("7d", "2026-08-19")).toEqual({
      from: "2026-08-19",
      to: "2026-08-25",
    });
    expect(bookingPeriodRange("30d", "2026-08-19")).toEqual({
      from: "2026-08-19",
      to: "2026-09-17",
    });
  });

  it("'passados' termina hoje e atravessa a virada de mês", () => {
    expect(bookingPeriodRange("passados", "2026-03-05")).toEqual({
      from: "2026-02-04",
      to: "2026-03-05",
    });
  });
});

describe("filterBookings", () => {
  const bookings = [
    makeBooking({ date: "2026-08-19", time: "09:00", name: "Ana Souza" }),
    makeBooking({
      date: "2026-08-19",
      time: "10:00",
      name: "Mônica Reis",
      status: "cancelado",
      serviceId: "svc-2",
      phone: "5511911112222",
    }),
    makeBooking({ date: "2026-08-20", time: "11:00", name: "Beatriz Lima" }),
  ];

  it("sem filtros devolve tudo", () => {
    const result = filterBookings(bookings, { status: "todos", serviceId: "todos", query: "" });
    expect(result).toHaveLength(3);
  });

  it("combina status e serviço", () => {
    const result = filterBookings(bookings, {
      status: "cancelado",
      serviceId: "svc-2",
      query: "",
    });
    expect(result.map((b) => b.client_name)).toEqual(["Mônica Reis"]);
  });

  it("acha por nome ignorando acento e caixa", () => {
    const result = filterBookings(bookings, {
      status: "todos",
      serviceId: "todos",
      query: "monica",
    });
    expect(result.map((b) => b.client_name)).toEqual(["Mônica Reis"]);
  });

  it("acha por telefone digitado com máscara", () => {
    const result = filterBookings(bookings, {
      status: "todos",
      serviceId: "todos",
      query: "(11) 91111-2222",
    });
    expect(result.map((b) => b.client_name)).toEqual(["Mônica Reis"]);
  });

  it("não confunde dígitos do telefone com nome", () => {
    const result = filterBookings(bookings, {
      status: "todos",
      serviceId: "todos",
      query: "9999",
    });
    expect(result).toHaveLength(0);
  });
});

describe("groupBookingsByDay", () => {
  it("agrupa por data local preservando a ordem recebida", () => {
    const groups = groupBookingsByDay([
      makeBooking({ date: "2026-08-19", time: "09:00" }),
      makeBooking({ date: "2026-08-19", time: "14:00" }),
      makeBooking({ date: "2026-08-20", time: "08:00" }),
    ]);
    expect(groups.map((g) => g.date)).toEqual(["2026-08-19", "2026-08-20"]);
    expect(groups[0].bookings).toHaveLength(2);
  });

  it("22h no fuso do estúdio continua no mesmo dia, não no dia UTC seguinte", () => {
    // 2026-08-19 22:00 em São Paulo = 2026-08-20 01:00 UTC. Agrupar pelo
    // instante cru jogaria esse atendimento para o dia errado.
    const groups = groupBookingsByDay([makeBooking({ date: "2026-08-19", time: "22:00" })]);
    expect(groups[0].date).toBe("2026-08-19");
  });
});
