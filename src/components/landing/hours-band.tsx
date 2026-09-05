"use client";

import { useSyncExternalStore } from "react";

/**
 * A faixa de horas escolhida na interação de custo, compartilhada com o
 * formulário lá embaixo.
 *
 * Store de módulo com `useSyncExternalStore` em vez de Context: a seção de
 * custo e o formulário são irmãos dentro de um Server Component, e um Context
 * exigiria envolver a página inteira num provider de cliente — carregando
 * JavaScript em volta de seções que não precisam de nenhum.
 *
 * É a única forma de o formulário saber essa resposta sem perguntar de novo.
 * Perguntar duas vezes a mesma coisa é o que faz um formulário parecer
 * questionário.
 */

let band: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setHoursBand(value: string) {
  if (band === value) return;
  band = value;
  for (const listener of listeners) listener();
}

export function useHoursBand(): { band: string | null } {
  // O snapshot do servidor é sempre null: nada foi escolhido durante a
  // renderização no servidor, e devolver outra coisa causaria divergência de
  // hidratação.
  const value = useSyncExternalStore(
    subscribe,
    () => band,
    () => null
  );
  return { band: value };
}
