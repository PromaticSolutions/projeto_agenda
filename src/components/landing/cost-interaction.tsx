"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/landing/reveal";
import { LEAD_HOURS_BANDS } from "@/lib/validation";
import { setHoursBand } from "@/components/landing/hours-band";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

/**
 * "Quanto isso custa?" — uma pergunta, um toque, um resultado.
 *
 * A versão anterior tinha três sliders e duas métricas. Virou uma escolha
 * entre quatro faixas: a interação precisa caber num toque no celular, e o
 * objetivo não é precisão — é a pessoa ver o número anual e pensar "é tudo
 * isso mesmo?".
 *
 * O resultado é só TEMPO. Multiplicar por um ticket médio que ninguém
 * informou produziria "R$ 4.200 por mês perdidos" — número inventado, e o
 * tipo de afirmação que destrói a confiança no resto da página.
 *
 * A faixa escolhida viaja para o formulário (`setHoursBand`), então a pessoa
 * não responde a mesma coisa duas vezes.
 */

const WEEKS_PER_YEAR = 52;

export function CostInteraction() {
  const [picked, setPicked] = useState<(typeof LEAD_HOURS_BANDS)[number] | null>(null);

  function choose(band: (typeof LEAD_HOURS_BANDS)[number]) {
    setPicked(band);
    setHoursBand(band.value);
    track("simulator_interaction", { band: band.value });
  }

  const daysPerYear = picked ? Math.round((picked.hoursPerWeek * WEEKS_PER_YEAR) / 8) : 0;

  return (
    <section className="border-b border-border bg-plum-900 py-20 text-blush-50 sm:py-24">
      <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
        <Reveal sectionName="custo">
          <h2 className="text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance sm:text-[2.25rem]">
            Quantas horas por semana você perde organizando sua agenda?
          </h2>
        </Reveal>

        <Reveal delay={80} className="mt-8">
          <div className="flex flex-wrap justify-center gap-2.5">
            {LEAD_HOURS_BANDS.map((band) => (
              <button
                key={band.value}
                type="button"
                aria-pressed={picked?.value === band.value}
                onClick={() => choose(band)}
                className={cn(
                  "rounded-lg border px-5 py-3 text-[0.9375rem] font-medium transition-colors",
                  picked?.value === band.value
                    ? "border-blush-50 bg-blush-50 text-plum-900"
                    : "border-white/25 text-blush-50 hover:bg-white/10"
                )}
              >
                {band.label}
              </button>
            ))}
          </div>
        </Reveal>

        {/* O resultado ocupa altura fixa e nasce invisível: sem isso a página
            "pula" quando a resposta aparece, bem embaixo do dedo que acabou
            de tocar. */}
        <div className="mt-10 min-h-[9.5rem]">
          <div
            data-shown={picked ? true : undefined}
            className={cn(
              "translate-y-2 opacity-0 transition-[opacity,transform] duration-500 ease-out",
              "data-shown:translate-y-0 data-shown:opacity-100",
              "motion-reduce:transition-none"
            )}
          >
            {picked && (
              <>
                <p className="font-mono text-[3.5rem] leading-none font-semibold text-blush-50 sm:text-[4.5rem]">
                  ~{daysPerYear}
                </p>
                <p className="mt-3 text-[1.0625rem] text-blush-50/80">
                  dias de trabalho por ano — só administrando a agenda.
                </p>
                <p className="mt-1.5 text-xs text-blush-50/45">
                  Estimativa aproximada: {picked.hoursPerWeek}h por semana em jornadas de 8h.
                </p>
                <Button
                  size="lg"
                  nativeButton={false}
                  className="mt-7 bg-blush-50 text-plum-900 hover:bg-white"
                  onClick={() => track("hero_cta_click", { target: "conhecer", from: "custo" })}
                  render={<a href="#conhecer" />}
                >
                  Quero esse tempo de volta <ArrowRight className="size-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
