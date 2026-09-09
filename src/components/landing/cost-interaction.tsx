"use client";

import { useId, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/landing/reveal";
import { LEAD_HOURS_BANDS } from "@/lib/validation";
import { setHoursBand } from "@/components/landing/hours-band";
import { track } from "@/lib/analytics";
import { GlassKnotBackdrop } from "@/components/auth/glass-knot";

/**
 * "Quanto tempo você perde organizando sua agenda?"
 *
 * Três controles e um número. A pessoa mexe porque QUER ver o resultado —
 * e é por isso que esta é a única "pergunta" antes do formulário que vale a
 * pena fazer: a resposta é dela, não nossa.
 *
 * O resultado é só TEMPO. Multiplicar por um ticket médio que ninguém
 * informou produziria "R$ 4.200 por mês perdidos" — número inventado, e o
 * tipo de afirmação que destrói a confiança no resto da página. Pelo mesmo
 * motivo o texto diz "estimativa" e mostra a conta: são os números QUE ELA
 * informou, multiplicados; não uma medição nossa do mercado.
 *
 * `<input type="range">` nativo em vez de um slider de biblioteca: vem com
 * teclado (setas, Home/End), leitor de tela e toque resolvidos, pesa zero no
 * bundle, e `accent-color` já o pinta com a cor da marca.
 *
 * A faixa calculada viaja para o formulário (`setHoursBand`), então a pessoa
 * não responde a mesma coisa duas vezes lá embaixo.
 */

const WEEKS_PER_YEAR = 52;
const HOURS_PER_WORKDAY = 8;

/** Os três controles. `step` acompanha a granularidade que a pessoa percebe. */
const SLIDERS = [
  {
    key: "bookings" as const,
    label: "Atendimentos por semana",
    min: 5,
    max: 80,
    step: 5,
    initial: 25,
    unit: (v: number) => `${v}`,
  },
  {
    key: "perBooking" as const,
    label: "Minutos para marcar cada horário",
    hint: "Achar a mensagem, conferir se cabe, anotar.",
    min: 1,
    max: 15,
    step: 1,
    initial: 4,
    unit: (v: number) => `${v} min`,
  },
  {
    key: "perConfirm" as const,
    label: "Minutos confirmando cada cliente",
    hint: "Lembrar, mandar, esperar a resposta, remarcar quem sumiu.",
    min: 0,
    max: 10,
    step: 1,
    initial: 3,
    unit: (v: number) => `${v} min`,
  },
];

type Values = { bookings: number; perBooking: number; perConfirm: number };

const INITIAL: Values = {
  bookings: 25,
  perBooking: 4,
  perConfirm: 3,
};

/**
 * A faixa correspondente ao resultado, para viajar junto com o lead.
 *
 * Os limites são derivados de `LEAD_HOURS_BANDS`, não escritos à mão: é a
 * mesma lista que o Zod da rota usa como enum, e uma string inventada aqui
 * seria recusada na gravação — silenciosamente, porque o campo é opcional.
 */
function bandFor(hoursPerWeek: number): string {
  const UPPER_LIMITS = [2, 5, 10];
  const index = UPPER_LIMITS.findIndex((limit) => hoursPerWeek <= limit);
  return LEAD_HOURS_BANDS[index === -1 ? LEAD_HOURS_BANDS.length - 1 : index].value;
}

export function CostInteraction() {
  const [values, setValues] = useState<Values>(INITIAL);
  const touched = useRef(false);

  const minutesPerWeek = values.bookings * (values.perBooking + values.perConfirm);
  const hoursPerWeek = minutesPerWeek / 60;
  const daysPerYear = Math.round((hoursPerWeek * WEEKS_PER_YEAR) / HOURS_PER_WORKDAY);

  function change(key: keyof Values, value: number) {
    setValues((current) => ({ ...current, [key]: value }));

    // A faixa só é registrada depois que a pessoa MEXE. Gravar o resultado
    // dos valores iniciais seria atribuir a ela uma resposta que ela não deu.
    const next = { ...values, [key]: value };
    const band = bandFor((next.bookings * (next.perBooking + next.perConfirm)) / 60);
    setHoursBand(band);

    if (!touched.current) {
      touched.current = true;
      track("simulator_interaction", { band });
    }
  }

  // Uma casa decimal só quando ela diz algo: "2,5h" informa, "3,0h" polui.
  const formattedHours = hoursPerWeek
    .toFixed(hoursPerWeek < 10 ? 1 : 0)
    .replace(".0", "")
    .replace(".", ",");

  return (
    <section className="relative overflow-hidden border-b border-border bg-plum-900 py-20 text-blush-50 sm:py-24">
      {/* A mesma peça do hero, girando ao fundo. Duas diferenças, e as duas
          existem pelo mesmo motivo: aqui ela é fundo de uma faixa de conteúdo,
          não a abertura da página. Menor (`scale`) e deslocada para o vazio
          entre o fim do título e o topo do cartão (`focus*`) — centralizada e
          no tamanho do hero, ela passava por baixo dos valores dos controles,
          e vidro atrás de número é número que não se lê. */}
      <GlassKnotBackdrop scale={0.7} focusX={0.8} focusY={0.26} portraitX={0.72} portraitY={0.985} />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 sm:px-6">
        <Reveal sectionName="custo" className="max-w-2xl">
          <h2 className="text-[1.75rem] leading-[1.15] font-semibold text-balance sm:text-[2.25rem]">
            Quanto tempo você perde organizando sua agenda?
          </h2>
          <p className="mt-4 text-[1.0625rem] leading-7 text-blush-50/70">
            Ajuste com a sua rotina. A conta é simples — e costuma surpreender.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
          <Reveal className="flex flex-col gap-8">
            {SLIDERS.map((slider) => (
              <Slider
                key={slider.key}
                label={slider.label}
                hint={slider.hint}
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={values[slider.key]}
                display={slider.unit(values[slider.key])}
                onChange={(v) => change(slider.key, v)}
              />
            ))}
          </Reveal>

          {/* O resultado tem altura própria e não depende de interação para
              existir: nasce calculado com valores comuns, então ninguém
              precisa mexer para entender o que a seção faz. */}
          <Reveal delay={90}>
            <div className="rounded-xl border border-white/15 bg-white/5 p-7 text-center sm:p-9">
              <p className="section-label text-blush-50/60">Por semana</p>
              <p
                aria-live="polite"
                // Sem `tabular-nums` neste número: em corpo 64 a mono reserva
                // uma célula inteira para a vírgula, e "2,9h" sai lido como
                // "2 , 9h". `tabular-nums` mantém o alinhamento dos dígitos
                // enquanto a pessoa arrasta os controles, que é o motivo real
                // de a mono estar em todo dado tabular do sistema.
                className="mt-3 text-[3.25rem] leading-none font-semibold tracking-tight tabular-nums sm:text-[4rem]"
              >
                {formattedHours}h
              </p>
              <p className="mt-4 text-[1.0625rem] leading-7 text-blush-50/80">
                organizando a agenda — o equivalente a{" "}
                <strong className="font-semibold text-blush-50">
                  ~{daysPerYear} dias de trabalho por ano
                </strong>
                .
              </p>
              <p className="mt-3 text-xs leading-5 text-blush-50/45">
                Estimativa a partir dos números que você informou:{" "}
                {values.bookings} atendimentos × {values.perBooking + values.perConfirm} min,
                em jornadas de {HOURS_PER_WORKDAY}h.
              </p>

              <p className="mt-7 border-t border-white/10 pt-6 text-[1.0625rem] font-medium">
                Imagine recuperar esse tempo.
              </p>
              <Button
                size="lg"
                nativeButton={false}
                className="mt-5 w-full bg-blush-50 text-plum-900 hover:bg-white sm:w-auto"
                onClick={() => track("hero_cta_click", { target: "conhecer", from: "custo" })}
                render={<a href="#conhecer" />}
              >
                Quero esse tempo de volta <ArrowRight className="size-4" />
              </Button>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Slider({
  label,
  hint,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (value: number) => void;
}) {
  const id = useId();

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-[0.9375rem] font-medium">
          {label}
        </label>
        <output htmlFor={id} className="shrink-0 tabular-nums text-lg font-semibold">
          {display}
        </output>
      </div>
      {hint && <p className="mt-1 text-xs leading-5 text-blush-50/50">{hint}</p>}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-6 w-full cursor-pointer accent-[var(--blush-50)]"
      />
    </div>
  );
}
