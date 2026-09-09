import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  MessageOutbox,
  PlatformWhatsAppRow,
  WhatsAppConnection,
} from "@/lib/test/dispatch-fixtures";

/**
 * A etapa de ENVIO do disparador.
 *
 * Dois comportamentos que só se enxergam aqui, e que nenhum teste de unidade
 * das peças isoladas pegaria:
 *
 *  - o resgate do que ficou preso em "enviando" precisa rodar ANTES da
 *    reivindicação, senão a mensagem resgatada só sairia na rodada seguinte;
 *  - mensagem sem `studio_id` é da plataforma (0017) e tem que sair pela
 *    instância da plataforma. Sair pela instância de um inquilino seria usar o
 *    WhatsApp de um cliente para tráfego que não é dele.
 */

const claimDueMessages = vi.fn<(limit: number) => Promise<MessageOutbox[]>>();
const requeueStuckMessages = vi.fn<() => Promise<number>>();
const markMessageSent = vi.fn<(id: string, providerId: string | null) => Promise<void>>();
const releaseMessage = vi.fn<(m: unknown, reason: string) => Promise<void>>();
const markMessageAttemptFailed = vi.fn<() => Promise<"pendente" | "falhou">>();
const cancelMessage = vi.fn<() => Promise<void>>();

/** Ordem real das chamadas, para provar que o resgate vem antes do claim. */
const ordem: string[] = [];

vi.mock("@/lib/data/outbox", () => ({
  STALE_AFTER_MINUTES: 120,
  MAX_SEND_ATTEMPTS: 4,
  cancelMessage: () => {
    ordem.push("cancel");
    return cancelMessage();
  },
  cancelRemindersForCanceledBookings: vi.fn(async () => 0),
  claimDueMessages: (limit: number) => {
    ordem.push("claim");
    return claimDueMessages(limit);
  },
  enqueueReminders: vi.fn(async () => 0),
  markMessageAttemptFailed: () => markMessageAttemptFailed(),
  markMessageSent: (id: string, providerId: string | null) => markMessageSent(id, providerId),
  releaseMessage: (m: unknown, reason: string) => releaseMessage(m, reason),
  requeueStuckMessages: () => {
    ordem.push("requeue");
    return requeueStuckMessages();
  },
}));

const saveWhatsAppConnection = vi.fn<
  (studioId: string, patch: Partial<WhatsAppConnection>) => Promise<WhatsAppConnection>
>();
const savePlatformWhatsApp = vi.fn<
  (patch: Partial<PlatformWhatsAppRow>) => Promise<PlatformWhatsAppRow>
>();

vi.mock("@/lib/data/whatsapp", () => ({
  saveWhatsAppConnection: (studioId: string, patch: Partial<WhatsAppConnection>) =>
    saveWhatsAppConnection(studioId, patch),
}));
vi.mock("@/lib/data/platform-whatsapp", () => ({
  savePlatformWhatsApp: (patch: Partial<PlatformWhatsAppRow>) => savePlatformWhatsApp(patch),
}));

const sendText = vi.fn<
  (input: { instanceName: string; toPhone: string; body: string }) => Promise<{
    providerMessageId: string | null;
  }>
>();
const status = vi.fn<(instanceName: string) => Promise<{ state: string; phone: string | null }>>();

function provider() {
  return {
    name: "dublê",
    ensureInstance: vi.fn(),
    connect: vi.fn(),
    status,
    logout: vi.fn(),
    deleteInstance: vi.fn(),
    setWebhook: vi.fn(),
    checkNumbers: vi.fn(),
    sendText,
  } as never;
}

