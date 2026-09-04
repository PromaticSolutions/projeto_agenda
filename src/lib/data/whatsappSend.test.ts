import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Studio, WhatsAppConnection } from "@/lib/types";

/**
 * Regras do envio manual.
 *
 * O teste que mais importa aqui é o de propriedade: a seção 36 do plano pede
 * "cliente A não consegue enviar pelo WhatsApp de B", e a garantia não é uma
 * checagem que alguém pode esquecer de escrever — é o fato de NÃO EXISTIR
 * parâmetro que escolha o inquilino. Os casos abaixo tentam forçar isso pelo
 * corpo da requisição e verificam que não passa.
 */

const ESTUDIO_A = "11111111-1111-1111-1111-111111111111";
const ESTUDIO_B = "22222222-2222-2222-2222-222222222222";

const getMyStudio = vi.fn<() => Promise<Studio | null>>();
const syncWhatsAppConnection = vi.fn<() => Promise<WhatsAppConnection>>();
const countRecentManualSends = vi.fn<() => Promise<number>>();
// As assinaturas ficam no genérico (e não com parâmetros nomeados) para que
// `mock.calls[0]![0]` seja tipado: os testes inspecionam a instância usada, o
// telefone normalizado e o que foi gravado no histórico.
interface ManualRecord {
  studioId: string;
  outcome: string;
  error?: string | null;
}
const recordManualMessage = vi.fn<(input: ManualRecord) => Promise<ManualRecord>>();
const sendText = vi.fn<
  (input: { instanceName: string; toPhone: string; body: string }) => Promise<{
    providerMessageId: string | null;
  }>
>();
const checkNumbers = vi.fn<
  (instanceName: string, numbers: string[]) => Promise<Map<string, boolean>>
>();

vi.mock("@/lib/data/studios", () => ({ getMyStudio: () => getMyStudio() }));
vi.mock("@/lib/data/dispatch", () => ({
  syncWhatsAppConnection: () => syncWhatsAppConnection(),
}));
vi.mock("@/lib/data/outbox", () => ({
  MANUAL_SEND_LIMIT: 20,
  MANUAL_SEND_WINDOW_MINUTES: 10,
  countRecentManualSends: () => countRecentManualSends(),
  recordManualMessage: (input: ManualRecord) => recordManualMessage(input),
}));
vi.mock("@/lib/whatsapp/provider", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/whatsapp/provider")>();
  return {
    ...original,
    getWhatsAppProvider: async () => ({
      name: "dublê",
      ensureInstance: vi.fn(),
      connect: vi.fn(),
      status: vi.fn(),
      logout: vi.fn(),
      deleteInstance: vi.fn(),
      setWebhook: vi.fn(),
      checkNumbers,
      sendText,
    }),
  };
});

function studio(id: string): Studio {
  return { id, owner_id: `owner-${id}`, name: "Estúdio", slug: "estudio" } as Studio;
}

function connection(overrides: Partial<WhatsAppConnection> = {}): WhatsAppConnection {
  return {
    studio_id: ESTUDIO_A,
    status: "conectado",
    instance_name: `promatic_${ESTUDIO_A}`,
    connected_phone: "5511934476935",
    last_error: null,
    last_connected_at: null,
    updated_at: "2026-09-04T00:00:00.000Z",
    ...overrides,
  };
}

async function send(input: Record<string, unknown>) {
  const { sendManualWhatsAppMessage } = await import("@/lib/data/whatsappSend");
  return sendManualWhatsAppMessage(input as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://projeto.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-de-teste";
  process.env.EVOLUTION_API_URL = "http://gateway.test:8080";
  process.env.EVOLUTION_API_KEY = "chave";
  getMyStudio.mockResolvedValue(studio(ESTUDIO_A));
  syncWhatsAppConnection.mockResolvedValue(connection());
  countRecentManualSends.mockResolvedValue(0);
  checkNumbers.mockResolvedValue(new Map());
  sendText.mockResolvedValue({ providerMessageId: "MSG-1" });
  recordManualMessage.mockImplementation(async (input) => input);
});

