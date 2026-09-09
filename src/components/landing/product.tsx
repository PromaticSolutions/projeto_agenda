import { Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/landing/reveal";

/**
 * O produto em três momentos — cada um com interface de verdade ao lado.
 *
 * A versão anterior tinha sete cards de texto descrevendo sete telas. Virou
 * três blocos onde o argumento é a INTERFACE, e o texto é uma linha. É a
 * diferença entre "o sistema possui cadastro de clientes" e ver a ficha da
 * cliente com o histórico dentro.
 *
 * O TÍTULO FICA PARADO enquanto os três momentos passam por ele (no desktop,
 * via `position: sticky`). É o que transforma três blocos soltos numa
 * sequência: a pergunta "o que cabe em uma tela?" continua à vista enquanto
 * as respostas desfilam. Custa uma propriedade de CSS e zero JavaScript —
 * e no celular, onde não há coluna para segurar, simplesmente não se aplica.
 *
 * Nada aqui é screenshot: são os primitivos do sistema (`panel`, `Badge`,
 * fonte mono para dado tabular) montados com dados demonstrativos. Acompanha
 * o tema, não desalinha quando a interface real mudar, e não pesa como PNG.
 */

export function Product() {
  return (
    <section id="como-funciona" className="scroll-mt-16 border-b border-border bg-background py-20 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
          <Reveal sectionName="produto" className="lg:sticky lg:top-28 lg:self-start">
            <p className="section-label text-primary">O produto</p>
            <h2 className="mt-3 text-[2rem] leading-[1.12] font-semibold text-balance text-foreground sm:text-[2.5rem]">
              O seu dia inteiro em uma tela.
            </h2>
            <p className="mt-4 text-[1.0625rem] leading-7 text-muted-foreground">
              Agenda, clientes e procedimentos são a mesma coisa vista de três
              ângulos — não três programas que você precisa manter em dia.
            </p>
          </Reveal>

          <div className="flex flex-col gap-14 sm:gap-20">
            <Moment
              title="Sua agenda, sem conflito"
              text="Dois horários nunca ocupam o mesmo espaço — o sistema recusa antes de gravar."
              visual={<AgendaVisual />}
            />
            <Moment
              title="Suas clientes, com histórico"
              text="Da próxima vez você não pergunta o que ela fez na última visita."
              visual={<ClientVisual />}
            />
            <Moment
              title="Procedimentos com duração e valor"
              text="É a duração que faz a agenda calcular o encaixe certo, em vez de chutar."
              visual={<ServicesVisual />}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Moment({
  title,
  text,
  visual,
}: {
  title: string;
  text: string;
  visual: React.ReactNode;
}) {
  return (
    <Reveal>
      <h3 className="text-[1.25rem] leading-snug font-semibold tracking-tight text-balance text-foreground sm:text-[1.375rem]">
        {title}
      </h3>
      <p className="mt-2 text-[1.0625rem] leading-7 text-muted-foreground">{text}</p>
      <div className="mt-6">{visual}</div>
    </Reveal>
  );
}

const SLOTS = [
  {
    start: "09:00",
    end: "10:30",
    service: "Design de sobrancelhas",
    client: "Ana Beatriz",
    price: "R$ 60,00",
    status: "Confirmado",
    color: "var(--violet-600)",
  },
  {
    start: "11:00",
    end: "12:00",
    service: "Manicure",
    client: "Carla Souza",
    price: "R$ 45,00",
    status: "Confirmado",
    color: "var(--magenta)",
  },
  {
    start: "14:00",
    end: "16:00",
    service: "Coloração",
    client: "Juliana Melo",
    price: "R$ 180,00",
    status: "Aguardando",
    color: "#0f766e",
  },
];

function AgendaVisual() {
  return (
    <div className="panel overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="font-medium text-foreground">Terça, 8 de setembro</p>
        <Badge variant="secondary" className="tabular-nums">3 horários</Badge>
      </header>
      <ol className="divide-y divide-border">
        {SLOTS.map((s) => (
          <li key={s.start} className="relative flex items-center gap-3 py-3 pr-4 pl-4">
            <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: s.color }} />
            <div className="w-14 shrink-0">
              <time className="block tabular-nums text-sm font-semibold text-foreground">{s.start}</time>
              <span className="tabular-nums text-xs text-muted-foreground">{s.end}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{s.client}</p>
              <p className="truncate text-xs text-muted-foreground">{s.service}</p>
            </div>
            {/* Valor e situação à direita, na mesma coluna: é onde o olho vai
                quando a pergunta é "quanto rendeu o dia?" — e é assim que a
                lista aparece no painel. */}
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="tabular-nums text-sm text-foreground">{s.price}</span>
              <span
                className={
                  s.status === "Confirmado"
                    ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                    : "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
                }
              >
                {s.status}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <footer className="flex items-center justify-between gap-3 border-t border-border bg-muted/50 px-4 py-3 text-sm">
        <span className="text-muted-foreground">Previsto no dia</span>
        <span className="tabular-nums font-medium text-foreground">R$ 285,00</span>
      </footer>
    </div>
  );
}

function ClientVisual() {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 tabular-nums text-sm font-semibold text-primary">
          AB
        </span>
        <div className="min-w-0">
          <p className="font-medium text-foreground">Ana Beatriz</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone className="size-3.5 shrink-0" aria-hidden />
            <span className="tabular-nums">(11) 9••••-4821</span>
          </p>
        </div>
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <p className="section-label text-muted-foreground">Últimos atendimentos</p>
        <ul className="mt-3 flex flex-col gap-2.5">
          {[
            ["08/09", "Design de sobrancelhas", "R$ 60,00"],
            ["11/08", "Design + henna", "R$ 85,00"],
            ["14/07", "Design de sobrancelhas", "R$ 60,00"],
          ].map(([date, service, price]) => (
            <li key={date} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="shrink-0 tabular-nums text-muted-foreground">{date}</span>
              <span className="min-w-0 flex-1 truncate text-foreground">{service}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{price}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* O próximo horário fecha a ficha: é a informação que faz a pessoa
          abrir o cadastro da cliente no meio do atendimento. */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
        <span className="text-muted-foreground">Próximo horário</span>
        <span className="tabular-nums font-medium text-foreground">06/10 · 09:00</span>
      </div>
    </div>
  );
}

function ServicesVisual() {
  return (
    <div className="panel overflow-hidden">
      <ol className="divide-y divide-border">
        {[
          ["Design de sobrancelhas", "40 min", "R$ 60,00", "var(--violet-600)"],
          ["Manicure", "60 min", "R$ 45,00", "var(--magenta)"],
          ["Coloração", "120 min", "R$ 180,00", "#0f766e"],
          ["Escova", "45 min", "R$ 55,00", "#b45309"],
        ].map(([name, duration, price, color]) => (
          <li key={name} className="flex items-center gap-3 px-4 py-3">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{name}</span>
            <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{duration}</span>
            <span className="w-20 shrink-0 text-right tabular-nums text-sm text-foreground">{price}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
