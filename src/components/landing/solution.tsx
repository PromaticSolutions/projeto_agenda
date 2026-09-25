import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";

/**
 * A solução, em três passos — logo depois do problema.
 *
 * Numerados porque SÃO uma sequência: é a ordem real de uso do produto
 * (cadastrar, divulgar, receber). O terceiro passo é o que responde ao
 * problema da seção de cima: tudo o que ela fazia à mão passa a acontecer
 * sozinho. A demonstração do WhatsApp logo abaixo mostra esse passo rodando.
 *
 * Três colunas separadas por fio, com o numeral grande fazendo o
 * papel que o ícone fazia — o número É a informação (a ordem), o ícone era
 * só enfeite.
 */

const STEPS = [
  {
    title: "Cadastre seus procedimentos e horários",
    text: "Com a duração e o valor de cada um. Você faz uma vez só, em poucos minutos.",
  },
  {
    title: "Compartilhe o seu link",
    text: "Na bio do Instagram, no WhatsApp, onde a sua cliente estiver. Ela marca sozinha, a qualquer hora.",
  },
  {
    title: "O resto acontece sozinho",
    text: "O horário entra na agenda sem conflito, a cliente vai para o cadastro e o lembrete sai pelo seu WhatsApp.",
  },
];

export function Solution() {
  return (
    <section id="como-funciona" className="scroll-mt-16 border-b border-foreground/15 bg-muted py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal sectionName="solucao" className="max-w-3xl">
          <SectionHeading
            time="09:00"
            eyebrow="Como o Timely resolve"
            lead="O Timely organiza isso para você."
            trail="Em três passos."
          />
        </Reveal>

        <ol className="mt-16 grid border-t border-foreground/80 md:grid-cols-3">
          {STEPS.map(({ title, text }, i) => (
            <li
              key={title}
              className="border-b border-border py-8 md:border-b-0 md:px-8 md:py-10 md:first:pl-0 md:last:pr-0 md:not-first:border-l"
            >
              <Reveal delay={i * 90}>
                <span
                  aria-hidden
                  className="block text-[3rem] leading-none font-semibold tracking-tight text-[var(--mark)] tabular-nums"
                >
                  {i + 1}
                </span>
                <h3 className="mt-6 text-[1.125rem] leading-snug font-semibold text-foreground">
                  <span className="sr-only">Passo {i + 1}: </span>
                  {title}
                </h3>
                <p className="mt-2 text-[0.9375rem] leading-6 text-muted-foreground">{text}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
