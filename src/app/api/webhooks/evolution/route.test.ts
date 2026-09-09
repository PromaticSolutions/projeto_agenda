import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WhatsAppConnection } from "@/lib/types";

/**
 * O receptor do webhook é uma superfície pública: qualquer um na internet
 * consegue fazer uma requisição para ela. Estes testes cobrem justamente o que
 * dá errado nesse cenário — evento sem segredo, evento de instância que não é
 * nossa, e evento que rebaixaria o estado de uma sessão que está de pé.
 */

const SEGREDO = "segredo-de-teste";

const findConnection = vi.fn<(instanceName: string) => Promise<WhatsAppConnection | null>>();
// A assinatura é declarada no genérico (e não com parâmetros nomeados) para
// que `mock.calls[0]![1]` seja tipado: os testes leem o studio_id e o patch.
const saveConnection = vi.fn<
  (studioId: string, patch: Record<string, unknown>) => Promise<WhatsAppConnection>
>();

vi.mock("@/lib/data/whatsapp", () => ({
  findWhatsAppConnectionByInstanceName: (name: string) => findConnection(name),
  saveWhatsAppConnection: (studioId: string, patch: Record<string, unknown>) =>
    saveConnection(studioId, patch),
}));

// A conexão da plataforma é linha única em outra tabela (0017). O receptor
// precisa reconhecê-la pelo nome da instância; sem isso, o evento dela caía no
// caminho de "instância desconhecida".
const readPlatform = vi.fn<() => Promise<{ status: string; connected_phone: string | null }>>();
const savePlatform = vi.fn<(patch: Record<string, unknown>) => Promise<unknown>>();

vi.mock("@/lib/data/platform-whatsapp", () => ({
  getPlatformWhatsApp: () => readPlatform(),
  savePlatformWhatsApp: (patch: Record<string, unknown>) => savePlatform(patch),
}));

function connectionOf(overrides: Partial<WhatsAppConnection> = {}): WhatsAppConnection {
  return {
    studio_id: "estudio-A",
    status: "conectando",
    instance_name: "promatic_estudio-A",
    connected_phone: null,
    last_error: null,
    last_connected_at: null,
    updated_at: "2026-09-04T00:00:00.000Z",
    ...overrides,
  };
}

async function post(body: unknown, headers: Record<string, string> = {}) {
  const { POST } = await import("@/app/api/webhooks/evolution/route");
  const { WEBHOOK_SECRET_HEADER } = await import("@/lib/whatsapp/provider");
  const request = new Request("https://app.exemplo.com/api/webhooks/evolution", {
    method: "POST",
    headers: { "Content-Type": "application/json", [WEBHOOK_SECRET_HEADER]: SEGREDO, ...headers },
    body: JSON.stringify(body),
  });
  // O handler usa apenas headers/text() do Request; NextRequest é compatível.
  return POST(request as never);
}

beforeEach(() => {
  vi.resetModules();
  findConnection.mockReset();
  saveConnection.mockReset();
  saveConnection.mockResolvedValue({} as WhatsAppConnection);
  readPlatform.mockReset();
  readPlatform.mockResolvedValue({ status: "conectando", connected_phone: null });
  savePlatform.mockReset();
  savePlatform.mockResolvedValue({});
  process.env.EVOLUTION_WEBHOOK_SECRET = SEGREDO;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://projeto.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-de-teste";
});

