"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Check, CheckCheck, RotateCcw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/landing/reveal";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

/**
 * Demonstração do WhatsApp.
 *
 * A conversa é DEMONSTRATIVA e está rotulada como tal na tela — não é print
 * de conversa real de ninguém. O que ela mostra corresponde ao que o sistema
 * faz: o lembrete sai do número do estúdio, com a mensagem renderizada a
 * partir do template de /app/reminders (os marcadores {cliente}, {servico},
 * {data}, {hora}, {salao} são os que existem em src/lib/reminders.ts).
 *
 * O que a demo NÃO promete: que o Timely responde a cliente. O produto envia;
 * não há caixa de entrada nem resposta automática (ver DECISIONS.md). Por
 * isso a última bolha é da cliente confirmando no WhatsApp normal, e o texto
 * ao lado explica que a resposta chega para você — não para um robô.
 */

interface Bubble {
  side: "them" | "us";
  text: string;
  time: string;
  /** Marca a mensagem que o Timely disparou. */
  automatic?: boolean;
}

const THREAD: Bubble[] = [
  {
    side: "us",
    text:
      "Olá Ana! Passando para confirmar seu horário de Design de sobrancelhas amanhã, 9 de setembro, às 09:00. Até logo! — Studio Aurora",
    time: "18:00",
    automatic: true,
  },
  { side: "them", text: "Oi! Confirmado 💜 chego uns 10 min antes", time: "18:04" },
  { side: "us", text: "Perfeito, Ana. Te espero!", time: "18:06" },
];

const STAGES = [
  { label: "Horário marcado na agenda", detail: "A cliente marcou pelo seu link às 14:22." },
  { label: "Timely programa o lembrete", detail: "Na antecedência que você configurou." },
  { label: "WhatsApp envia pelo seu número", detail: "Com o seu nome, do seu WhatsApp." },
  { label: "A cliente responde para você", detail: "A conversa é sua — o Timely só dispara." },
];

export function WhatsAppDemo() {
  const [step, setStep] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // A linha do tempo é mais longa que a lista de estágios: as bolhas começam
  // a entrar no estágio 3 e a última precisa de um tique só dela. Com
  // `total = STAGES.length` a terceira bolha nunca aparecia — o contador
  // parava em 4 e `step - 2` chegava no máximo a 2, com 3 bolhas na conversa.
  const total = STAGES.length + THREAD.length - 2;

  // `useCallback` porque o efeito abaixo depende desta função: recriada a
  // cada render, ela reexecutaria o efeito (e reinstalaria o observer) em
  // toda mudança de `step` — ou seja, a cada 1,1s durante a animação.
  const play = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    setStep(0);
    let n = 0;
    timer.current = setInterval(() => {
      n += 1;
      setStep(n);
      if (n >= total && timer.current) clearInterval(timer.current);
    }, 1100);
  }, [total]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || started.current) return;
        started.current = true;
        observer.disconnect();

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setStep(total);
          return;
        }
        play();
      },
      { threshold: 0.35 }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (timer.current) clearInterval(timer.current);
    };
  }, [total, play]);

  // Quantas bolhas já apareceram: a primeira entra no estágio 3 (envio).
  const visibleBubbles = step <= 2 ? 0 : Math.min(THREAD.length, step - 2);

  return (
    <section
      id="whatsapp"
      className="scroll-mt-16 border-b border-border bg-plum-900 py-20 text-blush-50 sm:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal sectionName="whatsapp" className="max-w-2xl">
          <h2 className="text-[2rem] leading-[1.12] font-semibold tracking-tight text-balance sm:text-[2.5rem]">
            O lembrete que você nunca mais precisa mandar.
          </h2>
          <p className="mt-4 text-[1.0625rem] leading-7 text-blush-50/75">
            Do seu número, com o seu nome, na hora certa.
          </p>
        </Reveal>

        <div ref={ref} className="mt-14 grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-14">
          {/* Os estágios */}
          <div className="flex flex-col gap-3">
            {STAGES.map((s, i) => {
              const done = step > i;
              // `active` só faz sentido enquanto o contador está dentro da
              // faixa dos estágios; depois disso ele segue revelando bolhas.
              const active = step === i + 1 && step <= STAGES.length;
              return (
                <div
                  key={s.label}
                  className={cn(
                    "flex items-start gap-3.5 rounded-lg border p-4 transition-colors duration-500",
                    done
                      ? "border-white/20 bg-white/[0.07]"
                      : "border-white/10 bg-transparent",
                    active && "border-[var(--wa)]/50"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-500",
                      done
                        ? "border-transparent bg-[var(--wa)] text-white"
                        : "border-white/25 text-blush-50/40"
                    )}
                  >
                    {done ? (
                      <Check className="size-3.5" />
                    ) : (
                      <span className="font-mono text-[0.625rem]">{i + 1}</span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-[0.9375rem] font-medium transition-colors duration-500",
                        done ? "text-blush-50" : "text-blush-50/50"
                      )}
                    >
                      {s.label}
                    </p>
                    <p className="mt-0.5 text-sm text-blush-50/55">{s.detail}</p>
                  </div>
                </div>
              );
            })}

            <Button
              variant="outline"
              size="sm"
              className="mt-2 self-start border-white/25 bg-transparent text-blush-50 hover:bg-white/10 hover:text-blush-50"
              onClick={() => {
                track("whatsapp_demo_interaction", { action: "replay" });
                play();
              }}
            >
              <RotateCcw className="size-4" /> Ver de novo
            </Button>
          </div>

          {/* A conversa */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#0b141a] shadow-2xl shadow-black/50">
              <header className="flex items-center gap-3 border-b border-white/10 bg-[#1f2c33] px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--wa)]/20 text-sm font-semibold text-[var(--wa)]">
                  A
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">Ana Beatriz</p>
                  <p className="text-xs text-white/45">online</p>
                </div>
                <Smartphone className="size-4 shrink-0 text-white/35" aria-hidden />
              </header>

              <div className="flex min-h-[19rem] flex-col justify-end gap-2 p-3">
                {THREAD.map((b, i) => (
                  <div
                    key={b.text}
                    data-shown={i < visibleBubbles || undefined}
                    className={cn(
                      "flex translate-y-2 opacity-0 transition-[opacity,transform] duration-500 ease-out",
                      "data-shown:translate-y-0 data-shown:opacity-100",
                      "motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
                      b.side === "us" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-[0.8125rem] leading-5",
                        b.side === "us"
                          ? "bg-[#005c4b] text-white"
                          : "bg-[#1f2c33] text-white"
                      )}
                    >
                      {b.automatic && (
                        <p className="mb-1 flex items-center gap-1 text-[0.6875rem] font-medium text-white/55">
                          <BellRing className="size-3" aria-hidden /> enviado pelo Timely
                        </p>
                      )}
                      <p>{b.text}</p>
                      <p className="mt-1 flex items-center justify-end gap-1 text-[0.625rem] text-white/45">
                        {b.time}
                        {b.side === "us" && <CheckCheck className="size-3 text-sky-400" />}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-3 text-center text-xs text-blush-50/45">
              Conversa demonstrativa, criada para esta página.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
