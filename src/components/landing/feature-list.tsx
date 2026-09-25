import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";

/**
 * Funcionalidades — a lista completa, curta de propósito.
 *
 * O carrossel do produto já MOSTROU as telas; aqui é o inventário para quem
 * quer conferir "tem isso?" antes de decidir. Um nome e uma linha por item,
 * sem prévia: repetir as miniaturas deixaria a página duas vezes mais longa
 * para dizer a mesma coisa.
 *
 * Desenhado como índice — nome à esquerda, descrição à direita, um
 * fio por linha. É a forma de "inventário" que a pessoa já conhece de um
 * sumário ou de uma tabela de preços, e dispensa o ícone ao lado de cada item.
 *
 * Cada item corresponde a uma tela do painel (ver `dashboard-shell.tsx`) ou
 * da página pública. Relatório de faturamento e importação de clientes NÃO
 * estão na lista porque não existem no sistema.
 */

const ITEMS = [
  { name: "Agenda online", text: "Seu dia, sua semana e cada atendimento com a sua etapa." },
  { name: "Link de agendamento", text: "Sua página para a cliente marcar sozinha, sem cadastro." },
  { name: "Lembretes no WhatsApp", text: "Enviados do seu número, com a sua mensagem." },
  { name: "Conversas", text: "As mensagens do WhatsApp no painel, ao lado da agenda." },
  { name: "Clientes", text: "Cadastro automático, histórico e anotações de cada uma." },
  { name: "Procedimentos", text: "Duração, valor, observações, fotos e PDFs." },
  { name: "Horários e bloqueios", text: "Sua semana de trabalho, folgas e feriados." },
  { name: "Agenda em PDF", text: "O dia ou o mês inteiro, para imprimir ou guardar." },
  { name: "Privacidade (LGPD)", text: "Pedidos de dados das clientes organizados no painel." },
];

export function FeatureList() {
  return (
    <section id="funcoes" className="scroll-mt-16 border-b border-foreground/15 bg-background py-24 sm:py-32">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-20">
        <Reveal sectionName="funcoes" className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            time="14:00"
            eyebrow="Funcionalidades"
            lead="Tudo o que a sua agenda precisa,"
            trail="num só lugar."
          />
        </Reveal>

        <ul className="border-t border-foreground/80">
          {ITEMS.map(({ name, text }, i) => (
            <li key={name} className="border-b border-border">
              <Reveal
                delay={(i % 3) * 50}
                className="grid gap-1 py-5 sm:grid-cols-[2.5rem_minmax(0,15rem)_minmax(0,1fr)] sm:items-baseline sm:gap-6"
              >
                <span className="time-label hidden tabular-nums sm:block">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-[1.0625rem] leading-snug font-semibold text-foreground">
                  {name}
                </h3>
                <p className="text-[0.9375rem] leading-6 text-muted-foreground">{text}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
