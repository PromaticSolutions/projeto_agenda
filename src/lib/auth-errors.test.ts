import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/lib/auth-errors";

/**
 * O que este teste protege: nenhuma frase em inglês do GoTrue chega à tela.
 *
 * O caso que motivou a função é o do fallback — antes, o que não estivesse
 * mapeado era repassado cru, então uma mensagem nova do servidor virava texto
 * técnico em inglês na cara de quem só queria entrar na conta.
 */
describe("authErrorMessage", () => {
  it("traduz pelo código, que é o que não muda entre versões", () => {
    expect(authErrorMessage({ code: "invalid_credentials", message: "Invalid login credentials" }))
      .toBe("E-mail ou senha incorretos.");
    expect(authErrorMessage({ code: "user_already_exists", message: "User already registered" }))
      .toContain("já possui uma conta");
    expect(authErrorMessage({ code: "over_email_send_rate_limit", message: "rate limit" }))
      .toContain("Aguarde");
  });

  it("cai para o texto quando o servidor não manda código", () => {
    // GoTrue antigo: só `message`.
    expect(authErrorMessage({ code: undefined, message: "Invalid login credentials" }))
      .toBe("E-mail ou senha incorretos.");
    expect(
      authErrorMessage({
        code: undefined,
        message: "For security purposes, you can only request this after 51 seconds",
      })
    ).toContain("Aguarde");
  });

  it("nunca repassa mensagem desconhecida do servidor", () => {
    const saida = authErrorMessage({ code: "algum_codigo_novo", message: "Some new english error" });
    expect(saida).not.toContain("english");
    expect(saida).toBe("Não foi possível concluir agora. Tente novamente em instantes.");
  });

  it("respeita o fallback de cada tela", () => {
    expect(authErrorMessage({ code: "unknown", message: "boom" }, "Não deu para entrar."))
      .toBe("Não deu para entrar.");
    // Erro nulo também usa o fallback: a tela chama isto sem saber se houve erro.
    expect(authErrorMessage(null, "Não deu para entrar.")).toBe("Não deu para entrar.");
  });
});
