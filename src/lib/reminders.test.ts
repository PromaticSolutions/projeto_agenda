import { describe, expect, it } from "vitest";
import {
  REMINDER_PLAN_HORIZON_MINUTES,
  planReminders,
  reminderScheduledFor,
  renderReminderMessage,
  type PlannableBooking,
} from "@/lib/reminders";
import type { BookingStatus, ReminderSettings } from "@/lib/types";

const settings: ReminderSettings = {
  studio_id: "studio-1",
  enabled: true,
  lead_time_minutes: 60,
  message_template: "Olá {cliente}! Seu {servico} é em {data} às {hora}. — {salao}",
  include_link: false,
  link_url: null,
  updated_at: "2026-08-19T00:00:00.000Z",
};

/** 2026-08-19 14:00 em São Paulo (UTC-3). */
const startAt = new Date("2026-08-19T17:00:00.000Z");

function booking(overrides: Partial<PlannableBooking> = {}): PlannableBooking {
  return {
    id: "booking-1",
    studio_id: "studio-1",
    service_id: "svc-1",
    client_name: "Ana",
    client_phone: "5511987654321",
    start_at: startAt.toISOString(),
    status: "agendado" as BookingStatus,
    ...overrides,
  };
}

const serviceNames = new Map([["svc-1", "Design de sobrancelha"]]);

describe("renderReminderMessage", () => {
  it("substitui todos os marcadores no fuso do estúdio", () => {
    const body = renderReminderMessage(settings, {
      clientName: "Ana",
      serviceName: "Design de sobrancelha",
      studioName: "Bella Studio",
      startAt,
    });
    expect(body).toBe(
      "Olá Ana! Seu Design de sobrancelha é em 19/08/2026 às 14:00. — Bella Studio"
    );
  });

  it("deixa marcador desconhecido intacto em vez de apagar", () => {
    const body = renderReminderMessage(
      { ...settings, message_template: "Oi {cliente}, {inexistente}" },
      { clientName: "Ana", serviceName: "X", studioName: "Y", startAt }
    );
    expect(body).toBe("Oi Ana, {inexistente}");
  });

  it("põe o link em linha separada quando ligado", () => {
    const body = renderReminderMessage(
      { ...settings, include_link: true, link_url: "https://exemplo.com" },
      { clientName: "Ana", serviceName: "X", studioName: "Y", startAt }
    );
    expect(body.endsWith("\n\nhttps://exemplo.com")).toBe(true);
  });

  it("ignora o link quando a URL está vazia, mesmo com a opção ligada", () => {
    const body = renderReminderMessage(
      { ...settings, include_link: true, link_url: null },
      { clientName: "Ana", serviceName: "X", studioName: "Y", startAt }
    );
    expect(body.includes("\n\n")).toBe(false);
  });
});

describe("reminderScheduledFor", () => {
  it("subtrai a antecedência do início do atendimento", () => {
    expect(reminderScheduledFor(startAt, 60).toISOString()).toBe("2026-08-19T16:00:00.000Z");
    expect(reminderScheduledFor(startAt, 1440).toISOString()).toBe("2026-08-18T17:00:00.000Z");
  });
});

describe("planReminders", () => {
  const base = {
    studioName: "Bella Studio",
    serviceNameById: serviceNames,
    settings,
  };

  it("não planeja nada com o lembrete desligado", () => {
    const planned = planReminders({
      ...base,
      settings: { ...settings, enabled: false },
      now: new Date("2026-08-19T15:30:00.000Z"),
      bookings: [booking()],
    });
    expect(planned).toHaveLength(0);
  });

  it("planeja quando a hora de enviar cabe no horizonte", () => {
    // Envio às 16:00Z (1h antes); agora 15:30Z → dentro do horizonte de 60min.
    const planned = planReminders({
      ...base,
      now: new Date("2026-08-19T15:30:00.000Z"),
      bookings: [booking()],
    });
    expect(planned).toHaveLength(1);
    expect(planned[0].scheduled_for).toBe("2026-08-19T16:00:00.000Z");
    expect(planned[0].to_phone).toBe("5511987654321");
    expect(planned[0].body).toContain("Design de sobrancelha");
  });

  it("não planeja o que ainda está longe demais", () => {
    // Envio às 16:00Z, agora 14:00Z → faltam 120min, além do horizonte.
    const planned = planReminders({
      ...base,
      now: new Date("2026-08-19T14:00:00.000Z"),
      bookings: [booking()],
    });
    expect(planned).toHaveLength(0);
    expect(REMINDER_PLAN_HORIZON_MINUTES).toBe(60);
  });

  it("ignora agendamento que já começou", () => {
    const planned = planReminders({
      ...base,
      now: new Date("2026-08-19T17:30:00.000Z"),
      bookings: [booking()],
    });
    expect(planned).toHaveLength(0);
  });

  it.each<BookingStatus>(["cancelado", "finalizado"])("ignora status %s", (status) => {
    const planned = planReminders({
      ...base,
      now: new Date("2026-08-19T15:30:00.000Z"),
      bookings: [booking({ status })],
    });
    expect(planned).toHaveLength(0);
  });

  it("envia agora quando a antecedência já passou, em vez de descartar", () => {
    // Antecedência de 1 dia, mas o atendimento é daqui a 1h: o horário ideal
    // de envio ficou no passado.
    const now = new Date("2026-08-19T16:00:00.000Z");
    const planned = planReminders({
      ...base,
      settings: { ...settings, lead_time_minutes: 1440 },
      now,
      bookings: [booking()],
    });
    expect(planned).toHaveLength(1);
    expect(planned[0].scheduled_for).toBe(now.toISOString());
  });

  it("usa um texto neutro quando o serviço foi removido", () => {
    const planned = planReminders({
      ...base,
      now: new Date("2026-08-19T15:30:00.000Z"),
      bookings: [booking({ service_id: "svc-apagado" })],
      serviceNameById: new Map(),
    });
    expect(planned[0].body).toContain("seu atendimento");
  });
});
