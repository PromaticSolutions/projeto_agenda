"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, Check, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Seal } from "@/components/landing/seal";
import { cn } from "@/lib/utils";

/**
 * Prévia do produto no hero — e a única seção da página que se explica
 * sozinha, sem uma linha de texto.
 *
 * NÃO é screenshot. É a interface montada com os mesmos primitivos do
 * sistema: `panel`, `Badge`, a barra colorida do serviço à esquerda, hora em
 * peso semibold, telefone com o ícone — a anatomia de
 * `components/app/booking-card.tsx`.
 *
 * Imagem estática seria mais rápida de fazer e pior em três frentes: não
 * acompanha o tema claro/escuro, fica desalinhada com a interface real no
 * primeiro ajuste de layout, e um PNG legível no desktop pesa muito para o
 * celular. Aqui o "mockup" é HTML — responsivo e sempre atual por construção.
 *
 * A SEQUÊNCIA (mostrar em vez de contar): o terceiro horário nasce vazio e
 * vai sendo preenchido — cliente, procedimento, valor, confirmação e, por
 * fim, o aviso de que o WhatsApp saiu. É o fluxo real do produto: quem marca
 * pelo link ocupa um horário livre e recebe a confirmação sozinha.
 *
 * O que a sequência NÃO faz: mexer no tamanho de nada. O slot vazio ocupa
 * exatamente a altura da linha preenchida, então o cartão nunca "pula" —
 * layout shift no hero é o pior lugar possível para ele acontecer.
 *
 * Os dados são demonstrativos e genéricos de propósito: nomes comuns, sem
 * sugerir cliente real de ninguém.
 */

const DEMO_BOOKINGS = [
  {
    start: "09:00",
    end: "10:30",
    service: "Design de sobrancelhas",
    client: "Ana Beatriz",
    phone: "(11) 9••••-4821",
    price: "R$ 60,00",
    color: "var(--violet-600)",
  },
  {
    start: "11:00",
    end: "12:00",
    service: "Manicure",
    client: "Carla Souza",
    phone: "(11) 9••••-7734",
    price: "R$ 45,00",
    color: "var(--magenta)",
  },
];

/** O horário que a sequência preenche, campo por campo. */
const INCOMING = {
  start: "14:00",
  end: "16:00",
  service: "Coloração",
  client: "Juliana Melo",
  phone: "(21) 9••••-1190",
  price: "R$ 180,00",
  color: "#0f766e",
};

/**
 * Os tempos de cada passo, em milissegundos.
 *
 * O último é longo de propósito: é a pausa em que o resultado FICA na tela
 * antes de recomeçar. Sem ela a sequência viraria um piscar contínuo no canto
 * do olho de quem está lendo a headline ao lado.
 */
const STEP_MS = [900, 700, 700, 900, 1100, 3400];
const LAST_STEP = STEP_MS.length - 1;

