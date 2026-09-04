import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Estes testes existem para travar os contratos da Evolution API 2.3.7 que
 * DIVERGEM do que se encontra em exemplo de versão antiga. Cada `it` abaixo
 * corresponde a uma diferença conferida no código-fonte da tag 2.3.7 — se
 * alguém "consertar" o adaptador copiando um exemplo da v1, um destes quebra.
 *
 * O que NÃO é testado aqui: se a Evolution real se comporta como o dublê. Isso
 * é o smoke test de scripts/whatsapp-smoke.mjs, que fala com a instância de
 * verdade.
 */

interface Call {
  url: string;
  method: string;
  body: unknown;
  apikey: string | undefined;
}

let calls: Call[] = [];
/** Fila de respostas, na ordem em que o adaptador as consumir. */
let queue: Array<{ status: number; body: unknown }> = [];

function enqueue(status: number, body: unknown) {
  queue.push({ status, body });
}

beforeEach(() => {
  vi.resetModules();
  calls = [];
  queue = [];
  process.env.EVOLUTION_API_URL = "http://gateway.test:8080";
  process.env.EVOLUTION_API_KEY = "chave-de-teste";
  process.env.EVOLUTION_INSTANCE_PREFIX = "promatic";

  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      apikey: headers.apikey,
    });
    const next = queue.shift() ?? { status: 200, body: {} };
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { "Content-Type": "application/json" },
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.EVOLUTION_API_URL;
  delete process.env.EVOLUTION_API_KEY;
  delete process.env.EVOLUTION_INSTANCE_PREFIX;
});

async function provider() {
  const { createEvolutionProvider } = await import("@/lib/whatsapp/evolution");
  return createEvolutionProvider();
}

describe("mapState", () => {
  it("traduz os estados da 2.3.7 para o enum do banco", async () => {
    const { mapState } = await import("@/lib/whatsapp/evolution");
    expect(mapState("open")).toBe("conectado");
    expect(mapState("connecting")).toBe("conectando");
    expect(mapState("close")).toBe("desconectado");
    // Ausência de estado é o estúdio que nunca tentou conectar, não erro.
    expect(mapState(null)).toBe("desconectado");
  });

  it("trata 'refused' como erro, não como desconectado", async () => {
    // `refused` é o QR estourando o limite de tentativas: a sessão não volta
    // sozinha. Chamar isso de desconectado faria a tela sugerir esperar
    // quando o certo é gerar código novo.
    const { mapState } = await import("@/lib/whatsapp/evolution");
    expect(mapState("refused")).toBe("erro");
  });
});

describe("sendText", () => {
  it("usa o corpo { number, text } da 2.3.7, não o textMessage da v1", async () => {
    enqueue(200, { key: { id: "MSG-1" } });
    const result = await (await provider()).sendText({
      instanceName: "promatic_estudio",
      toPhone: "5511934476935",
      body: "Olá!",
    });

    expect(calls[0].url).toBe(
      "http://gateway.test:8080/message/sendText/promatic_estudio"
    );
    expect(calls[0].method).toBe("POST");
    // O erro clássico ao copiar exemplo da v1: { number, textMessage: { text } }.
    expect(calls[0].body).toEqual({ number: "5511934476935", text: "Olá!" });
    expect(result.providerMessageId).toBe("MSG-1");
  });

  it("manda a chave no header apikey e nunca na URL", async () => {
    enqueue(200, {});
    await (await provider()).sendText({
      instanceName: "i",
      toPhone: "5511934476935",
      body: "x",
    });
    expect(calls[0].apikey).toBe("chave-de-teste");
    expect(calls[0].url).not.toContain("chave-de-teste");
  });
});

