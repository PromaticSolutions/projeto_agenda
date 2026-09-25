import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";

/**
 * O problema, em seis frases curtas.
 *
 * Cada item é uma frase que a pessoa reconhece em menos de um segundo — o
 * reconhecimento não precisa de parágrafo, precisa de precisão.
 *
 * Linhas de caderno, não cartões: é literalmente o caderno que ela usa hoje.
 * Número na margem, a frase, um fio embaixo. Sem ícone —
 * um ícone genérico ao lado de cada frase era o que fazia a lista parecer
 * gerada.
 */

const SITUATIONS = [
  "“Tem horário amanhã?” às onze da noite",
  "A mesma pergunta, cinco vezes por dia",
  "Horários no caderno, no print e na memória",
  "Faltou e não avisou — o horário ficou vazio",
  "Encaixe que você só descobre que dá quando já passou",
  "Não lembrar o que a cliente fez da última vez",
];

export function Problem() {
  return (
    <section id="rotina" className="scroll-mt-16 border-b border-foreground/15 bg-background py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal sectionName="rotina" className="max-w-3xl">
          <SectionHeading
            time="08:30"
            eyebrow="A rotina"
            lead="Você ainda gerencia seus atendimentos"
            trail="assim?"
          />
        </Reveal>

        <ol className="mt-14 grid border-t border-foreground/80 md:grid-cols-2 md:gap-x-12">
          {SITUATIONS.map((text, i) => (
            <li key={text} className="border-b border-border">
              <Reveal delay={(i % 2) * 60} className="flex items-baseline gap-5 py-5">
                <span className="time-label w-6 shrink-0 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[1.0625rem] leading-snug font-medium text-foreground sm:text-[1.1875rem]">
                  {text}
                </span>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
