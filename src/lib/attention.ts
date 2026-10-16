/**
 * Atenção na landing: até onde a pessoa rolou e onde ela parou.
 *
 * Máquina de estado pura, sem DOM e sem relógio próprio — o `at` sempre chega
 * por parâmetro, como em `reminders.ts` e `metrics.ts`. Quem fala com
 * `IntersectionObserver`, com `visibilitychange` e com `performance.now()` é a
 * ilha `scroll-attention.tsx`; aqui mora só a contabilidade, que é a parte que
 * erra em silêncio e por isso tem teste.
 *
 * ## Uma seção dona do tempo por vez
 *
 * Numa viewport cabem duas ou três seções ao mesmo tempo. Somar o tempo de
 * todas as que estão visíveis daria um total maior que a visita inteira, e
 * "onde a pessoa ficou" viraria "o que coube na tela". Então o tempo tem um
 * dono só a cada instante — a seção mais visível —, e a soma dos tempos fecha
 * com a duração da visita.
 *
 * ## O relógio para quando a aba sai de foco
 *
 * Sem isso, uma aba esquecida aberta no fim de semana vira "dois dias lendo a
 * tabela de preços" e envenena a mediana de todo mundo. `setHidden` é o que
 * separa tempo de leitura de tempo de parede.
 */

export interface AttentionState {
  /** Seção que detém o tempo agora. `null` = nenhuma (topo da página, rodapé). */
  readonly dominant: string | null;
  /** Instante do último evento aplicado; a base do próximo delta. */
  readonly lastAt: number;
  readonly hidden: boolean;
  readonly dwellMs: Readonly<Record<string, number>>;
  /** Tempo com a aba à vista, independente de haver seção dominante. */
  readonly activeMs: number;
  readonly maxDepthPct: number;
}

export interface AttentionReport {
  /** Milissegundos de atenção por seção. Só aparece quem chegou a ser dono. */
  dwellMs: Record<string, number>;
  /** Até onde a pessoa chegou, em % da altura rolável. */
  maxDepthPct: number;
  /** Duração da visita descontado o tempo com a aba escondida. */
  totalMs: number;
}

export function beginAttention(at: number): AttentionState {
  return {
    dominant: null,
    lastAt: at,
    hidden: false,
    dwellMs: {},
    activeMs: 0,
    maxDepthPct: 0,
  };
}

/**
 * Fecha a conta até `at` e reancora o relógio.
 *
 * Delta negativo é descartado, mas o relógio PASSA a contar do novo instante:
 * `performance.now()` não anda para trás, só que o estado é alimentado por
 * evento e um negativo que escapasse subtrairia tempo já creditado.
 */
function advance(state: AttentionState, at: number): AttentionState {
  const delta = Math.max(0, at - state.lastAt);

  if (state.hidden) {
    return { ...state, lastAt: at };
  }

  // O dono recebe o tempo mesmo quando o delta é zero: é o que faz a seção
  // aparecer no relatório com 0ms em vez de sumir dele.
  const dwellMs =
    state.dominant === null
      ? state.dwellMs
      : { ...state.dwellMs, [state.dominant]: (state.dwellMs[state.dominant] ?? 0) + delta };

  return { ...state, lastAt: at, dwellMs, activeMs: state.activeMs + delta };
}

/** Troca a seção dona do tempo. O tempo decorrido vai para a anterior. */
export function observeDominant(
  state: AttentionState,
  at: number,
  section: string | null
): AttentionState {
  return { ...advance(state, at), dominant: section };
}

/** Liga e desliga o relógio conforme a aba fica escondida ou volta. */
export function setHidden(state: AttentionState, at: number, hidden: boolean): AttentionState {
  return { ...advance(state, at), hidden };
}

/** Guarda a maior profundidade alcançada. Rolar de volta não desfaz. */
export function observeDepth(state: AttentionState, pct: number): AttentionState {
  const clamped = Math.round(Math.min(100, Math.max(0, pct)));
  return clamped > state.maxDepthPct ? { ...state, maxDepthPct: clamped } : state;
}

export function finishAttention(state: AttentionState, at: number): AttentionReport {
  const final = advance(state, at);
  return {
    dwellMs: { ...final.dwellMs },
    maxDepthPct: final.maxDepthPct,
    totalMs: final.activeMs,
  };
}
