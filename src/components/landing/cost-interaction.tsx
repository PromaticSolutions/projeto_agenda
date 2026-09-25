"use client";

import { useId, useRef, useState } from "react";
import { Reveal } from "@/components/landing/reveal";
import { SignupButton } from "@/components/landing/signup-cta";
import { LEAD_HOURS_BANDS } from "@/lib/validation";
import { setHoursBand } from "@/components/landing/hours-band";
import { track } from "@/lib/analytics";
import { SectionHeading } from "@/components/landing/section-heading";

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
    <section className="band-dark relative overflow-hidden border-t border-white/10 bg-plum-900 py-24 text-blush-50 sm:py-32">
      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal sectionName="custo" className="max-w-2xl">
          <SectionHeading
            tone="dark"
            time="13:00"
            eyebrow="A conta"
            lead="Quanto tempo você perde"
            trail="organizando sua agenda?"
          />
          <p className="mt-5 text-[1.0625rem] leading-7 text-blush-50/70">
            Ajuste com a sua rotina. A conta é simples — e costuma surpreender.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-20">
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
            {/* Sem caixa: o número grande, preso a um fio vertical,
                é o resultado — como a soma no pé de uma coluna de caderno. */}
            <div className="border-l border-white/20 pl-8 sm:pl-10">
              <p className="time-label text-blush-50/60">Por semana</p>
              <p
                aria-live="polite"
                className="mt-2 text-[4.5rem] leading-[0.95] font-semibold tracking-[-0.04em] tabular-nums sm:text-[6rem]"
              >
                {formattedHours}
                <span className="text-[#c4b0fb]">h</span>
              </p>
              <p className="mt-5 max-w-sm text-[1.0625rem] leading-7 text-blush-50/80">
                organizando a agenda — o equivalente a{" "}
                <strong className="font-semibold text-blush-50">
                  ~{daysPerYear} dias de trabalho por ano
                </strong>
                .
              </p>
              <p className="time-label mt-3 max-w-sm leading-5 text-blush-50/55">
                Estimativa a partir dos números que você informou:{" "}
                {values.bookings} atendimentos × {values.perBooking + values.perConfirm} min,
                em jornadas de {HOURS_PER_WORKDAY}h.
              </p>

              <p className="mt-9 text-lg font-semibold">
                Imagine recuperar esse tempo.
              </p>
              <SignupButton from="custo" tone="light" className="mt-5 w-full sm:w-auto">
                Quero esse tempo de volta
              </SignupButton>
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
