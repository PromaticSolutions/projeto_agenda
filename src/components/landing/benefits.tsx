import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { SignupButton, TrialTerms } from "@/components/landing/signup-cta";

/**
 * Benefícios — o RESULTADO, antes da lista de funções.
 *
 * A seção de funcionalidades diz o que o sistema faz; esta diz por que isso
 * importa para quem atende. Cada título é algo que a pessoa sente no dia
 * (parar de responder a mesma pergunta, não esquecer ninguém), e o texto
 * embaixo amarra o resultado à função que o entrega — sem prometer nada que
 * o produto não faça: "menos esquecimento", não "zero faltas", porque o
 * lembrete ajuda a cliente a lembrar, mas ninguém mede aqui quem falta.
 *
 * Uma grade de fios, como a de uma tabela impressa: as células dividem as
 * bordas, então os seis itens leem como UM bloco, e não seis cartões soltos.
 */

const BENEFITS = [
  {
    title: "Pare de responder “tem horário?”",
    text: "Suas clientes veem os horários livres e marcam sozinhas pelo seu link, até de madrugada.",
  },
  {
    title: "Sua agenda sempre em ordem",
    text: "Tudo num lugar só, sem caderno, print ou planilha. Dois horários nunca se chocam.",
  },
  {
    title: "Menos esquecimento",
    text: "O lembrete sai sozinho pelo seu WhatsApp, na antecedência que você escolher.",
  },
  {
    title: "Atendimento mais pessoal",
    text: "Histórico e anotações de cada cliente à mão: preferências, alergias, o que ela fez da última vez.",
  },
  {
    title: "Uma página com a sua cara",
    text: "Seu link de agendamento leva o nome e a cor da sua marca, pronto para a bio do Instagram.",
  },
  {
    title: "Seu negócio no bolso",
    text: "Funciona no celular e no computador, direto no navegador. Nada para instalar.",
  },
];

export function Benefits() {
  return (
    <section id="beneficios" className="scroll-mt-16 border-b border-foreground/15 bg-muted py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal sectionName="beneficios" className="max-w-3xl">
          <SectionHeading
            time="12:00"
            eyebrow="Benefícios"
            lead="Menos tempo organizando."
            trail="Mais tempo atendendo."
          />
        </Reveal>

        {/* `gap-px` sobre o fundo da cor do fio: é o que desenha as divisórias
            internas com espessura exata de 1px, sem borda dupla onde duas
            células se encostam. */}
        <ul className="mt-14 grid gap-px overflow-hidden border-y border-foreground/80 bg-border sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(({ title, text }, i) => (
            <li key={title} className="bg-muted">
              <Reveal delay={(i % 3) * 80} className="flex h-full flex-col px-1 py-8 sm:px-8 sm:py-10">
                <span className="time-label tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-4 text-[1.1875rem] leading-snug font-semibold tracking-[-0.01em] text-balance text-foreground">
                  {title}
                </h3>
                <p className="mt-3 text-[0.9375rem] leading-6 text-muted-foreground">{text}</p>
              </Reveal>
            </li>
          ))}
        </ul>

        <Reveal className="mt-14 flex flex-col items-center gap-4 text-center">
          <SignupButton from="beneficios">Começar agora</SignupButton>
          <TrialTerms className="justify-center" />
        </Reveal>
      </div>
    </section>
  );
}
