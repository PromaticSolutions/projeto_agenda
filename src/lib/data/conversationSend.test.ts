import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client, Studio, WhatsAppConversation } from "@/lib/types";
import type { SendResult } from "@/lib/data/whatsappSend";

/**
 * A resposta pela tela de Conversas reaproveita o envio manual inteiro. O que
 * este arquivo prova é a diferença: o destino sai de uma conversa que JÁ existe
 * no estúdio da sessão (ou de uma cliente do cadastro, quando a conversa está
 * começando), e nada que o navegador mande troca isso.
 */

const ESTUDIO_A = "11111111-1111-1111-1111-111111111111";
const CLIENTE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHAT_A = "5511987654321@s.whatsapp.net";
/** Número que conversa com o estúdio sem estar no cadastro (0021). */
const CHAT_DESCONHECIDO = "5511911112222@s.whatsapp.net";

interface ReplyRecord {
  studioId: string;
  chatId: string;
  chatPhone: string | null;
  clientId: string | null;
  body: string;
  providerMessageId: string | null;
}

const getMyStudio = vi.fn<() => Promise<Studio | null>>();
const getMyClientByPhone = vi.fn<(studioId: string, phone: string) => Promise<Client | null>>();
const getConversation =
  vi.fn<(studioId: string, chatId: string) => Promise<WhatsAppConversation | null>>();
const sendManual = vi.fn<(input: { phone: unknown; message: unknown }) => Promise<SendResult>>();
const recordSentReply = vi.fn<(input: ReplyRecord) => Promise<void>>();
type ImageFile = { mimeType: string; fileName: string; base64: string };
const downloadServiceImage =
  vi.fn<(studioId: string, attachmentId: string) => Promise<ImageFile | null>>();

vi.mock("@/lib/data/studios", () => ({ getMyStudio: () => getMyStudio() }));
vi.mock("@/lib/data/clients", () => ({
  getMyClientByPhone: (studioId: string, phone: string) => getMyClientByPhone(studioId, phone),
}));
vi.mock("@/lib/data/whatsappSend", () => ({
  sendManualWhatsAppMessage: (input: { phone: unknown; message: unknown }) => sendManual(input),
}));
vi.mock("@/lib/data/storage", () => ({
  downloadServiceImage: (studioId: string, attachmentId: string) =>
    downloadServiceImage(studioId, attachmentId),
}));
vi.mock("@/lib/data/conversations", () => ({
  recordSentReply: (input: ReplyRecord) => recordSentReply(input),
  getConversation: (studioId: string, chatId: string) => getConversation(studioId, chatId),
}));

function conversa(overrides: Partial<WhatsAppConversation> = {}): WhatsAppConversation {
  return {
    studio_id: ESTUDIO_A,
    chat_id: CHAT_A,
    chat_phone: "5511987654321",
    is_group: false,
    client_id: CLIENTE_A,
    display_name: "Ana Paula",
    last_body: "oi",
    last_type: "texto",
    last_direction: "recebida",
    last_at: "2026-09-20T12:00:00.000Z",
    unread_count: 0,
    ...overrides,
  };
}

