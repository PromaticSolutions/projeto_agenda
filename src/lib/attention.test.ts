import { describe, expect, it } from "vitest";
import {
  beginAttention,
  finishAttention,
  observeDepth,
  observeDominant,
  setHidden,
} from "@/lib/attention";

/** Atalho: aplica uma sequência de seções dominantes, com o relógio em ms. */
function play(steps: [number, string | null][], startAt = 0) {
  let state = beginAttention(startAt);
  for (const [at, section] of steps) {
    state = observeDominant(state, at, section);
  }
  return state;
}

describe("observeDominant", () => {
  it("credita o tempo à seção que estava em foco, não à que chegou", () => {
    // hero das 0 às 3s, solucao das 3s às 10s.
    const state = play([
      [0, "hero"],
      [3000, "solucao"],
    ]);
    const report = finishAttention(state, 10_000);

    expect(report.dwellMs).toEqual({ hero: 3000, solucao: 7000 });
  });

  it("soma reentradas na mesma seção em vez de sobrescrever", () => {
    const state = play([
      [0, "preco"],
      [2000, "duvidas"],
      [5000, "preco"],
    ]);
    const report = finishAttention(state, 6000);

    // Voltou ao preço: 2s na primeira passada + 1s na segunda.
    expect(report.dwellMs.preco).toBe(3000);
    expect(report.dwellMs.duvidas).toBe(3000);
  });

  it("não credita nada enquanto nenhuma seção está dominante", () => {
    // Entre o topo da página e a primeira seção não há dono do tempo.
    const state = play([
      [0, null],
      [4000, "hero"],
    ]);
    const report = finishAttention(state, 6000);

    expect(report.dwellMs).toEqual({ hero: 2000 });
  });

  it("ignora relógio que anda para trás", () => {
    // `performance.now()` não volta, mas o estado é alimentado por evento e um
    // negativo aqui viraria tempo subtraído de uma seção.
    const state = play([
      [5000, "hero"],
      [3000, "solucao"],
    ]);
    const report = finishAttention(state, 8000);

    expect(report.dwellMs.hero).toBe(0);
    expect(report.dwellMs.solucao).toBe(5000);
  });
});

describe("setHidden", () => {
  it("para o relógio quando a aba sai de foco", () => {
    let state = play([[0, "preco"]]);
    state = setHidden(state, 2000, true);
    // 10 minutos com a aba escondida não são 10 minutos lendo o preço.
    state = setHidden(state, 602_000, false);
    const report = finishAttention(state, 603_000);

    expect(report.dwellMs.preco).toBe(3000);
  });

  it("não conta nada entre esconder e mostrar, mesmo trocando de seção", () => {
    let state = play([[0, "hero"]]);
    state = setHidden(state, 1000, true);
    state = observeDominant(state, 5000, "preco");
    state = setHidden(state, 9000, false);
    const report = finishAttention(state, 10_000);

    expect(report.dwellMs.hero).toBe(1000);
    expect(report.dwellMs.preco).toBe(1000);
  });

  it("esconder duas vezes seguidas não congela o relógio para sempre", () => {
    let state = play([[0, "hero"]]);
    state = setHidden(state, 1000, true);
    state = setHidden(state, 2000, true);
    state = setHidden(state, 3000, false);
    const report = finishAttention(state, 4000);

    expect(report.dwellMs.hero).toBe(2000);
  });
});

describe("observeDepth", () => {
  it("guarda a profundidade MÁXIMA, não a última", () => {
    let state = beginAttention(0);
    state = observeDepth(state, 30);
    state = observeDepth(state, 85);
    // Rolou de volta para o topo: o que vale é até onde chegou.
    state = observeDepth(state, 10);

    expect(finishAttention(state, 1000).maxDepthPct).toBe(85);
  });

  it("prende a profundidade entre 0 e 100", () => {
    let state = beginAttention(0);
    state = observeDepth(state, 140);
    expect(finishAttention(state, 1).maxDepthPct).toBe(100);

    state = observeDepth(beginAttention(0), -20);
    expect(finishAttention(state, 1).maxDepthPct).toBe(0);
  });

  it("arredonda para inteiro, que é a granularidade que a tela usa", () => {
    const state = observeDepth(beginAttention(0), 62.7);
    expect(finishAttention(state, 1).maxDepthPct).toBe(63);
  });
});

describe("finishAttention", () => {
  it("fecha o tempo da seção que ainda estava em foco", () => {
    const state = play([[0, "final"]]);
    expect(finishAttention(state, 4000).dwellMs.final).toBe(4000);
  });

  it("reporta a duração total da visita", () => {
    const state = play([
      [0, "hero"],
      [3000, "preco"],
    ]);
    expect(finishAttention(state, 9000).totalMs).toBe(9000);
  });

  it("não conta o tempo escondido na duração total", () => {
    let state = play([[0, "hero"]]);
    state = setHidden(state, 1000, true);
    state = setHidden(state, 60_000, false);
    // 61s de relógio de parede, 2s de leitura.
    expect(finishAttention(state, 61_000).totalMs).toBe(2000);
  });

  it("devolve relatório vazio e válido para quem saiu na hora", () => {
    const report = finishAttention(beginAttention(0), 0);
    expect(report.dwellMs).toEqual({});
    expect(report.totalMs).toBe(0);
    expect(report.maxDepthPct).toBe(0);
  });
});