export function AgendaPreview() {
  const [step, setStep] = useState(0);
  // "Rodando": em tela, aba à frente e sem pedido de menos movimento. É a
  // chave única que liga o relógio — sem ela o timer continuaria correndo
  // atrás de uma aba oculta, gastando bateria sem ninguém vendo.
  const [running, setRunning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    let onScreen = false;
    const sync = () => setRunning(onScreen && !document.hidden);

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Quem pediu menos movimento recebe o estado FINAL, não o inicial: a
        // informação da demonstração é o horário preenchido e confirmado, e
        // congelar no slot vazio esconderia justamente o que ela mostra.
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          observer.disconnect();
          setStep(LAST_STEP);
          return;
        }
        onScreen = entry.isIntersecting;
        sync();
      },
      { threshold: 0.25 }
    );
    observer.observe(node);
    document.addEventListener("visibilitychange", sync);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  // O relógio da sequência: um único timer, reagendado a cada passo. O
  // efeito acima decide QUANDO ele pode correr; este só avança.
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(
      () => setStep((current) => (current >= LAST_STEP ? 0 : current + 1)),
      STEP_MS[step]
    );
    return () => window.clearTimeout(timer);
  }, [running, step]);

  const hasClient = step >= 1;
  const hasService = step >= 2;
  const hasPrice = step >= 3;
  const confirmed = step >= 4;
  const notified = step >= 5;

  return (
    <div
      ref={containerRef}
      className="relative"
      role="img"
      aria-label="Exemplo da agenda do Timely: um horário livre às 14:00 recebe um agendamento de coloração, é confirmado e a cliente recebe a confirmação no WhatsApp."
    >
      {/* A prévia inteira usa o tema CLARO, independente do tema do visitante:
          ela representa o painel, que é uma superfície clara — e sobre o
          plum-900 do hero isso cria a separação "isto é o produto, aquilo é a
          página". `text-foreground` dentro dela resolve para o token claro
          porque o wrapper não herda `.dark`. */}
      <div className="panel overflow-hidden bg-white text-[#1c1b22] shadow-2xl shadow-black/30">
        <header className="flex items-center justify-between gap-3 border-b border-[#dcdee4] px-4 py-3">
          <div>
            <p className="text-[0.6875rem] font-semibold tracking-[0.04em] text-[#61616e] uppercase">
              Hoje
            </p>
            <p className="font-semibold">Terça, 8 de setembro</p>
          </div>
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            {hasClient ? "3 horários" : "2 horários"}
          </Badge>
        </header>

        <ol className="divide-y divide-[#dcdee4]">
          {DEMO_BOOKINGS.map((b) => (
            <li key={b.start} className="relative flex gap-3 pl-4">
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-1"
                style={{ backgroundColor: b.color }}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1 py-3 pr-4">
                <p className="flex items-baseline gap-1.5">
                  <time className="text-lg font-semibold">{b.start}</time>
                  <span className="text-sm text-[#61616e]">→ {b.end}</span>
                </p>
                <p className="truncate text-sm text-[#61616e]">{b.service}</p>
                <p className="truncate font-medium">{b.client}</p>
                <p className="flex items-center gap-1.5 text-sm text-[#61616e]">
                  <Phone className="size-3.5 shrink-0" aria-hidden />
                  <span className="tabular-nums">{b.phone}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 py-3 pr-4">
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  Confirmado
                </span>
                <span className="tabular-nums text-sm">{b.price}</span>
              </div>
            </li>
          ))}

          {/* O horário da sequência. A altura é a mesma nos dois estados
              (`min-h`), então o preenchimento não empurra nada. */}
          <li className="relative flex min-h-[6.75rem] gap-3 pl-4">
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1 transition-colors duration-500"
              style={{ backgroundColor: hasClient ? INCOMING.color : "#dcdee4" }}
            />

            <div className="flex min-w-0 flex-1 flex-col gap-1 py-3 pr-4">
              <p className="flex items-baseline gap-1.5">
                <time className="text-lg font-semibold">{INCOMING.start}</time>
                <span
                  className={cn(
                    "text-sm text-[#61616e] transition-opacity duration-500",
                    hasService ? "opacity-100" : "opacity-0"
                  )}
                >
                  → {INCOMING.end}
                </span>
              </p>

              {/* Os dois estados ocupam a MESMA célula da grade, um por cima
                  do outro: é o que faz a troca acontecer sem reflow. */}
              <div className="grid">
                <p
                  className={cn(
                    "col-start-1 row-start-1 text-sm text-[#8a8a96] transition-opacity duration-400",
                    hasClient ? "opacity-0" : "opacity-100"
                  )}
                >
                  Livre para encaixe
                </p>
                <div
                  className={cn(
                    "col-start-1 row-start-1 flex flex-col gap-1 transition-opacity duration-400",
                    hasClient ? "opacity-100" : "opacity-0"
                  )}
                >
                  <p
                    className={cn(
                      "truncate text-sm text-[#61616e] transition-opacity duration-500",
                      hasService ? "opacity-100" : "opacity-0"
                    )}
                  >
                    {INCOMING.service}
                  </p>
                  <p className="truncate font-medium">{INCOMING.client}</p>
                  <p className="flex items-center gap-1.5 text-sm text-[#61616e]">
                    <Phone className="size-3.5 shrink-0" aria-hidden />
                    <span className="tabular-nums">{INCOMING.phone}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1 py-3 pr-4">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-500",
                  !hasClient && "opacity-0",
                  confirmed
                    ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-amber-500/10 text-amber-700"
                )}
              >
                {confirmed ? "Confirmado" : "Aguardando"}
              </span>
              <span
                className={cn(
                  "tabular-nums text-sm transition-opacity duration-500",
                  hasPrice ? "opacity-100" : "opacity-0"
                )}
              >
                {INCOMING.price}
              </span>
            </div>
          </li>
        </ol>
      </div>

      {/* Os selos entram JUNTO com o passo que anunciam — não flutuam soltos
          desde o começo. `hidden sm:flex` porque no celular eles cobririam o
          cartão em vez de decorar a composição. */}
      <Seal
        shown={confirmed}
        className="float-soft -top-7 -left-5 hidden border-white/15 bg-plum-900/90 text-blush-50 sm:flex"
      >
        <Check className="size-3.5 shrink-0 text-emerald-400" aria-hidden />
        Agendamento confirmado
      </Seal>

      <Seal
        shown={notified}
        className="float-soft -right-3 -bottom-4 hidden border-white/15 bg-[var(--wa)]/95 font-medium text-white sm:flex"
        style={{ animationDelay: "1.4s" }}
      >
        <BellRing className="size-3.5 shrink-0" aria-hidden />
        WhatsApp — confirmação enviada
      </Seal>
    </div>
  );
}