describe("propriedade (multi-tenant)", () => {
  it("envia pela instância do estúdio da SESSÃO, ignorando o que vem no corpo", async () => {
    const result = await send({
      phone: "11934476935",
      message: "olá",
      // Tentativas de apontar para outro inquilino:
      studioId: ESTUDIO_B,
      studio_id: ESTUDIO_B,
      instanceId: `promatic_${ESTUDIO_B}`,
      instanceName: `promatic_${ESTUDIO_B}`,
    });

    expect(result.ok).toBe(true);
    expect(sendText).toHaveBeenCalledTimes(1);
    const arg = sendText.mock.calls[0]![0];
    // A instância é a do estúdio A — o corpo não teve efeito nenhum.
    expect(arg.instanceName).toBe(`promatic_${ESTUDIO_A}`);
    expect(arg.instanceName).not.toContain(ESTUDIO_B);
  });

  it("grava o histórico no estúdio da sessão", async () => {
    await send({ phone: "11934476935", message: "olá", studioId: ESTUDIO_B });
    expect(recordManualMessage).toHaveBeenCalledTimes(1);
    expect(recordManualMessage.mock.calls[0]![0].studioId).toBe(ESTUDIO_A);
  });

  it("recusa sem sessão, antes de tocar no gateway", async () => {
    getMyStudio.mockResolvedValue(null);
    const result = await send({ phone: "11934476935", message: "olá" });
    expect(result).toMatchObject({ ok: false, code: "sem_estudio" });
    expect(sendText).not.toHaveBeenCalled();
  });
});

describe("validações (seção 22)", () => {
  it("recusa com o WhatsApp desconectado e diz o que fazer", async () => {
    syncWhatsAppConnection.mockResolvedValue(connection({ status: "desconectado" }));
    const result = await send({ phone: "11934476935", message: "olá" });
    expect(result).toMatchObject({ ok: false, code: "desconectado" });
    expect(result.ok === false && result.error).toContain("Conecte o WhatsApp");
    // Crucial: a 2.3.7 TRAVA no envio com sessão fechada (medido no smoke
    // test). Chegar ao gateway aqui custaria 15s de espera por mensagem.
    expect(sendText).not.toHaveBeenCalled();
  });

  it("recusa número que não existe no WhatsApp", async () => {
    checkNumbers.mockResolvedValue(new Map([["5511000000000", false]]));
    const result = await send({ phone: "11000000000", message: "olá" });
    expect(result).toMatchObject({ ok: false, code: "numero_invalido" });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("envia mesmo se a verificação de número falhar", async () => {
    // Verificação é proteção, não requisito: uma rota secundária fora do ar
    // não pode derrubar o recurso inteiro.
    checkNumbers.mockRejectedValue(new Error("rota fora do ar"));
    const result = await send({ phone: "11934476935", message: "olá" });
    expect(result.ok).toBe(true);
  });

  it("recusa telefone inválido", async () => {
    const result = await send({ phone: "123", message: "olá" });
    expect(result).toMatchObject({ ok: false, code: "dados_invalidos" });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("recusa mensagem vazia", async () => {
    const result = await send({ phone: "11934476935", message: "   " });
    expect(result).toMatchObject({ ok: false, code: "dados_invalidos" });
  });

  it("normaliza o telefone para o formato do banco (55 + DDD)", async () => {
    await send({ phone: "(11) 93447-6935", message: "olá" });
    expect(sendText.mock.calls[0]![0].toPhone).toBe("5511934476935");
  });
});

describe("teto de envio (seção 30)", () => {
  it("bloqueia ao atingir o limite, sem chamar o gateway", async () => {
    countRecentManualSends.mockResolvedValue(20);
    const result = await send({ phone: "11934476935", message: "olá" });
    expect(result).toMatchObject({ ok: false, code: "limite" });
    // O limitador tem que vir ANTES do gateway, senão não protege o que
    // deveria proteger: o número do salão sendo marcado como spam.
    expect(sendText).not.toHaveBeenCalled();
    expect(syncWhatsAppConnection).not.toHaveBeenCalled();
  });
});

describe("falha no gateway (seção 28)", () => {
  it("registra a falha no histórico e devolve mensagem amigável", async () => {
    const { WhatsAppProviderError } = await import("@/lib/whatsapp/provider");
    sendText.mockRejectedValue(
      new WhatsAppProviderError("connect ECONNREFUSED 203.0.113.10:8080", { retryable: true })
    );

    const result = await send({ phone: "11934476935", message: "olá" });

    expect(result.ok).toBe(false);
    // O detalhe técnico fica no histórico (que só o dono lê) e no log; a tela
    // não pode receber IP nem porta do gateway.
    expect(result.ok === false && result.error).not.toContain("203.0.113.10");
    expect(recordManualMessage).toHaveBeenCalledTimes(1);
    const gravado = recordManualMessage.mock.calls[0]![0];
    expect(gravado.outcome).toBe("falhou");
    expect(gravado.error).toContain("203.0.113.10");
  });
});
