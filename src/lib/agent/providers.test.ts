import { describe, expect, it } from "vitest";
import { classifyModel, detectProviderFromKey } from "@/lib/agent/providers";

describe("detectProviderFromKey", () => {
  it("reconhece cada provedor pelo começo da chave", () => {
    expect(detectProviderFromKey("sk-or-v1-abc")).toBe("openrouter");
    expect(detectProviderFromKey("sk-ant-api03-abc")).toBe("anthropic");
    expect(detectProviderFromKey("gsk_abc")).toBe("groq");
    expect(detectProviderFromKey("AIzaSyAbc")).toBe("gemini");
    expect(detectProviderFromKey("sk-proj-abc")).toBe("openai");
  });

  it("ignora espaço colado junto e não chuta o desconhecido", () => {
    expect(detectProviderFromKey("  sk-or-v1-abc \n")).toBe("openrouter");
    expect(detectProviderFromKey("xai-abc")).toBeNull();
  });
});

describe("classifyModel", () => {
  it("separa conversa, transcrição e o resto", () => {
    expect(classifyModel("openai/gpt-oss-120b")).toBe("chat");
    expect(classifyModel("meta-llama/llama-3.3-70b-instruct:free")).toBe("chat");
    expect(classifyModel("whisper-large-v3-turbo")).toBe("audio");
    expect(classifyModel("gemini-embedding-2")).toBe("other");
    expect(classifyModel("gemini-2.5-flash-image")).toBe("other");
  });
});