function message(overrides: Partial<MessageOutbox> = {}): MessageOutbox {
  return {
    id: "msg-1",
    studio_id: null,
    booking_id: null,
    kind: "lead",
    to_phone: "5511934476935",
    body: "NOVO LEAD",
    scheduled_for: new Date().toISOString(),
    status: "enviando",
    attempts: 1,
    last_error: null,
    provider_message_id: null,
    sent_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as MessageOutbox;
}

beforeEach(() => {
  ordem.length = 0;
  vi.clearAllMocks();
  requeueStuckMessages.mockResolvedValue(0);
  claimDueMessages.mockResolvedValue([]);
  markMessageSent.mockResolvedValue(undefined);
  releaseMessage.mockResolvedValue(undefined);
  sendText.mockResolvedValue({ providerMessageId: "wamid.1" });
  status.mockResolvedValue({ state: "conectado", phone: "5511999999999" });
  saveWhatsAppConnection.mockImplementation(async (studioId, patch) => ({
    studio_id: studioId,
    instance_name: `promatic_${studioId}`,
    status: "conectado",
    connected_phone: null,
    last_error: null,
    last_connected_at: null,
    updated_at: new Date().toISOString(),
    ...patch,
  }) as WhatsAppConnection);
  savePlatformWhatsApp.mockImplementation(async (patch) => ({
    id: true,
    status: "conectado",
    instance_name: "promatic_plataforma",
    connected_phone: null,
    notify_phone: "5511934476935",
    last_error: null,
    last_connected_at: null,
    updated_at: new Date().toISOString(),
    ...patch,
  }) as PlatformWhatsAppRow);
});

describe("resgate do que ficou preso", () => {
  it("devolve as abandonadas à fila ANTES de reivindicar o lote", async () => {
    const { sendDueMessages } = await import("@/lib/data/dispatch");
    requeueStuckMessages.mockResolvedValue(2);

    const report = await sendDueMessages({ provider: provider() });

    // A ordem é o teste: invertida, a mensagem resgatada esperaria a rodada
    // seguinte — e o cron pode rodar de cinco em cinco minutos.
    expect(ordem).toEqual(["requeue", "claim"]);
    expect(report.reenfileiradas).toBe(2);
  });

  it("informa o resgate mesmo quando não há nada para enviar", async () => {
    const { sendDueMessages } = await import("@/lib/data/dispatch");
    requeueStuckMessages.mockResolvedValue(3);

    const report = await sendDueMessages({ provider: provider() });
    expect(report).toMatchObject({ reivindicadas: 0, reenfileiradas: 3 });
  });
});

describe("mensagem da plataforma (aviso de lead)", () => {
  it("sai pela instância da plataforma, não pela de um estúdio", async () => {
    const { sendDueMessages } = await import("@/lib/data/dispatch");
    claimDueMessages.mockResolvedValue([message()]);

    const report = await sendDueMessages({ provider: provider() });

    expect(report.enviadas).toBe(1);
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText.mock.calls[0]![0].instanceName).toBe("promatic_plataforma");
    // Nenhum estúdio foi sincronizado: não havia mensagem de inquilino no lote.
    expect(saveWhatsAppConnection).not.toHaveBeenCalled();
  });

  it("adia sem gastar tentativa quando a plataforma está desconectada", async () => {
    const { sendDueMessages } = await import("@/lib/data/dispatch");
    claimDueMessages.mockResolvedValue([message()]);
    status.mockResolvedValue({ state: "desconectado", phone: null });

    const report = await sendDueMessages({ provider: provider() });

    expect(report).toMatchObject({ enviadas: 0, adiadas: 1 });
    expect(sendText).not.toHaveBeenCalled();
    expect(releaseMessage.mock.calls[0]![1]).toContain("plataforma");
  });

  it("não consulta o gateway da plataforma quando o lote só tem estúdio", async () => {
    // Uma ida ao gateway por rodada de cron, para todo mundo, por um recurso
    // que a maioria das instalações não usa.
    const { sendDueMessages } = await import("@/lib/data/dispatch");
    claimDueMessages.mockResolvedValue([
      message({ id: "msg-2", studio_id: "estudio-A", kind: "lembrete" }),
    ]);

    await sendDueMessages({ provider: provider() });

    expect(savePlatformWhatsApp).not.toHaveBeenCalled();
    expect(sendText.mock.calls[0]![0].instanceName).toBe("promatic_estudio-A");
  });
});
