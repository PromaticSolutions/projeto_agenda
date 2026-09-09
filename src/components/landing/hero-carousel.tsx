"use client";

import { useEffect, useRef, useState } from "react";
import { AgendaPreview } from "@/components/landing/agenda-preview";
import { PhonePreview } from "@/components/landing/phone-preview";
import { DayPanelPreview } from "@/components/landing/day-panel-preview";
import { cn } from "@/lib/utils";

/**
 * As três vistas do produto no hero.
 *
 * O primeiro slide é a composição que já estava aqui — ela não mudou, só
 * ganhou companhia. Os outros dois respondem as duas perguntas que ela deixava
 * abertas: "funciona no meu celular?" e "como eu acompanho o dia?".
 *
 * TROCA POR OPACIDADE, não por deslocamento. Uma trilha que desliza precisa de
 * `overflow-hidden`, e os selos flutuantes de cada slide vivem FORA da caixa
 * do cartão — seriam decepados na borda. Empilhando os três na mesma célula da
 * grade a transição é só `opacity`, que o compositor resolve sozinho, e a
 * altura da composição passa a ser a do slide mais alto: nada salta na troca,
 * que num hero seria o pior lugar possível para um pulo de layout.
 *
 * O que PAUSA o avanço automático: ponteiro em cima, foco do teclado dentro,
 * seção fora da tela, aba escondida, e a preferência por menos movimento —
 * nesse último caso o carrossel vira um seletor manual, com os três slides
 * ainda acessíveis pelos pontos.
 *
 * Semântica de abas em vez de "carrossel" no ARIA: os pontos são um seletor de
 * três vistas do mesmo assunto, com setas do teclado, que é exatamente o que
 * `tablist` descreve — e o leitor de tela anuncia "2 de 3" sem precisar de
 * região viva.
 */

const SLIDES = [
  { id: "agenda", label: "A agenda do dia", Component: AgendaPreview },
  { id: "celular", label: "No celular", Component: PhonePreview },
  { id: "resumo", label: "O dia em números", Component: DayPanelPreview },
] as const;

/**
 * Quanto cada slide fica na tela.
 *
 * 8s e não os 5s de praxe: a sequência do primeiro slide — horário livre que
 * recebe agendamento, confirma e dispara o WhatsApp — leva 7,7s para contar a
 * história inteira. Trocar antes disso mostraria o começo dela três vezes e o
 * fim nenhuma.
 */
const SLIDE_MS = 8000;

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Ponteiro/foco e visibilidade são medidos por caminhos diferentes; guardar
  // os dois aqui evita que um sobrescreva a decisão do outro.
  const held = useRef(false);
  const visible = useRef(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const sync = () => setRunning(visible.current && !held.current && !document.hidden);

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.isIntersecting;
        sync();
      },
      { threshold: 0.25 }
    );
    observer.observe(node);
    document.addEventListener("visibilitychange", sync);

    // `pointerenter`/`pointerleave` e não `mouseover`: num aparelho de toque o
    // primeiro toque não deve congelar o carrossel para sempre.
    const hold = () => {
      held.current = true;
      sync();
    };
    const release = () => {
      held.current = false;
      sync();
    };
    node.addEventListener("pointerenter", hold);
    node.addEventListener("pointerleave", release);
    node.addEventListener("focusin", hold);
    node.addEventListener("focusout", release);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      node.removeEventListener("pointerenter", hold);
      node.removeEventListener("pointerleave", release);
      node.removeEventListener("focusin", hold);
      node.removeEventListener("focusout", release);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(
      () => setIndex((current) => (current + 1) % SLIDES.length),
      SLIDE_MS
    );
    return () => window.clearTimeout(timer);
  }, [running, index]);

  /* Setas do teclado no seletor. `tablist` promete essa navegação; sem ela o
     leitor de tela anuncia um controle que não responde como diz responder. */
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + SLIDES.length) % SLIDES.length;
    setIndex(next);
    // Mover o foco junto: numa lista de abas o item focado é o selecionado.
    const list = event.currentTarget;
    list.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      <div className="grid">
        {SLIDES.map((slide, i) => {
          const active = i === index;
          return (
            <div
              key={slide.id}
              id={`hero-slide-${slide.id}`}
              role="tabpanel"
              aria-labelledby={`hero-tab-${slide.id}`}
              /* `inert` e não só `pointer-events-none`: o slide escondido
                 continua no layout (é ele que sustenta a altura da pilha), e
                 sem isto o Tab do teclado passearia pelos três. */
              inert={!active}
              className={cn(
                "col-start-1 row-start-1 self-center transition-opacity duration-500 ease-out motion-reduce:transition-none",
                active ? "opacity-100" : "opacity-0"
              )}
            >
              <slide.Component />
            </div>
          );
        })}
      </div>

      <div
        role="tablist"
        aria-label="Vistas do Timely"
        onKeyDown={handleKeyDown}
        className="flex items-center justify-center gap-2 lg:justify-start"
      >
        {SLIDES.map((slide, i) => {
          const active = i === index;
          return (
            <button
              key={slide.id}
              type="button"
              id={`hero-tab-${slide.id}`}
              role="tab"
              aria-selected={active}
              aria-controls={`hero-slide-${slide.id}`}
              // Um só ponto de parada no Tab: entra no selecionado e as setas
              // andam entre eles, como manda o padrão de abas.
              tabIndex={active ? 0 : -1}
              onClick={() => setIndex(i)}
              className="group rounded-lg px-1 py-2 outline-none focus-visible:ring-3 focus-visible:ring-white/40"
            >
              <span className="sr-only">{slide.label}</span>
              <span
                aria-hidden
                className={cn(
                  "block h-1.5 rounded-full transition-[width,background-color] duration-300",
                  active
                    ? "w-7 bg-blush-50"
                    : "w-1.5 bg-white/30 group-hover:bg-white/60"
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
