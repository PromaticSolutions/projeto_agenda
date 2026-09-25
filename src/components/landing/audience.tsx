import { Clock3 } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { SignupButton } from "@/components/landing/signup-cta";

/**
 * "Para quem é" — quatro perfis lado a lado.
 *
 * Eram abas: um perfil por vez, com a demonstração trocando junto. Viraram
 * quatro cartões porque a pergunta que a seção responde é "isso é para mim?",
 * e ela se responde de relance quando a pessoa ACHA o próprio negócio na
 * fileira — com abas, três dos quatro perfis ficavam escondidos atrás de um
 * clique que ninguém dava.
 *
 * Cada cartão abre com a cor de um procedimento (as mesmas quatro das
 * prévias) em tom baixo, e fecha com a configuração daquele negócio: é a
 * duração de cada procedimento que muda de verdade entre uma barbearia e um
 * studio de cílios, e é ela que o sistema usa para calcular o encaixe (ver
 * `lib/availability.ts`) — a última linha de cada cartão mostra isso.
 *
 * Os valores são EXEMPLOS de configuração, rotulados como tal. Não são preço
 * médio de mercado nem pesquisa.
 *
 * "Equipe" ficou DE FORA de propósito: hoje o Timely trabalha com uma agenda
 * por conta (não há tabela de staff no banco). A nota no pé da seção diz isso
 * com todas as letras.
 */

/** Clínicas entram como "de estética": é o procedimento com horário marcado
 *  que o produto atende — não prontuário nem convênio. */
const SEGMENTS = ["Salões de beleza", "Barbearias", "Clínicas de estética", "Studios", "Profissionais autônomos"];

const PROFILES = [
  {
    tab: "Autônoma(o)",
    color: "var(--violet-600)",
    title: "Você, sozinha, atendendo onde faz sentido",
    text: "Em casa, em espaço compartilhado ou a domicílio: uma agenda, os seus procedimentos, o seu link.",
    services: [
      ["Design de sobrancelhas", "40 min", "R$ 60,00"],
      ["Manicure", "60 min", "R$ 45,00"],
      ["Pé e mão", "90 min", "R$ 70,00"],
    ],
    gap: ["16:20", "Design de sobrancelhas"],
  },
  {
    tab: "Salão de beleza",
    color: "var(--magenta)",
    title: "Procedimentos longos, sem buraco na agenda",
    text: "Uma coloração de duas horas não é tratada como uma escova de quarenta minutos.",
    services: [
      ["Escova", "45 min", "R$ 55,00"],
      ["Hidratação", "60 min", "R$ 120,00"],
      ["Coloração", "120 min", "R$ 180,00"],
    ],
    gap: ["15:00", "Escova"],
  },
  {
    tab: "Barbearia",
    color: "#0f766e",
    title: "Muito atendimento curto, um atrás do outro",
    text: "Quando o dia é feito de encaixes de trinta minutos, cada horário mal aproveitado pesa no fim do mês.",
    services: [
      ["Pezinho", "15 min", "R$ 20,00"],
      ["Barba", "30 min", "R$ 35,00"],
      ["Corte + barba", "70 min", "R$ 75,00"],
    ],
    gap: ["17:30", "Barba"],
  },
  {
    tab: "Studio",
    color: "#b45309",
    title: "Sessões longas e retorno marcado na hora",
    text: "Cílios, estética, micropigmentação: procedimento demorado e o histórico da cliente sempre à mão.",
    services: [
      ["Limpeza de pele", "60 min", "R$ 140,00"],
      ["Extensão de cílios", "120 min", "R$ 180,00"],
      ["Micropigmentação", "150 min", "R$ 450,00"],
    ],
    gap: ["14:00", "Limpeza de pele"],
  },
];

export function Audience() {
  return (
    <section id="para-quem" className="scroll-mt-16 border-b border-foreground/15 bg-muted py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal sectionName="para_quem" className="max-w-3xl">
          <SectionHeading
            time="15:00"
            eyebrow="Para quem é"
            lead="Feito para profissionais e pequenos negócios"
            trail="que trabalham com agendamento."
          />
          {/* Os segmentos por extenso, antes dos perfis: é a linha em que a
              pessoa procura o próprio negócio e pensa "é para mim". Texto
              corrido com barras, não pílulas — lê como frase, não como filtro. */}
          <ul
            className="mt-7 flex flex-wrap gap-x-3 gap-y-1 text-[1.0625rem] text-foreground"
            aria-label="Segmentos atendidos"
          >
            {SEGMENTS.map((segment, i) => (
              <li key={segment} className="flex items-center gap-3">
                {i > 0 && (
                  <span aria-hidden className="text-[var(--mark)]">
                    /
                  </span>
                )}
                {segment}
              </li>
            ))}
          </ul>
        </Reveal>

        {/* No celular os quatro perfis viram uma faixa de deslizar, com o
            próximo aparecendo na borda para mostrar que há mais; a partir de
            `sm` voltam a ser grade. O `pb` no celular é a folga da sombra, que
            o `overflow-x-auto` cortaria rente ao cartão. */}
        <ul className="-mx-4 mt-14 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pt-2 pb-10 [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
          {PROFILES.map((profile, i) => (
            <li key={profile.tab} className="w-[82%] shrink-0 snap-start sm:w-auto">
              <Reveal delay={i * 70} className="h-full">
                {/* Cartão elevado: faixa na cor do procedimento no topo (a
                    mesma marcação da agenda), o perfil, e embaixo a
                    configuração de exemplo num bloco à parte. */}
                <div className="card-elevated flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
                  <span aria-hidden className="h-1 shrink-0" style={{ backgroundColor: profile.color }} />
                  <div className="flex flex-1 flex-col p-5">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-foreground">
                      <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: profile.color }} />
                      {profile.tab}
                    </p>
                    <h3 className="mt-3 text-[1.1875rem] leading-snug font-semibold tracking-[-0.01em] text-balance text-foreground">
                      {profile.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{profile.text}</p>

                    <div className="mt-auto pt-5">
                      <p className="time-label">Exemplo de configuração</p>
                      <ol className="mt-2 rounded-lg border border-border bg-background/60 px-3">
                        {profile.services.map(([name, duration, price]) => (
                          <li key={name} className="flex items-start justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0">
                            <span className="min-w-0 leading-snug text-foreground">{name}</span>
                            <span className="shrink-0 text-right leading-snug">
                              <span className="block tabular-nums text-foreground">{price}</span>
                              <span className="block tabular-nums text-xs text-muted-foreground">{duration}</span>
                            </span>
                          </li>
                        ))}
                      </ol>
                      {/* É aqui que a duração deixa de ser enfeite: ela é o que o
                          sistema usa para dizer o que cabe no buraco. */}
                      <p className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
                        <Clock3 className="mt-0.5 size-3.5 shrink-0 text-[var(--mark)]" aria-hidden />
                        <span>
                          Livre às <span className="tabular-nums text-foreground">{profile.gap[0]}</span>: cabe{" "}
                          <span className="text-foreground">{profile.gap[1]}</span>
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>

        <Reveal delay={140} className="mt-14 flex flex-col gap-6 border-t border-foreground/80 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            Hoje o Timely trabalha com uma agenda por conta. Se o seu espaço tem
            várias pessoas atendendo em paralelo, essa divisão ainda não existe
            no sistema.
          </p>
          <SignupButton from="para_quem" className="self-start sm:self-auto">
            Começar grátis
          </SignupButton>
        </Reveal>
      </div>
    </section>
  );
}
