import { CalendarX2, Clock3, MessageSquareDashed, NotebookPen, Repeat2, Wallet } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

/**
 * O problema, em seis frases curtas.
 *
 * A versão anterior tinha uma animação de mensagens chegando mais três cards
 * explicativos — bonito, e longo demais para o segundo bloco da página. Aqui
 * cada item é uma frase que a pessoa reconhece em menos de um segundo. O
 * reconhecimento não precisa de parágrafo; precisa de precisão.
 */

const SITUATIONS = [
  { Icon: MessageSquareDashed, text: "“Tem horário amanhã?” às onze da noite" },
  { Icon: Repeat2, text: "A mesma pergunta, cinco vezes por dia" },
  { Icon: NotebookPen, text: "Horários no caderno, no print e na memória" },
  { Icon: CalendarX2, text: "Faltou e não avisou — o horário ficou vazio" },
  { Icon: Clock3, text: "Encaixe que você só descobre que dá quando já passou" },
  { Icon: Wallet, text: "Fechar o mês contando na mão" },
];

export function Problem() {
  return (
    <section id="rotina" className="scroll-mt-16 border-b border-border bg-background py-20 sm:py-24">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <Reveal sectionName="rotina">
          <h2 className="max-w-2xl text-[2rem] leading-[1.12] font-semibold tracking-tight text-balance text-foreground sm:text-[2.5rem]">
            Sua agenda não deveria dar tanto trabalho.
          </h2>
        </Reveal>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SITUATIONS.map(({ Icon, text }, i) => (
            <Reveal key={text} delay={i * 60} className="h-full">
              <li className="panel card-lift flex h-full items-start gap-3 p-4">
                <Icon className="mt-0.5 size-4.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="text-[0.9375rem] leading-6 text-foreground">{text}</span>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
