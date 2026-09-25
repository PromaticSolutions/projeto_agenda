import { describe, expect, it } from "vitest";
import {
  MAX_MESSAGE_BODY,
  parseEvolutionMessage,
  phoneFromPersonalJid,
  phoneVariants,
} from "@/lib/whatsapp/inbound";

/**
 * Os corpos abaixo seguem o `prepareMessage` da Evolution 2.3.7. O que mais
 * importa aqui não é o caminho feliz: é o que NÃO pode virar mensagem na tela
 * (reação, apagar, status, canal) e a identidade da conversa — desde a 0021
 * grupo entra e número fora do cadastro também.
 */

const AGORA = new Date("2026-09-15T15:00:00.000Z");
const CLIENTE = "5511987654321@s.whatsapp.net";

function evento(overrides: Record<string, unknown> = {}, key: Record<string, unknown> = {}) {
  return {
    key: { id: "3EB0A1B2C3", remoteJid: CLIENTE, fromMe: false, ...key },
    pushName: "Ana",
    message: { conversation: "Oi, tem horário amanhã?" },
    messageType: "conversation",
    messageTimestamp: 1789484400,
    ...overrides,
  };
}

describe("parseEvolutionMessage", () => {
  it("entrega o conteúdo da mídia, sem envelope, para o download do webhook (0022)", () => {
    const imagem = { imageMessage: { mediaKey: "chave", directPath: "/v/t62/abc", mimetype: "image/jpeg" } };
    const parsed = parseEvolutionMessage(
      evento({ message: { viewOnceMessageV2: { message: imagem } }, messageType: "viewOnceMessageV2" }),
      AGORA
    );
    expect(parsed?.type).toBe("imagem");
    expect(parsed?.mediaContent).toEqual(imagem);
  });

  it("texto não carrega conteúdo de mídia", () => {
    expect(parseEvolutionMessage(evento(), AGORA)).not.toHaveProperty("mediaContent");
  });

  it("lê o texto que a cliente mandou", () => {
    expect(parseEvolutionMessage(evento(), AGORA)).toEqual({
      providerMessageId: "3EB0A1B2C3",
      fromMe: false,
      chatId: CLIENTE,
      chatPhone: "5511987654321",
      isGroup: false,
      chatName: "Ana",
      senderName: null,
      type: "texto",
      body: "Oi, tem horário amanhã?",
      sentAt: new Date(1789484400 * 1000).toISOString(),
    });
  });

  it("marca como enviada o que saiu do número do estúdio", () => {
    const parsed = parseEvolutionMessage(evento({}, { fromMe: true }), AGORA);
    expect(parsed?.fromMe).toBe(true);
    expect(parsed?.chatPhone).toBe("5511987654321");
    // `pushName` no que o dono mandou é o nome DELE: usá-lo batizaria a
    // conversa com o nome do próprio estúdio.
    expect(parsed?.chatName).toBeNull();
  });

  it("aceita texto estendido quando a conversão não aconteceu", () => {
    const parsed = parseEvolutionMessage(
      evento({ message: { extendedTextMessage: { text: "com link https://x.y" } } }),
      AGORA
    );
    expect(parsed).toMatchObject({ type: "texto", body: "com link https://x.y" });
  });

  it("guarda o tipo e a legenda da mídia, nunca o arquivo", () => {
    const foto = parseEvolutionMessage(
      evento({ message: { imageMessage: { caption: "a cor que eu quero", url: "https://mmg" } } }),
      AGORA
    );
    expect(foto).toMatchObject({ type: "imagem", body: "a cor que eu quero" });

    const audio = parseEvolutionMessage(
      evento({ message: { audioMessage: { seconds: 12, ptt: true } } }),
      AGORA
    );
    expect(audio).toMatchObject({ type: "audio", body: null });

    const doc = parseEvolutionMessage(
      evento({ message: { documentMessage: { fileName: "orcamento.pdf" } } }),
      AGORA
    );
    expect(doc).toMatchObject({ type: "documento", body: "orcamento.pdf" });
  });

  it("abre mensagem temporária e de visualização única", () => {
    const parsed = parseEvolutionMessage(
      evento({ message: { ephemeralMessage: { message: { conversation: "sumiu?" } } } }),
      AGORA
    );
    expect(parsed).toMatchObject({ type: "texto", body: "sumiu?" });
  });

  it("não transforma reação, apagar ou troca de chave em balão", () => {
    for (const message of [
      { reactionMessage: { text: "❤️" } },
      { protocolMessage: { type: 0 } },
      { senderKeyDistributionMessage: {}, messageContextInfo: {} },
    ]) {
      expect(parseEvolutionMessage(evento({ message }), AGORA)).toBeNull();
    }
  });

  it("mostra como 'outro' o tipo que a tela não sabe desenhar", () => {
    const parsed = parseEvolutionMessage(
      evento({ message: { pollCreationMessageV3: { name: "Qual dia?" } } }),
      AGORA
    );
    expect(parsed).toMatchObject({ type: "outro", body: null });
  });

  it("ignora status, lista de transmissão e canal, que não são conversa", () => {
    for (const remoteJid of ["status@broadcast", "120363144038483540@newsletter"]) {
      expect(parseEvolutionMessage(evento({}, { remoteJid }), AGORA)).toBeNull();
    }
  });

  it("grupo vira conversa, com quem falou no lugar do nome do contato (0021)", () => {
    const parsed = parseEvolutionMessage(
      evento({}, { remoteJid: "120363025246125888@g.us", participant: CLIENTE }),
      AGORA
    );
    expect(parsed).toMatchObject({
      chatId: "120363025246125888@g.us",
      chatPhone: null,
      isGroup: true,
      // O evento não traz o assunto do grupo; a tela rotula pelo id.
      chatName: null,
      senderName: "Ana",
    });
  });

  it("usa o número alternativo quando o contato vem por LID", () => {
    const semAlternativo = parseEvolutionMessage(
      evento({}, { remoteJid: "207584123456789@lid" }),
      AGORA
    );
    expect(semAlternativo).toBeNull();

    const comAlternativo = parseEvolutionMessage(
      evento({}, { remoteJid: "207584123456789@lid", remoteJidAlt: CLIENTE }),
      AGORA
    );
    expect(comAlternativo?.chatPhone).toBe("5511987654321");
    // Normalizado: o mesmo contato por LID ou por número cai numa conversa só.
    expect(comAlternativo?.chatId).toBe(CLIENTE);
  });

  it("recusa evento sem id, que não teria como ser deduplicado", () => {
    expect(parseEvolutionMessage(evento({}, { id: "" }), AGORA)).toBeNull();
    expect(parseEvolutionMessage({ message: { conversation: "x" } }, AGORA)).toBeNull();
    expect(parseEvolutionMessage(null, AGORA)).toBeNull();
  });

  it("cai na hora da chegada quando o relógio do aparelho é implausível", () => {
    const futuro = parseEvolutionMessage(evento({ messageTimestamp: 4102444800 }), AGORA);
    expect(futuro?.sentAt).toBe(AGORA.toISOString());
    const semHora = parseEvolutionMessage(evento({ messageTimestamp: undefined }), AGORA);
    expect(semHora?.sentAt).toBe(AGORA.toISOString());
  });

  it("corta texto no teto da coluna", () => {
    const longo = "a".repeat(MAX_MESSAGE_BODY + 50);
    const parsed = parseEvolutionMessage(evento({ message: { conversation: longo } }), AGORA);
    expect(parsed?.body).toHaveLength(MAX_MESSAGE_BODY);
  });
});

describe("phoneFromPersonalJid", () => {
  it("descarta o sufixo de aparelho", () => {
    expect(phoneFromPersonalJid("5511987654321:12@s.whatsapp.net")).toBe("5511987654321");
  });
});

describe("phoneVariants", () => {
  it("encontra o celular antigo sem o nono dígito, e vice-versa", () => {
    expect(phoneVariants("551187654321")).toEqual(["551187654321", "5511987654321"]);
    expect(phoneVariants("5511987654321")).toEqual(["5511987654321", "551187654321"]);
  });

  it("não inventa nono dígito em telefone fixo nem em número estrangeiro", () => {
    expect(phoneVariants("551133334444")).toEqual(["551133334444"]);
    expect(phoneVariants("14155552671")).toEqual(["14155552671"]);
  });
});
