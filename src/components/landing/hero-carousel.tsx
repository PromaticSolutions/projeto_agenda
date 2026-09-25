"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
 * TROCA POR OPACIDADE, não por deslocamento. Empilhando os três na mesma
 * célula da grade a transição é só `opacity`, que o compositor resolve
 * sozinho, e a altura da composição passa a ser a do slide mais alto: nada
 * salta na troca, que num hero seria o pior lugar possível para um pulo de
 * layout.
 *
 * O que PAUSA o avanço automático: ponteiro em cima, foco do teclado dentro,
 * seção fora da tela, aba escondida, e a preferência por menos movimento —
 * nesse último caso o carrossel vira um seletor manual, com os três slides
 * ainda acessíveis pelas abas.
 *
 * Semântica de abas em vez de "carrossel" no ARIA: as abas são um seletor de
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

  function go(delta: number) {
    setIndex((current) => (current + delta + SLIDES.length) % SLIDES.length);
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-5">
      <div className="relative grid">
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

      {/* Controles embaixo da composição, nunca por cima dela: as abas com o
          NOME de cada vista (ponto sem rótulo não diz o que vem) e as setas no
          fim da linha. O traço sob a aba ativa é o mesmo fio da pauta. */}
      <div className="flex items-center gap-4 border-t border-foreground/15">
        <div
          role="tablist"
          aria-label="Vistas do Timely"
          onKeyDown={handleKeyDown}
          className="-mt-px flex min-w-0 flex-1 gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                className={cn(
                  "shrink-0 border-t-2 pt-3 text-sm whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="time-label mr-1.5 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                {slide.label}
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 gap-1 pt-3">
          <CarouselArrow side="left" label="Vista anterior" onClick={() => go(-1)} />
          <CarouselArrow side="right" label="Próxima vista" onClick={() => go(1)} />
        </div>
      </div>
    </div>
  );
}

function CarouselArrow({
  side,
  label,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 outline-none hover:bg-foreground/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