function cliente(overrides: Partial<Client> = {}): Client {
  return {
    id: CLIENTE_A,
    studio_id: ESTUDIO_A,
    name: "Ana Paula",
    phone: "5511987654321",
    notes: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

async function responder(chatId: string, message: unknown) {
  const { sendConversationReply } = await import("@/lib/data/conversationSend");
  return sendConversationReply(chatId, message);
}

beforeEach(() => {
  getMyStudio.mockReset();
  getMyStudio.mockResolvedValue({ id: ESTUDIO_A } as Studio);
  getMyClientByPhone.mockReset();
  getMyClientByPhone.mockResolvedValue(null);
  getConversation.mockReset();
  getConversation.mockResolvedValue(conversa());
  sendManual.mockReset();
  sendManual.mockResolvedValue({ ok: true, to: "5511987654321", providerMessageId: "3EB0" });
  recordSentReply.mockReset();
  recordSentReply.mockResolvedValue();
  downloadServiceImage.mockReset();
  downloadServiceImage.mockResolvedValue({ mimeType: "image/jpeg", fileName: "volume.jpg", base64: "AAAA" });
});

describe("sendConversationReply", () => {
  it("envia para o telefone da conversa e grava a resposta nela", async () => {
    const result = await responder(CHAT_A, "  Pode sim, te espero!  ");

    expect(result.ok).toBe(true);
    expect(getConversation).toHaveBeenCalledWith(ESTUDIO_A, CHAT_A);
    expect(sendManual).toHaveBeenCalledWith({
      phone: "5511987654321",
      message: "  Pode sim, te espero!  ",
    });
    expect(recordSentReply).toHaveBeenCalledWith({
      studioId: ESTUDIO_A,
      chatId: CHAT_A,
      chatPhone: "5511987654321",
      clientId: CLIENTE_A,
      body: "Pode sim, te espero!",
      providerMessageId: "3EB0",
    });
  });

  it("responde quem não é cliente cadastrada (0021)", async () => {
    getConversation.mockResolvedValue(
      conversa({ chat_id: CHAT_DESCONHECIDO, chat_phone: "5511911112222", client_id: null })
    );
    const result = await responder(CHAT_DESCONHECIDO, "Oi! Fazemos sim");

    expect(result.ok).toBe(true);
    expect(sendManual).toHaveBeenCalledWith({
      phone: "5511911112222",
      message: "Oi! Fazemos sim",
    });
    expect(recordSentReply).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: null, chatPhone: "5511911112222" })
    );
  });

  it("começa conversa com cliente do cadastro que ainda não escreveu", async () => {
    getConversation.mockResolvedValue(null);
    getMyClientByPhone.mockResolvedValue(cliente());
    const result = await responder(CHAT_A, "oi");

    expect(result.ok).toBe(true);
    expect(recordSentReply).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: CLIENTE_A, chatId: CHAT_A })
    );
  });

  it("número sem conversa no estúdio e fora do cadastro não recebe nada", async () => {
    // É o que impede usar a URL da tela como disparador para um número
    // qualquer: sem conversa e sem cadastro, não há destino legítimo.
    getConversation.mockResolvedValue(null);
    getMyClientByPhone.mockResolvedValue(null);
    const result = await responder("5511999998888@s.whatsapp.net", "oi");

    expect(result).toMatchObject({ ok: false, code: "dados_invalidos" });
    expect(sendManual).not.toHaveBeenCalled();
    expect(recordSentReply).not.toHaveBeenCalled();
  });

  it("grupo é recusado com o motivo, sem tentar enviar", async () => {
    // O outbox só aceita telefone em dígitos (0010) — JID de grupo não cabe.
    getConversation.mockResolvedValue(
      conversa({ chat_id: "120363025246125888@g.us", chat_phone: null, is_group: true })
    );
    const result = await responder("120363025246125888@g.us", "oi");

    expect(result).toMatchObject({ ok: false, code: "dados_invalidos" });
    expect(sendManual).not.toHaveBeenCalled();
  });

  it("id que não é conversa nem chega ao banco", async () => {
    const result = await responder("../../outra-rota", "oi");
    expect(result.ok).toBe(false);
    expect(getMyStudio).not.toHaveBeenCalled();
    expect(getConversation).not.toHaveBeenCalled();
  });

  it("sem sessão de estúdio, recusa", async () => {
    getMyStudio.mockResolvedValue(null);
    const result = await responder(CHAT_A, "oi");
    expect(result).toMatchObject({ ok: false, code: "sem_estudio" });
    expect(sendManual).not.toHaveBeenCalled();
  });

  it("envio recusado não entra na conversa e devolve o motivo", async () => {
    sendManual.mockResolvedValue({
      ok: false,
      code: "desconectado",
      error: "WhatsApp desconectado.",
    });
    const result = await responder(CHAT_A, "oi");

    expect(result).toMatchObject({ ok: false, code: "desconectado" });
    expect(recordSentReply).not.toHaveBeenCalled();
  });

  it("mensagem que saiu continua 'enviada' mesmo se gravar a cópia falhar", async () => {
    // Dizer "erro" aqui faria o dono reenviar, e a cliente receberia duas vezes.
    recordSentReply.mockRejectedValue(new Error("banco fora"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await responder(CHAT_A, "oi");
    expect(result.ok).toBe(true);
  });
});

const FOTO_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

async function enviarFoto(chatId: string, attachmentId: unknown, caption: unknown) {
  const { sendConversationImage } = await import("@/lib/data/conversationSend");
  return sendConversationImage(chatId, attachmentId, caption);
}

describe("sendConversationImage", () => {
  it("lê a foto DENTRO do estúdio da sessão e envia para o telefone da conversa", async () => {
    const result = await enviarFoto(CHAT_A, FOTO_A, "  Olha o resultado  ");

    expect(result.ok).toBe(true);
    expect(downloadServiceImage).toHaveBeenCalledWith(ESTUDIO_A, FOTO_A);
    expect(sendManual).toHaveBeenCalledWith({
      phone: "5511987654321",
      message: "Olha o resultado",
      media: { mimeType: "image/jpeg", fileName: "volume.jpg", base64: "AAAA" },
    });
    expect(recordSentReply).toHaveBeenCalledWith(
      expect.objectContaining({ messageType: "imagem", body: "Olha o resultado", providerMessageId: "3EB0" })
    );
  });

  it("sem legenda, a mensagem gravada fica sem texto", async () => {
    await enviarFoto(CHAT_A, FOTO_A, "");
    expect(recordSentReply).toHaveBeenCalledWith(expect.objectContaining({ body: null }));
  });

  it("anexo de outro estúdio (ou que não é foto) não sai", async () => {
    // `downloadServiceImage` filtra por estúdio e por tipo; aqui ele não achou.
    downloadServiceImage.mockResolvedValue(null);
    const result = await enviarFoto(CHAT_A, FOTO_A, "");

    expect(result).toMatchObject({ ok: false, code: "dados_invalidos" });
    expect(sendManual).not.toHaveBeenCalled();
  });

  it("id que não é UUID nem chega ao Storage", async () => {
    const result = await enviarFoto(CHAT_A, "../outro-estudio/foto.jpg", "");
    expect(result.ok).toBe(false);
    expect(downloadServiceImage).not.toHaveBeenCalled();
  });

  it("vale a mesma regra de destino do texto: número sem conversa não recebe", async () => {
    getConversation.mockResolvedValue(null);
    const result = await enviarFoto("5511999998888@s.whatsapp.net", FOTO_A, "");
    expect(result.ok).toBe(false);
    expect(downloadServiceImage).not.toHaveBeenCalled();
    expect(sendManual).not.toHaveBeenCalled();
  });
});
