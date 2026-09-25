"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Rascunhos do painel lateral de Conversas, SEPARADOS POR CONVERSA.
 *
 * O orçamento montado para a Ana não pode aparecer quando o dono abre a
 * conversa da Camila, e voltar para a Ana tem que trazer o orçamento dela de
 * volta. Cada valor mora sob a chave `<conversa>:<nome>`.
 *
 * Fica na memória e na `sessionStorage` da aba: sobrevive a trocar de conversa
 * e a recarregar a página, e some ao fechar a aba — rascunho, não cadastro.
 *
 * `useSyncExternalStore` e não `useState`: o painel é desmontado ao trocar de
 * conversa, e o estado precisa viver fora dele. O servidor sempre vê o valor
 * inicial, então não há diferença de hidratação.
 */

const PREFIX = "timely:conversa:";
const cache = new Map<string, unknown>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function read(key: string): unknown {
  if (!cache.has(key)) {
    let value: unknown = undefined;
    try {
      const raw = window.sessionStorage.getItem(PREFIX + key);
      if (raw !== null) value = JSON.parse(raw);
    } catch {
      // Aba anônima ou armazenamento bloqueado: segue só com a memória.
    }
    cache.set(key, value);
  }
  return cache.get(key);
}

function write(key: string, value: unknown) {
  cache.set(key, value);
  try {
    if (value === undefined) window.sessionStorage.removeItem(PREFIX + key);
    else window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Idem: o valor continua valendo na memória.
  }
  listeners.forEach((listener) => listener());
}

export function useChatDraft<T>(
  chatId: string,
  name: string,
  initial: T
): [T, (next: T | ((previous: T) => T)) => void, () => void] {
  const key = `${chatId}:${name}`;
  // O snapshot devolve o valor guardado (ou `undefined`), e o `initial` entra
  // só depois: um objeto literal novo a cada render como snapshot faria o
  // React achar que o valor mudou sem parar.
  const stored = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => undefined
  ) as T | undefined;
  const value = stored === undefined ? initial : stored;

  const set = useCallback(
    (next: T | ((previous: T) => T)) => {
      const current = read(key);
      const base = (current === undefined ? initial : current) as T;
      write(key, typeof next === "function" ? (next as (previous: T) => T)(base) : next);
    },
    // `initial` fica de fora de propósito: é o valor de partida, e um literal
    // novo a cada render recriaria a função sem necessidade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );
  const reset = useCallback(() => write(key, undefined), [key]);

  return [value, set, reset];
}

/**
 * Preferência do painel que vale para TODAS as conversas (largura, recolhido).
 * Mesmo mecanismo, na `localStorage`: é gosto de quem usa, não rascunho.
 */
const PREF_PREFIX = "timely:painel-conversa:";
const prefCache = new Map<string, unknown>();

function readPref(key: string): unknown {
  if (!prefCache.has(key)) {
    let value: unknown = undefined;
    try {
      const raw = window.localStorage.getItem(PREF_PREFIX + key);
      if (raw !== null) value = JSON.parse(raw);
    } catch {
      // Sem armazenamento: vale o padrão.
    }
    prefCache.set(key, value);
  }
  return prefCache.get(key);
}

export function usePanelPreference<T>(name: string, initial: T): [T, (next: T) => void] {
  const stored = useSyncExternalStore(
    subscribe,
    () => readPref(name),
    () => undefined
  ) as T | undefined;
  const set = useCallback(
    (next: T) => {
      prefCache.set(name, next);
      try {
        window.localStorage.setItem(PREF_PREFIX + name, JSON.stringify(next));
      } catch {
        // Idem.
      }
      listeners.forEach((listener) => listener());
    },
    [name]
  );
  return [stored === undefined ? initial : stored, set];
}
