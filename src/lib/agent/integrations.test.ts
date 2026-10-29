import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listProviderModels } from "@/lib/agent/integrations";

const fetchMock = vi.fn<typeof fetch>();

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listProviderModels", () => {
  it("OpenRouter: valida a chave em /key e guarda só os modelos com ferramentas", async () => {
    fetchMock
      .mockResolvedValueOnce(reply({ data: { label: "sk-or-v1-abc...123" } }))
      .mockResolvedValueOnce(
        reply({
          data: [
            { id: "vendor/pago", name: "Pago", pricing: { prompt: "0.000001", completion: "0.000002" }, supported_parameters: ["tools"] },
            { id: "vendor/gratis:free", name: "Grátis", pricing: { prompt: "0", completion: "0" }, supported_parameters: ["tools", "temperature"] },
            { id: "vendor/sem-ferramentas", name: "Sem", pricing: { prompt: "0", completion: "0" }, supported_parameters: ["temperature"] },
          ],
        })
      );

    const models = await listProviderModels("openrouter", "sk-or-v1-teste", null);

    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "https://openrouter.ai/api/v1/key",
      "https://openrouter.ai/api/v1/models",
    ]);
    // Grátis primeiro; o que não aceita ferramentas fica de fora.
    expect(models.map((m) => [m.id, m.free])).toEqual([
      ["vendor/gratis:free", true],
      ["vendor/pago", false],
    ]);
  });

  it("chave recusada vira mensagem legível, sem listar nada", async () => {
    fetchMock.mockResolvedValueOnce(reply({ error: { message: "No auth" } }, 401));
    await expect(listProviderModels("openrouter", "sk-or-v1-ruim", null)).rejects.toMatchObject({
      message: "Chave recusada pelo provedor",
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("Groq: separa conversa de transcrição pelo nome", async () => {
    fetchMock.mockResolvedValueOnce(
      reply({ object: "list", data: [{ id: "whisper-large-v3-turbo" }, { id: "llama-3.3-70b-versatile" }] })
    );
    const models = await listProviderModels("groq", "gsk_teste", null);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.groq.com/openai/v1/models");
    expect(models.map((m) => [m.id, m.kind])).toEqual([
      ["llama-3.3-70b-versatile", "chat"],
      ["whisper-large-v3-turbo", "audio"],
    ]);
  });
});