describe("status", () => {
  it("busca o número em fetchInstances, porque connectionState não o traz", async () => {
    // connectionState na 2.3.7 devolve SÓ { instance: { instanceName, state } }.
    enqueue(200, { instance: { instanceName: "promatic_e1", state: "open" } });
    enqueue(200, [{ name: "promatic_e1", ownerJid: "5511934476935@s.whatsapp.net" }]);

    const status = await (await provider()).status("promatic_e1");

    expect(status.state).toBe("conectado");
    expect(status.phone).toBe("5511934476935");
    expect(calls[1].url).toContain("/instance/fetchInstances?instanceName=promatic_e1");
  });

  it("não gasta requisição buscando número quando a sessão está fechada", async () => {
    enqueue(200, { instance: { instanceName: "promatic_e1", state: "close" } });
    const status = await (await provider()).status("promatic_e1");

    expect(status.state).toBe("desconectado");
    expect(status.phone).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it("trata 404 como estado inicial, não como erro", async () => {
    // Instância nunca criada. O disparador não pode reportar "erro" nisso,
    // senão todo estúdio sem WhatsApp apareceria com falha na tela.
    enqueue(404, { message: 'The "promatic_e1" instance does not exist' });
    const status = await (await provider()).status("promatic_e1");
    expect(status.state).toBe("desconectado");
    expect(status.error).toBeNull();
  });

  it("ignora linha de outra instância vinda de fetchInstances", async () => {
    // Proteção multi-tenant: se o gateway ignorar o filtro e devolver todas as
    // instâncias, um estúdio não pode acabar com o número de outro.
    enqueue(200, { instance: { state: "open" } });
    enqueue(200, [{ name: "promatic_OUTRO", ownerJid: "5511999999999@s.whatsapp.net" }]);

    const status = await (await provider()).status("promatic_e1");
    expect(status.state).toBe("conectado");
    expect(status.phone).toBeNull();
  });

  it("segue conectado quando fetchInstances falha", async () => {
    enqueue(200, { instance: { state: "open" } });
    enqueue(500, { message: "boom" });
    const status = await (await provider()).status("promatic_e1");
    // Saber o número é conveniência; não saber não fecha a sessão.
    expect(status.state).toBe("conectado");
    expect(status.phone).toBeNull();
  });
});

describe("connect", () => {
  it("remove o prefixo data: do QR (toDataURL devolve data URL completa)", async () => {
    enqueue(200, {
      base64: "data:image/png;base64,AAAB",
      pairingCode: "1234-5678",
      count: 1,
    });
    const pairing = await (await provider()).connect("promatic_e1");
    expect(pairing.qrCodeBase64).toBe("AAAB");
    expect(pairing.pairingCode).toBe("1234-5678");
  });

  it("devolve pareamento vazio quando a sessão já está aberta", async () => {
    // Com state 'open' a 2.3.7 responde { instance: {...} }, sem QR. Isso não
    // é erro — é "já está conectado", e a tela precisa distinguir os dois.
    enqueue(200, { instance: { instanceName: "promatic_e1", state: "open" } });
    const pairing = await (await provider()).connect("promatic_e1");
    expect(pairing.qrCodeBase64).toBeNull();
    expect(pairing.pairingCode).toBeNull();
  });
});

describe("idempotência das operações de ciclo de vida", () => {
  it("ensureInstance aceita 403 'already in use' como sucesso", async () => {
    enqueue(403, { message: 'This name "promatic_e1" is already in use.' });
    await expect((await provider()).ensureInstance("promatic_e1")).resolves.toBeUndefined();
    expect(calls[0].body).toMatchObject({
      instanceName: "promatic_e1",
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
    });
  });

  it("logout aceita o 400 'is not connected' da 2.3.7", async () => {
    // Desconectar duas vezes é operação normal na tela; a 2.3.7 devolve 400
    // (não 404) quando a sessão já está fechada.
    enqueue(400, { message: 'The "promatic_e1" instance is not connected' });
    await expect((await provider()).logout("promatic_e1")).resolves.toBeUndefined();
    expect(calls[0].method).toBe("DELETE");
  });

  it("deleteInstance aceita 404 — o alvo é 'não existir mais'", async () => {
    enqueue(404, { message: "does not exist" });
    await expect((await provider()).deleteInstance("promatic_e1")).resolves.toBeUndefined();
    expect(calls[0].url).toBe("http://gateway.test:8080/instance/delete/promatic_e1");
  });
});

describe("setWebhook", () => {
  it("aninha a configuração em `webhook` e manda o segredo em headers", async () => {
    const { WEBHOOK_SECRET_HEADER } = await import("@/lib/whatsapp/provider");
    enqueue(201, {});
    await (await provider()).setWebhook({
      instanceName: "promatic_e1",
      url: "https://app.exemplo.com/api/webhooks/evolution",
      secret: "s3gr3d0",
    });

    expect(calls[0].url).toBe("http://gateway.test:8080/webhook/set/promatic_e1");
    const body = calls[0].body as { webhook: Record<string, unknown> };
    // O schema da 2.3.7 exige o objeto `webhook` com enabled + url.
    expect(body.webhook.enabled).toBe(true);
    expect(body.webhook.url).toBe("https://app.exemplo.com/api/webhooks/evolution");
    expect((body.webhook.headers as Record<string, string>)[WEBHOOK_SECRET_HEADER]).toBe("s3gr3d0");
    // byEvents true faria a Evolution acrescentar /connection-update ao caminho.
    expect(body.webhook.byEvents).toBe(false);
    // Eventos são assinados em MAIÚSCULAS, mesmo chegando em minúsculas.
    expect(body.webhook.events).toContain("CONNECTION_UPDATE");
    expect(body.webhook.events).toContain("QRCODE_UPDATED");
    // Caixa de entrada fica fora: o produto só envia.
    expect(body.webhook.events).not.toContain("MESSAGES_UPSERT");
  });
});

describe("checkNumbers", () => {
  it("indexa o resultado pelo número consultado e pelo jid devolvido", async () => {
    // A Evolution normaliza o número (nono dígito) e pode devolver diferente
    // do consultado; indexar pelos dois evita um "não existe" falso.
    enqueue(200, [
      { exists: true, number: "5511934476935", jid: "5511934476935@s.whatsapp.net" },
      { exists: false, number: "5511000000000", jid: "5511000000000@s.whatsapp.net" },
    ]);
    const result = await (await provider()).checkNumbers("promatic_e1", [
      "5511934476935",
      "5511000000000",
    ]);
    expect(result.get("5511934476935")).toBe(true);
    expect(result.get("5511000000000")).toBe(false);
    expect(calls[0].body).toEqual({ numbers: ["5511934476935", "5511000000000"] });
  });

  it("não chama o gateway com lista vazia", async () => {
    const result = await (await provider()).checkNumbers("promatic_e1", []);
    expect(result.size).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe("erros", () => {
  it("marca 5xx como retentável e 4xx como definitivo", async () => {
    const { WhatsAppProviderError } = await import("@/lib/whatsapp/provider");
    const p = await provider();

    enqueue(503, { message: "indisponível" });
    await p
      .sendText({ instanceName: "i", toPhone: "5511934476935", body: "x" })
      .then(
        () => expect.unreachable("deveria falhar"),
        (err) => {
          expect(err).toBeInstanceOf(WhatsAppProviderError);
          expect(err.retryable).toBe(true);
        }
      );

    enqueue(400, { message: "número inválido" });
    await p
      .sendText({ instanceName: "i", toPhone: "5511934476935", body: "x" })
      .then(
        () => expect.unreachable("deveria falhar"),
        (err) => expect(err.retryable).toBe(false)
      );
  });

  it("não deixa endereço de infraestrutura chegar na mensagem da tela", async () => {
    const p = await provider();
    enqueue(500, { message: "connect ECONNREFUSED 203.0.113.10:8080" });
    await p
      .sendText({ instanceName: "i", toPhone: "5511934476935", body: "x" })
      .then(
        () => expect.unreachable("deveria falhar"),
        (err) => {
          // O detalhe técnico existe (vai para o log); o que a tela mostra não
          // pode carregar IP nem porta do gateway.
          expect(err.message).toContain("203.0.113.10");
          expect(err.userMessage).not.toContain("203.0.113.10");
          expect(err.userMessage).not.toContain("8080");
        }
      );
  });
});

describe("resolveWebhookTarget", () => {
  it("recusa localhost — quem chama é a VPS, não o navegador", async () => {
    process.env.EVOLUTION_WEBHOOK_SECRET = "s3gr3d0";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    const { resolveWebhookTarget } = await import("@/lib/whatsapp/provider");
    expect(resolveWebhookTarget()).toBeNull();
  });

  it("recusa quando não há segredo — webhook aberto marca conexão alheia", async () => {
    delete process.env.EVOLUTION_WEBHOOK_SECRET;
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.exemplo.com";
    const { resolveWebhookTarget } = await import("@/lib/whatsapp/provider");
    expect(resolveWebhookTarget()).toBeNull();
  });

  it("deriva a URL pública de NEXT_PUBLIC_SITE_URL", async () => {
    process.env.EVOLUTION_WEBHOOK_SECRET = "s3gr3d0";
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.exemplo.com/";
    const { resolveWebhookTarget } = await import("@/lib/whatsapp/provider");
    expect(resolveWebhookTarget()).toEqual({
      url: "https://app.exemplo.com/api/webhooks/evolution",
      secret: "s3gr3d0",
    });
  });
});

describe("instanceNameForStudio", () => {
  it("deriva do id do estúdio e usa o prefixo do ambiente", async () => {
    const { instanceNameForStudio } = await import("@/lib/whatsapp/provider");
    // Derivado, e não recebido do cliente: é o que amarra a sessão ao
    // inquilino (seção 6 do plano).
    expect(instanceNameForStudio("abc-123")).toBe("promatic_abc-123");
  });
});
