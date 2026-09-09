import { describe, expect, it } from "vitest";
import {
  CONSENT_UNKNOWN,
  POLICY_VERSION,
  allows,
  isConsentCurrent,
  makeConsent,
  parseConsent,
  serializeConsent,
} from "@/lib/consent";

/**
 * O que importa testar aqui é a fronteira de CONFIANÇA: `parseConsent` recebe
 * uma string que o usuário controla (é um cookie, editável no navegador), e
 * todo o resto do sistema decide o que pode rodar a partir do que ela devolve.
 * Um parse frouxo aqui autoriza tratamento sem consentimento.
 */
describe("parseConsent", () => {
  it("faz a volta completa com o que foi serializado", () => {
    const record = makeConsent(true);
    expect(parseConsent(serializeConsent(record))).toEqual(record);
  });

  it("trata ausência de cookie como ausência de decisão", () => {
    expect(parseConsent(undefined)).toBeNull();
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent("")).toBeNull();
  });

  it("não confunde o sentinela do servidor com uma decisão", () => {
    expect(parseConsent(CONSENT_UNKNOWN)).toBeNull();
  });

  it.each([
    ["não é JSON", "isto-nao-e-json"],
    ["JSON truncado", "%7B%22analytics%22%3Atrue"],
    ["JSON que não é objeto", encodeURIComponent(JSON.stringify("aceito"))],
    ["nulo", encodeURIComponent(JSON.stringify(null))],
    ["array", encodeURIComponent(JSON.stringify([true]))],
    ["sem analytics", encodeURIComponent(JSON.stringify({ policyVersion: "2026-09", updatedAt: "x" }))],
    ["analytics não-booleano", encodeURIComponent(JSON.stringify({ analytics: "sim", policyVersion: "2026-09", updatedAt: "x" }))],
    ["sem versão", encodeURIComponent(JSON.stringify({ analytics: true, updatedAt: "x" }))],
    ["versão vazia", encodeURIComponent(JSON.stringify({ analytics: true, policyVersion: "", updatedAt: "x" }))],
    ["sem data", encodeURIComponent(JSON.stringify({ analytics: true, policyVersion: "2026-09" }))],
  ])("descarta registro corrompido: %s", (_caso, valor) => {
    expect(parseConsent(valor)).toBeNull();
  });

  it("ignora `necessary` gravado como false — a sessão não é negociável", () => {
    const adulterado = encodeURIComponent(
      JSON.stringify({ necessary: false, analytics: false, policyVersion: POLICY_VERSION, updatedAt: "x" })
    );
    expect(parseConsent(adulterado)?.necessary).toBe(true);
  });
});

describe("isConsentCurrent", () => {
  it("vale para a versão vigente da política", () => {
    expect(isConsentCurrent(makeConsent(false))).toBe(true);
  });

  it("não vale sem decisão nenhuma", () => {
    expect(isConsentCurrent(null)).toBe(false);
  });

  it("não vale para versão anterior — é o gatilho de repergunta", () => {
    const antigo = { ...makeConsent(true), policyVersion: "2020-01" };
    expect(isConsentCurrent(antigo)).toBe(false);
  });

  it("também não vale para versão POSTERIOR desconhecida", () => {
    // Comparação por igualdade, não por ordem: um cookie de uma versão que
    // este build não conhece é motivo para perguntar, não para confiar.
    const futuro = { ...makeConsent(true), policyVersion: "2099-12" };
    expect(isConsentCurrent(futuro)).toBe(false);
  });
});

describe("allows", () => {
  it("libera o necessário mesmo sem decisão", () => {
    expect(allows(null, "necessary")).toBe(true);
  });

  it("bloqueia analytics enquanto ninguém respondeu", () => {
    expect(allows(null, "analytics")).toBe(false);
  });

  it("bloqueia analytics quando a decisão foi por não autorizar", () => {
    expect(allows(makeConsent(false), "analytics")).toBe(false);
  });

  it("libera analytics com decisão vigente e autorização", () => {
    expect(allows(makeConsent(true), "analytics")).toBe(true);
  });

  it("bloqueia analytics autorizado numa versão antiga da política", () => {
    // O texto mudou; a autorização anterior não se estende ao novo tratamento.
    const antigo = { ...makeConsent(true), policyVersion: "2020-01" };
    expect(allows(antigo, "analytics")).toBe(false);
  });
});

describe("makeConsent", () => {
  it("carimba a versão vigente e uma data ISO", () => {
    const record = makeConsent(false);
    expect(record.policyVersion).toBe(POLICY_VERSION);
    expect(record.necessary).toBe(true);
    expect(() => new Date(record.updatedAt).toISOString()).not.toThrow();
  });
});
