import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WhatsAppConnection, WhatsAppConversation } from "@/lib/types";
import type { InboundWhatsAppMessage } from "@/lib/whatsapp/inbound";

/**
 * A importação é a única parte do produto que PUXA conversa do gateway. O que
 * este arquivo prova: ela não reimporta o que já está no banco (inclusive
 * quando o gateway usa a outra forma do celular), respeita o lote e diz quanto
 * falta — é disso que a tela depende para oferecer "Importar mais".
 */

const ESTUDIO = "11111111-1111-1111-1111-111111111111";
const INSTANCIA = "promatic_11111111-1111-1111-1111-111111111111";

const getConnection = vi.fn<() => Promise<WhatsAppConnection>>();
const listConversations = vi.fn<() => Promise<WhatsAppConversation[]>>();
const recordMessages =
  vi.fn<(studioId: string, messages: InboundWhatsAppMessage[]) => Promise<boolean>>();
const fetchChats = vi.fn<() => Promise<{ remoteJid: string; name: string | null }[]>>();
const fetchMessages = vi.fn<(input: { remoteJid: string }) => Promise<unknown[]>>();

vi.mock("@/lib/data/whatsapp", () => ({ getWhatsAppConnection: () => getConnection() }));
vi.mock("@/lib/data/conversations", () => ({
  listConversations: () => listConversations(),
  recordInboundMessages: (studioId: string, messages: InboundWhatsAppMessage[]) =>
    recordMessages(studioId, messages),
}));
vi.mock("@/lib/whatsapp/provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/whatsapp/provider")>()),
  getWhatsAppProvider: async () => ({ fetchChats, fetchMessages }),
}));

function conexao(overrides: Partial<WhatsAppConnection> = {}): WhatsAppConnection {
  return {
    studio_id: ESTUDIO,
    status: "conectado",
    instance_name: INSTANCIA,
    connected_phone: "5511998452351",
    last_error: null,
    last_connected_at: null,
    updated_at: "2026-09-22T12:00:00.000Z",
    ...overrides,
  };
}

/** Registro como a Evolution guarda: o mesmo formato do webhook. */
function registro(remoteJid: string, id: string, texto: string) {
  return {
    key: { id, remoteJid, fromMe: false },
    pushName: "Ana",
    message: { conversation: texto },
    messageTimestamp: 1789484400,
  };
}

function conversa(overrides: Partial<WhatsAppConversation>): WhatsAppConversation {
  return {
    studio_id: ESTUDIO,
    chat_id: "5511987654321@s.whatsapp.net",
    chat_phone: "5511987654321",
    is_group: false,
    client_id: null,
    display_name: "Ana",
    last_body: "oi",
    last_type: "texto",
    last_direction: "recebida",
    last_at: "2026-09-20T10:00:00.000Z",
    unread_count: 0,
    ...overrides,
  };
}

async function importar() {
  const { importConversationHistory } = await import("@/lib/data/conversationImport");
  return importConversationHistory(ESTUDIO);
}

beforeEach(() => {
  getConnection.mockReset();
  getConnection.mockResolvedValue(conexao());
  listConversations.mockReset();
  listConversations.mockResolvedValue([]);
  recordMessages.mockReset();
  recordMessages.mockResolvedValue(true);
  fetchChats.mockReset();
  fetchMessages.mockReset();
  fetchMessages.mockImplementation(async ({ remoteJid }) => [
    registro(remoteJid, `id-${remoteJid}`, "Oi, tem horário?"),
  ]);
});

describe("importConversationHistory", () => {
  it("traz as conversas do gateway e conta o que gravou", async () => {
    fetchChats.mockResolvedValue([
      { remoteJid: "5511987654321@s.whatsapp.net", name: "Ana" },
      { remoteJid: "120363025246125888@g.us", name: null },
    ]);

    const result = await importar();

    expect(result).toMatchObject({ ok: true, chats: 2, messages: 2, remaining: 0 });
    expect(recordMessages).toHaveBeenCalledTimes(2);
  });

  it("usa o nome da lista de conversas quando a mensagem guardada não tem", async () => {
    fetchChats.mockResolvedValue([{ remoteJid: "5511911112222@s.whatsapp.net", name: "Juliana" }]);
    fetchMessages.mockResolvedValue([
      { ...registro("5511911112222@s.whatsapp.net", "x1", "Vocês fazem noiva?"), pushName: null },
    ]);

    await importar();

    expect(recordMessages.mock.calls[0]![1][0]).toMatchObject({ chatName: "Juliana" });
  });

  it("não reimporta conversa que já está no banco", async () => {
    listConversations.mockResolvedValue([conversa({})]);
    fetchChats.mockResolvedValue([
      { remoteJid: "5511987654321@s.whatsapp.net", name: "Ana" },
      { remoteJid: "5511911112222@s.whatsapp.net", name: "Juliana" },
    ]);

    const result = await importar();

    expect(result).toMatchObject({ ok: true, chats: 1 });
    expect(fetchMessages).toHaveBeenCalledTimes(1);
    expect(fetchMessages.mock.calls[0]![0].remoteJid).toBe("5511911112222@s.whatsapp.net");
  });

  it("reconhece a conversa já importada mesmo sem o nono dígito no gateway", async () => {
    // O cadastro tem 5511987654321; o gateway lista 551187654321. Sem as duas
    // formas, a mesma conversa voltaria a ser importada a cada rodada.
    listConversations.mockResolvedValue([conversa({})]);
    fetchChats.mockResolvedValue([{ remoteJid: "551187654321@s.whatsapp.net", name: "Ana" }]);

    const result = await importar();

    expect(result).toMatchObject({ ok: true, chats: 0, remaining: 0 });
    expect(fetchMessages).not.toHaveBeenCalled();
  });

  it("importa em lotes e informa quantas faltam", async () => {
    fetchChats.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({
        remoteJid: `55119000000${String(i).padStart(2, "0")}@s.whatsapp.net`,
        name: null,
      }))
    );

    const result = await importar();

    expect(result).toMatchObject({ ok: true, chats: 15, remaining: 5 });
  });

  it("sem WhatsApp conectado, não fala com o gateway", async () => {
    getConnection.mockResolvedValue(conexao({ status: "desconectado" }));

    const result = await importar();

    expect(result.ok).toBe(false);
    expect(fetchChats).not.toHaveBeenCalled();
  });

  it("falha do gateway vira mensagem, não exceção na tela", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchChats.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const result = await importar();

    expect(result.ok).toBe(false);
    expect(recordMessages).not.toHaveBeenCalled();
  });

  it("conversa sem nenhuma mensagem legível não conta como importada", async () => {
    fetchChats.mockResolvedValue([{ remoteJid: "status@broadcast", name: null }]);
    fetchMessages.mockResolvedValue([registro("status@broadcast", "y1", "ignorar")]);

    const result = await importar();

    expect(result).toMatchObject({ ok: true, chats: 0, messages: 0 });
    expect(recordMessages).not.toHaveBeenCalled();
  });
});
