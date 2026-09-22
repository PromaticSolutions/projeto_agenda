import { describe, expect, it } from "vitest";
import {
  calendarDaysAgo,
  conversationPreview,
  formatConversationDay,
  formatConversationListTime,
  initialsOf,
  matchesConversationQuery,
} from "@/lib/conversations";

// 15/09/2026 é uma terça. 15:00 UTC = 12:00 em São Paulo.
const AGORA = new Date("2026-09-15T15:00:00.000Z");

describe("calendarDaysAgo", () => {
  it("conta dia de calendário no fuso de São Paulo, não horas", () => {
    // 02:30 UTC do dia 15 ainda é 23:30 do dia 14 em São Paulo.
    const noiteSP = new Date("2026-09-15T02:30:00.000Z");
    expect(calendarDaysAgo(new Date("2026-09-15T01:00:00.000Z"), noiteSP)).toBe(0);
    expect(calendarDaysAgo(new Date("2026-09-14T02:00:00.000Z"), noiteSP)).toBe(1);
  });
});

describe("formatConversationListTime", () => {
  it("hora hoje, 'Ontem', dia da semana na semana, data depois disso", () => {
    expect(formatConversationListTime(new Date("2026-09-15T11:05:00.000Z"), AGORA)).toBe("08:05");
    expect(formatConversationListTime(new Date("2026-09-14T20:00:00.000Z"), AGORA)).toBe("Ontem");
    expect(formatConversationListTime(new Date("2026-09-12T15:00:00.000Z"), AGORA)).toBe("sábado");
    expect(formatConversationListTime(new Date("2026-09-10T15:00:00.000Z"), AGORA)).toBe("quinta");
    expect(formatConversationListTime(new Date("2026-09-03T15:00:00.000Z"), AGORA)).toBe("03/09/26");
  });
});

describe("formatConversationDay", () => {
  it("escreve o dia por extenso, com ano só quando muda", () => {
    expect(formatConversationDay(new Date("2026-09-15T13:00:00.000Z"), AGORA)).toBe("Hoje");
    expect(formatConversationDay(new Date("2026-09-14T13:00:00.000Z"), AGORA)).toBe("Ontem");
    expect(formatConversationDay(new Date("2026-09-03T15:00:00.000Z"), AGORA)).toBe("3 de setembro");
    expect(formatConversationDay(new Date("2025-12-20T15:00:00.000Z"), AGORA)).toBe(
      "20 de dezembro de 2025"
    );
  });
});

describe("conversationPreview", () => {
  it("mostra o texto, ou o tipo da mídia sem legenda", () => {
    expect(conversationPreview("texto", "oi")).toBe("oi");
    expect(conversationPreview("imagem", "essa cor")).toBe("essa cor");
    expect(conversationPreview("audio", null)).toBe("Áudio");
  });
});

describe("initialsOf", () => {
  it("usa primeiro e último nome", () => {
    expect(initialsOf("Ana Paula Ferreira")).toBe("AF");
    expect(initialsOf("  Juliana ")).toBe("J");
    expect(initialsOf("")).toBe("?");
  });
});

describe("matchesConversationQuery", () => {
  it("ignora acento e caixa no nome", () => {
    expect(matchesConversationQuery("jose", "José Antônio", "5511900000000")).toBe(true);
    expect(matchesConversationQuery("ANTÔNIO", "José Antonio", "5511900000000")).toBe(true);
  });

  it("acha pelo trecho do telefone digitado com máscara", () => {
    expect(matchesConversationQuery("(11) 98765", "Ana", "5511987654321")).toBe(true);
    expect(matchesConversationQuery("9", "Ana", "5511987654321")).toBe(false);
  });
});
