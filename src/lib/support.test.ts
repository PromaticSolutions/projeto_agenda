import { describe, expect, it } from "vitest";
import { hasUnread, relativeTime, statusAfterMessage, turnLabel } from "@/lib/support";

const base = {
  last_message_at: "2026-10-29T12:00:00.000Z",
  client_seen_at: null,
  support_seen_at: null,
};

describe("hasUnread", () => {
  it("a própria mensagem nunca acende o aviso", () => {
    expect(hasUnread({ ...base, last_message_by: "cliente" }, "cliente")).toBe(false);
    expect(hasUnread({ ...base, last_message_by: "suporte" }, "suporte")).toBe(false);
  });

  it("resposta do outro lado depois da última visita conta como nova", () => {
    const ticket = { ...base, last_message_by: "suporte" as const, client_seen_at: "2026-10-29T11:00:00.000Z" };
    expect(hasUnread(ticket, "cliente")).toBe(true);
    expect(hasUnread({ ...ticket, client_seen_at: "2026-10-29T12:00:00.000Z" }, "cliente")).toBe(false);
  });

  it("nunca aberto pelo suporte é novo para o suporte", () => {
    expect(hasUnread({ ...base, last_message_by: "cliente" }, "suporte")).toBe(true);
  });
});

describe("statusAfterMessage", () => {
  it("cliente escrevendo reabre o resolvido", () => {
    expect(statusAfterMessage("resolvido", "cliente")).toBe("aberto");
    expect(statusAfterMessage("em_andamento", "cliente")).toBe("em_andamento");
  });

  it("suporte respondendo tira do aberto, mas não reabre", () => {
    expect(statusAfterMessage("aberto", "suporte")).toBe("em_andamento");
    expect(statusAfterMessage("resolvido", "suporte")).toBe("resolvido");
  });
});

describe("turnLabel", () => {
  it("fala com cada lado do jeito dele", () => {
    const ticket = { status: "em_andamento" as const, last_message_by: "suporte" as const };
    expect(turnLabel(ticket, "cliente")).toBe("Respondido — sua vez");
    expect(turnLabel(ticket, "suporte")).toBe("Aguardando o cliente");
    expect(turnLabel({ ...ticket, status: "resolvido" }, "cliente")).toBeNull();
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-10-29T12:00:00.000Z");
  it("escala de minutos a dias", () => {
    expect(relativeTime("2026-10-29T11:59:40.000Z", now)).toBe("agora");
    expect(relativeTime("2026-10-29T11:55:00.000Z", now)).toBe("há 5 min");
    expect(relativeTime("2026-10-29T09:00:00.000Z", now)).toBe("há 3 h");
    expect(relativeTime("2026-10-28T10:00:00.000Z", now)).toBe("há 1 dia");
  });
});