afterEach(() => {
  delete process.env.EVOLUTION_WEBHOOK_SECRET;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("autenticação", () => {
  it("devolve 404 sem o segredo, sem revelar que a rota existe", async () => {
    const { WEBHOOK_SECRET_HEADER } = await import("@/lib/whatsapp/provider");
    const response = await post(
      { event: "connection.update", instance: "promatic_estudio-A", data: { state: "open" } },
      { [WEBHOOK_SECRET_HEADER]: "" }
    );
    expect(response.status).toBe(404);
    expect(saveConnection).not.toHaveBeenCalled();
  });

  it("devolve 404 com segredo errado", async () => {
    const response = await post(
      { event: "connection.update", instance: "promatic_estudio-A", data: { state: "open" } },
      { "x-timely-webhook-secret": "chute" }
    );
    expect(response.status).toBe(404);
    expect(saveConnection).not.toHaveBeenCalled();
  });

  it("fica fechada quando o ambiente não define segredo nenhum", async () => {
    delete process.env.EVOLUTION_WEBHOOK_SECRET;
    vi.resetModules();
    const response = await post({
      event: "connection.update",
      instance: "promatic_estudio-A",
      data: { state: "open" },
    });
    expect(response.status).toBe(404);
  });
});

describe("multi-tenant", () => {
  it("ignora evento de instância que não está no nosso banco", async () => {
    // Gateway compartilhado, ou conexão já excluída. Nada a atualizar — e
    // responder 200 evita o laço de retentativa da Evolution.
    findConnection.mockResolvedValue(null);
    const response = await post({
      event: "connection.update",
      instance: "instancia-de-outro-sistema",
      data: { state: "open", wuid: "5511999999999@s.whatsapp.net" },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, handled: false });
    expect(saveConnection).not.toHaveBeenCalled();
  });

  it("grava sempre no estúdio dono da instância, nunca em outro", async () => {
    // O studio_id sai do BANCO, a partir do nome da instância — nada no corpo
    // do evento escolhe o inquilino. Um evento forjado apontando para outro
    // estúdio não tem por onde fazê-lo.
    findConnection.mockResolvedValue(connectionOf({ studio_id: "estudio-A" }));
    await post({
      event: "connection.update",
      instance: "promatic_estudio-A",
      data: { state: "open", wuid: "5511934476935@s.whatsapp.net", studio_id: "estudio-B" },
    });
    expect(saveConnection).toHaveBeenCalledTimes(1);
    expect(saveConnection.mock.calls[0]![0]).toBe("estudio-A");
  });
});

describe("instância da plataforma", () => {
  const INSTANCIA = "promatic_plataforma";

  it("grava em platform_whatsapp, e não na tabela dos estúdios", async () => {
    const response = await post({
      event: "connection.update",
      instance: INSTANCIA,
      data: { state: "open", wuid: "5511934476935@s.whatsapp.net" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, handled: true });
    expect(saveConnection).not.toHaveBeenCalled();
    expect(findConnection).not.toHaveBeenCalled();
    expect(savePlatform).toHaveBeenCalledTimes(1);
    expect(savePlatform.mock.calls[0]![0]).toMatchObject({
      status: "conectado",
      connected_phone: "5511934476935",
    });
  });

  it("derruba o estado quando a sessão da plataforma some do celular", async () => {
    readPlatform.mockResolvedValue({ status: "conectado", connected_phone: "5511934476935" });
    await post({ event: "logout.instance", instance: INSTANCIA, data: {} });

    expect(savePlatform.mock.calls[0]![0]).toMatchObject({
      status: "desconectado",
      connected_phone: null,
    });
  });

  it("QR novo não rebaixa uma sessão da plataforma já aberta", async () => {
    // Evento atrasado depois do pareamento: dizer "conectando" aqui faria o
    // aviso de lead parar de ser enfileirado por uma conexão que está de pé.
    readPlatform.mockResolvedValue({ status: "conectado", connected_phone: "5511934476935" });
    const response = await post({ event: "qrcode.updated", instance: INSTANCIA, data: {} });

    await expect(response.json()).resolves.toMatchObject({ handled: false });
    expect(savePlatform).not.toHaveBeenCalled();
  });
});

describe("connection.update", () => {
  it("marca conectado e extrai o número de wuid", async () => {
    findConnection.mockResolvedValue(connectionOf());
    await post({
      event: "connection.update",
      instance: "promatic_estudio-A",
      data: { state: "open", wuid: "5511934476935@s.whatsapp.net" },
    });
    const patch = saveConnection.mock.calls[0]![1];
    expect(patch.status).toBe("conectado");
    expect(patch.connected_phone).toBe("5511934476935");
    expect(patch.last_connected_at).toBeTypeOf("string");
  });

  it("descarta wuid malformado em vez de estourar a check constraint", async () => {
    // `to_phone`/`connected_phone` exigem ^\d{10,15}$. Um wuid estranho
    // gravado direto viraria erro de banco — e 500 em laço na Evolution.
    findConnection.mockResolvedValue(connectionOf({ connected_phone: null }));
    await post({
      event: "connection.update",
      instance: "promatic_estudio-A",
      data: { state: "open", wuid: "@s.whatsapp.net" },
    });
    const patch = saveConnection.mock.calls[0]![1];
    expect(patch.status).toBe("conectado");
    expect(patch.connected_phone).toBeNull();
  });

  it("limpa o número quando a sessão fecha", async () => {
    findConnection.mockResolvedValue(connectionOf({ status: "conectado" }));
    await post({
      event: "connection.update",
      instance: "promatic_estudio-A",
      data: { state: "close" },
    });
    const patch = saveConnection.mock.calls[0]![1];
    expect(patch.status).toBe("desconectado");
    expect(patch.connected_phone).toBeNull();
  });
});

describe("qrcode.updated", () => {
  it("firma 'conectando' quando o pareamento está em aberto", async () => {
    findConnection.mockResolvedValue(connectionOf({ status: "desconectado" }));
    await post({
      event: "qrcode.updated",
      instance: "promatic_estudio-A",
      data: { qrcode: { code: "abc" } },
    });
    expect((saveConnection.mock.calls[0]![1]).status).toBe("conectando");
  });

  it("NÃO rebaixa uma sessão já conectada", async () => {
    // QR atrasado chegando depois do pareamento não pode desligar o envio de
    // um WhatsApp que está funcionando.
    findConnection.mockResolvedValue(connectionOf({ status: "conectado" }));
    const response = await post({
      event: "qrcode.updated",
      instance: "promatic_estudio-A",
      data: {},
    });
    expect(response.status).toBe(200);
    expect(saveConnection).not.toHaveBeenCalled();
  });
});

describe("fim de sessão", () => {
  it("logout.instance desconecta — é como o sistema sabe que o dono desvinculou o aparelho", async () => {
    findConnection.mockResolvedValue(connectionOf({ status: "conectado" }));
    await post({ event: "logout.instance", instance: "promatic_estudio-A", data: {} });
    const patch = saveConnection.mock.calls[0]![1];
    expect(patch.status).toBe("desconectado");
    expect(patch.connected_phone).toBeNull();
  });
});

describe("eventos fora de escopo", () => {
  it("responde 200 a messages.upsert sem guardar a conversa", async () => {
    // O produto só envia. Guardar mensagem de cliente traria dado pessoal de
    // terceiro para a base sem ninguém ter pedido.
    findConnection.mockResolvedValue(connectionOf());
    const response = await post({
      event: "messages.upsert",
      instance: "promatic_estudio-A",
      data: { key: { id: "X" }, message: { conversation: "oi" } },
    });
    expect(response.status).toBe(200);
    expect(saveConnection).not.toHaveBeenCalled();
  });

  it("responde 200 a evento desconhecido em vez de 4xx", async () => {
    // 4xx faria a Evolution repetir algo que nunca vamos usar.
    findConnection.mockResolvedValue(connectionOf());
    const response = await post({ event: "chats.upsert", instance: "promatic_estudio-A", data: {} });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ handled: false });
  });
});

describe("corpo inválido", () => {
  it("recusa evento sem event/instance", async () => {
    const response = await post({ data: { state: "open" } });
    expect(response.status).toBe(400);
    expect(findConnection).not.toHaveBeenCalled();
  });
});
