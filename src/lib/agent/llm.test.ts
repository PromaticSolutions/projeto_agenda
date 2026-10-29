import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runToolLoop, type AgentTool } from "@/lib/agent/llm";
import { decryptSecret, encryptSecret, lastFour } from "@/lib/agent/secrets";

/**
 * O laço de ferramentas no formato OpenAI é o caminho de Gemini, Groq,
 * OpenRouter, OpenAI e das APIs personalizadas — o que mais vai rodar.
 */

const config = { provider: "groq" as const, baseUrl: null, model: "openai/gpt-oss-120b", apiKey: "gsk_teste" };

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const verHorarios: AgentTool = {
  name: "ver_horarios",
  description: "teste",
  parameters: { type: "object", properties: { data: { type: "string" } }, required: ["data"] },
  run: vi.fn(async (args) => `livres em ${String(args.data)}: 09:00, 10:00`),
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runToolLoop (formato OpenAI)", () => {
  it("roda a ferramenta pedida e devolve a resposta final", async () => {
    fetchMock
      .mockResolvedValueOnce(
        reply({
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  { id: "c1", type: "function", function: { name: "ver_horarios", arguments: '{"data":"2026-11-11"}' } },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 10 },
        })
      )
      .mockResolvedValueOnce(
        reply({
          choices: [{ message: { role: "assistant", content: "Tenho 09:00 ou 10:00 😊" } }],
          usage: { prompt_tokens: 150, completion_tokens: 12 },
        })
      );

    const result = await runToolLoop(config, "sistema", [{ role: "user", content: "tem horário?" }], [verHorarios]);

    expect(result.text).toBe("Tenho 09:00 ou 10:00 😊");
    expect(result.toolsUsed).toEqual(["ver_horarios"]);
    expect(result.inputTokens).toBe(250);
    expect(verHorarios.run).toHaveBeenCalledWith({ data: "2026-11-11" });

    // Endereço do Groq e a resposta da ferramenta casada com a chamada.
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.groq.com/openai/v1/chat/completions");
    const second = JSON.parse(String(fetchMock.mock.calls[1]![1]!.body));
    expect(second.messages.at(-1)).toEqual({
      role: "tool",
      tool_call_id: "c1",
      content: "livres em 2026-11-11: 09:00, 10:00",
    });
  });

  it("descarta mensagens do estúdio antes da primeira da cliente", async () => {
    fetchMock.mockResolvedValueOnce(reply({ choices: [{ message: { content: "oi" } }] }));
    await runToolLoop(
      config,
      "sistema",
      [
        { role: "assistant", content: "mensagem antiga do estúdio" },
        { role: "user", content: "oi" },
      ],
      []
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user"]);
    expect(body.tools).toBeUndefined();
  });

  it("traduz chave recusada numa mensagem que a tela entende", async () => {
    fetchMock.mockResolvedValueOnce(reply({ error: { message: "Invalid API Key" } }, 401));
    await expect(
      runToolLoop(config, "sistema", [{ role: "user", content: "oi" }], [])
    ).rejects.toMatchObject({
      name: "LlmError",
      message: "Chave de API recusada pelo provedor (Invalid API Key)",
      status: 401,
    });
  });
});

describe("cifra das chaves", () => {
  it("decifra o que cifrou, sem guardar a chave em claro", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= "segredo-de-teste";
    const stored = encryptSecret("sk-minha-chave-1234");
    expect(stored).not.toContain("minha-chave");
    expect(decryptSecret(stored)).toBe("sk-minha-chave-1234");
    expect(lastFour("sk-minha-chave-1234")).toBe("1234");
  });

  it("recusa texto adulterado", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= "segredo-de-teste";
    const [v, iv, tag, data] = encryptSecret("chave").split(":");
    const tampered = [v, iv, tag, Buffer.from("outra").toString("base64")].join(":");
    expect(() => decryptSecret(tampered)).toThrow();
    expect(data).toBeTruthy();
  });
});
