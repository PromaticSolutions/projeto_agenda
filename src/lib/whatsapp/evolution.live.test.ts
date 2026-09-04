import { afterAll, describe, expect, it } from "vitest";

/**
 * Teste do ADAPTADOR contra a Evolution API real.
 *
 * O evolution.test.ts prova que o adaptador monta as requisições certas; este
 * prova que o gateway desta VPS responde como ele espera — que é a pergunta
 * que um dublê nunca responde. Roda o ciclo de vida numa instância descartável
 * e a apaga no fim.
 *
 * NÃO roda por padrão: a suíte não pode depender de rede nem da VPS estar de
 * pé. Para rodar:
 *
 *   EVOLUTION_LIVE=1 npx vitest run src/lib/whatsapp/evolution.live.test.ts
 *
 * (as credenciais vêm do ambiente — em dev, `--env-file=.env.local`)
 *
 * O QUE NÃO DÁ PARA AUTOMATIZAR AQUI: ler o QR code no aparelho, e portanto
 * também o envio real e o número pareado. Isso exige um celular; o roteiro
 * manual está no README.
 */

const live =
  process.env.EVOLUTION_LIVE === "1" &&
  Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY);

const instance = `live_${Date.now()}`;

afterAll(async () => {
  if (!live) return;
  // Instância órfã na Evolution mantém uma sessão do WhatsApp Web viva na
  // memória da VPS até alguém notar.
  const { createEvolutionProvider } = await import("@/lib/whatsapp/evolution");
  await createEvolutionProvider()
    .deleteInstance(instance)
    .catch(() => {});
});

describe.skipIf(!live)("adaptador contra a Evolution real", () => {
  it("percorre o ciclo de vida: criar, parear, consultar, desconectar, excluir", async () => {
    const { createEvolutionProvider } = await import("@/lib/whatsapp/evolution");
    const provider = createEvolutionProvider();

    // Instância inexistente é o estado inicial, não erro — é o que todo
    // estúdio que nunca conectou devolve.
    const inicial = await provider.status(instance);
    expect(inicial.state).toBe("desconectado");
    expect(inicial.error).toBeNull();

    // Idempotente: duas abas do painel não podem gerar erro na tela.
    await provider.ensureInstance(instance);
    await provider.ensureInstance(instance);

    const pairing = await provider.connect(instance);
    expect(pairing.qrCodeBase64).toBeTruthy();
    // O prefixo data: já foi removido pelo adaptador — o componente monta a
    // data URL por conta própria.
    expect(pairing.qrCodeBase64).not.toContain("data:image");
    // Base64 puro, decodificável em um PNG.
    const bytes = Buffer.from(pairing.qrCodeBase64!, "base64");
    expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");

    const pareando = await provider.status(instance);
    expect(["conectando", "desconectado"]).toContain(pareando.state);
    // Sem aparelho pareado não há número — e o adaptador não pode inventar um.
    expect(pareando.phone).toBeNull();

    await provider.setWebhook({
      instanceName: instance,
      url: "https://exemplo.invalido/api/webhooks/evolution",
      secret: "segredo-de-teste",
    });

    // Sessão nunca abriu: a 2.3.7 devolve 400 aqui, e o adaptador tolera.
    await expect(provider.logout(instance)).resolves.toBeUndefined();

    await expect(provider.deleteInstance(instance)).resolves.toBeUndefined();
    // Idempotente: excluir o que já não existe é sucesso.
    await expect(provider.deleteInstance(instance)).resolves.toBeUndefined();

    const final = await provider.status(instance);
    expect(final.state).toBe("desconectado");
  }, 90_000);
});
