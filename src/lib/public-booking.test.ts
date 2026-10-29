import { describe, expect, it } from "vitest";
import {
  brandForeground,
  dayParts,
  dayPeriodOf,
  formatLongDate,
  googleCalendarUrl,
  icsContent,
  relativeSlotLabel,
} from "@/lib/public-booking";

describe("brandForeground", () => {
  it("usa branco sobre cor escura", () => {
    expect(brandForeground("#6d3ad4")).toBe("#ffffff");
    expect(brandForeground("#241238")).toBe("#ffffff");
  });

  it("usa texto escuro sobre cor clara, onde branco sumiria", () => {
    expect(brandForeground("#f5d90a")).toBe("#1c1424");
    expect(brandForeground("#ffffff")).toBe("#1c1424");
  });

  it("cai no branco quando a cor gravada não é um hex válido", () => {
    expect(brandForeground("roxo")).toBe("#ffffff");
  });
});

describe("rótulos de data", () => {
  it("quebra a data nos pedaços da pílula", () => {
    expect(dayParts("2026-11-11")).toEqual({ weekday: "qua", day: "11", month: "nov" });
  });

  it("escreve a data por extenso", () => {
    expect(formatLongDate("2026-11-11")).toBe("quarta-feira, 11 de novembro");
  });

  it("diz hoje e amanhã pelo fuso do estúdio", () => {
    // 29/10 às 23h em São Paulo ainda é dia 29 lá, embora já seja 30 em UTC.
    const now = new Date("2026-10-30T02:00:00Z");
    expect(relativeSlotLabel("2026-10-30T02:30:00Z", now)).toBe("hoje às 23:30");
    expect(relativeSlotLabel("2026-10-30T12:00:00Z", now)).toBe("amanhã às 09:00");
    expect(relativeSlotLabel("2026-11-04T12:00:00Z", now)).toBe("qua, 4 nov às 09:00");
  });

  it("agrupa o horário em manhã, tarde e noite no fuso do estúdio", () => {
    expect(dayPeriodOf("2026-11-11T14:59:00Z")).toBe("manha"); // 11:59
    expect(dayPeriodOf("2026-11-11T15:00:00Z")).toBe("tarde"); // 12:00
    expect(dayPeriodOf("2026-11-11T21:00:00Z")).toBe("noite"); // 18:00
  });
});

describe("adicionar à agenda", () => {
  const event = {
    title: "Manicure — Studio Bia",
    details: "Agendado pelo Timely",
    start: new Date("2026-11-11T12:00:00Z"),
    end: new Date("2026-11-11T13:00:00Z"),
  };

  it("monta o link do Google Agenda com início e fim em UTC", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.searchParams.get("dates")).toBe("20261111T120000Z/20261111T130000Z");
    expect(url.searchParams.get("text")).toBe("Manicure — Studio Bia");
  });

  it("gera um .ics válido, escapando vírgula e ponto e vírgula", () => {
    const ics = icsContent(
      { ...event, title: "Corte, escova; finalização" },
      "abc@timely",
      new Date("2026-11-01T00:00:00Z")
    );
    expect(ics).toContain("DTSTART:20261111T120000Z");
    expect(ics).toContain("SUMMARY:Corte\\, escova\\; finalização");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});
