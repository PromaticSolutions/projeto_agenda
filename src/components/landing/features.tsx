"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Ban,
  BellRing,
  CalendarOff,
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  Paperclip,
  Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { SignupButton, TrialTerms } from "@/components/landing/signup-cta";
import { BOOKING_STATUS_DOT, BOOKING_STATUS_LABELS } from "@/lib/booking-status";
import type { BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * As funções, uma de cada vez.
 *
 * Foi uma grade de sete cartões. Virou carrossel porque sete miniaturas lado a
 * lado disputavam o olho ao mesmo tempo, e cada uma cabia pequena demais para
 * ser lida. Aqui cada função ganha a tela: o texto à esquerda (o que faz, e
 * três detalhes que a tela mostra) e a prévia à direita, em tamanho de ler.
 *
 * Três jeitos de navegar, porque cada um serve a uma pessoa: os nomes no alto
 * para quem já sabe o que procura, as setas para quem quer passar uma a uma, e
 * o avanço sozinho para quem só está rolando a página.
 *
 * O avanço automático segue as regras do carrossel do hero — pausa com o
 * ponteiro em cima, fora da tela, com a aba escondida e com
 * `prefers-reduced-motion` — e mais uma: PARA DE VEZ no primeiro clique. Quem
 * escolheu uma função está lendo, e trocar o texto debaixo dela seria tirar a
 * leitura da mão de quem pediu.
 *
 * Os slides ficam empilhados na mesma célula da grade e trocam por opacidade:
 * a altura é a do slide mais alto, então nada pula na troca.
 *
 * Mesma regra das prévias do hero: NADA aqui é screenshot. São os primitivos
 * do sistema (`panel`, `Badge`, os pontos de status de `lib/booking-status`)
 * montados com dados demonstrativos. Cada detalhe listado existe na tela
 * correspondente do painel.
 */

const FEATURES = [
  {
    id: "link",
    name: "Link de agendamento",
    title: "Seu link de agendamento",
    text: "A cliente escolhe o procedimento e o horário sozinha, a qualquer hora. Sem cadastro, sem senha, sem aplicativo.",
    details: [
      "Só aparecem horários livres, calculados pela duração do procedimento",
      "A cliente informa só o nome e o telefone",
      "A página leva o nome e a cor da sua marca",
    ],
    Visual: BookingLinkVisual,
  },
  {
    id: "lembrete",
    name: "Lembrete no WhatsApp",
    title: "Lembrete no seu WhatsApp",
    text: "Sai sozinho, do seu número, com a mensagem que você escreveu. Você não precisa lembrar de mandar.",
    details: [
      "Nove opções de antecedência, de 30 minutos a 1 semana",
      "Nome da cliente, procedimento, data e hora preenchidos sozinhos",
      "Dá para incluir um link, como o do seu Instagram",
    ],
    Visual: ReminderVisual,
  },
  {
    id: "agenda",
    name: "Agenda",
    title: "Agenda sem conflito",
    text: "Dois horários nunca ocupam o mesmo espaço. O sistema recusa antes de gravar.",
    details: [
      "Cada atendimento com a sua etapa: agendado, em atendimento, finalizado",
      "Marque na mão quem chegou por mensagem ou telefone",
      "Agenda do dia ou do mês em PDF",
    ],
    Visual: AgendaVisual,
  },
  {
    id: "clientes",
    name: "Clientes",
    title: "Suas clientes, com histórico",
    text: "Quem marca pelo link entra no cadastro. Da próxima vez você não pergunta o que ela fez na última visita.",
    details: [
      "Cadastro automático a cada agendamento",
      "Histórico de atendimentos de cada cliente",
      "Notas para alergias, preferências e cuidados",
    ],
    Visual: ClientVisual,
  },
  {
    id: "procedimentos",
    name: "Procedimentos",
    title: "Procedimentos com duração e valor",
    text: "É a duração que faz a agenda encaixar certo, em vez de chutar.",
    details: [
      "Duração e valor de cada procedimento",
      "Observações de preparo e contraindicações",
      "Fotos e PDFs anexados ao procedimento",
    ],
    Visual: ServicesVisual,
  },
  {
    id: "horarios",
    name: "Horários",
    title: "Horários, folgas e bloqueios",
    text: "Defina a sua semana uma vez. Bloqueou o dia, ninguém marca nele.",
    details: [
      "Vários períodos por dia, com pausa para o almoço",
      "Copie a segunda para os outros dias úteis em um clique",
      "Bloqueios para folga, feriado ou compromisso",
    ],
    Visual: HoursVisual,
  },
  {
    id: "conversas",
    name: "Conversas",
    title: "Conversas ao lado da agenda",
    text: "As mensagens do seu WhatsApp aparecem no painel. Você lê e responde sem trocar de aplicativo.",
    details: [
      "Mensagens não lidas em destaque",
      "Comece uma conversa com uma cliente cadastrada",
      "Traga as conversas que já estavam no seu WhatsApp",
    ],
    Visual: InboxVisual,
  },
];

const SLIDE_MS = 7000;

export function Features() {
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  // Três motivos independentes para parar; guardados à parte para que um não
  // desfaça a decisão do outro (mesma ideia do `hero-carousel.tsx`).
  const hovering = useRef(false);
  const visible = useRef(false);
  const stopped = useRef(false);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const sync = () =>
      setRunning(visible.current && !hovering.current && !stopped.current && !document.hidden);

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.isIntersecting;
        sync();
      },
      { threshold: 0.35 }
    );
    observer.observe(node);
    document.addEventListener("visibilitychange", sync);

    const hold = () => {
      hovering.current = true;
      sync();
    };
    const release = () => {
      hovering.current = false;
      sync();
    };
    node.addEventListener("pointerenter", hold);
    node.addEventListener("pointerleave", release);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      node.removeEventListener("pointerenter", hold);
      node.removeEventListener("pointerleave", release);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % FEATURES.length), SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [running, index]);

  // Mantém o nome ativo à vista na faixa de nomes, que rola de lado no
  // celular. `scrollTo` na própria faixa, e não `scrollIntoView`: este último
  // também rolaria a PÁGINA até o carrossel a cada troca automática.
  useEffect(() => {
    const list = tabsRef.current;
    const tab = list?.querySelectorAll<HTMLElement>('[role="tab"]')[index];
    if (!list || !tab) return;
    const left = tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2;
    list.scrollTo({ left, behavior: "smooth" });
  }, [index]);

  function select(next: number) {
    stopped.current = true;
    setRunning(false);
    setIndex((next + FEATURES.length) % FEATURES.length);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + FEATURES.length) % FEATURES.length;
    select(next);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  return (
    <section id="produto" className="scroll-mt-16 border-b border-foreground/15 bg-background py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal sectionName="produto" className="max-w-3xl">
          <SectionHeading
            time="11:00"
            eyebrow="O produto"
            lead="Veja o Timely por dentro."
            trail="É assim que o seu dia vai funcionar."
          />
        </Reveal>

        <Reveal delay={80} className="mt-12">
          {/* Nomes das funções. Rola de lado no celular em vez de quebrar em
              três linhas, que empurrariam a prévia para fora da tela. As
              bordas somem num degradê para mostrar que há mais para o lado. */}
          <div
            ref={tabsRef}
            role="tablist"
            aria-label="Funções do Timely"
            onKeyDown={handleKeyDown}
            className="relative -mx-4 flex gap-6 overflow-x-auto border-b border-foreground/80 px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:gap-x-7 sm:gap-y-0 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {FEATURES.map((f, i) => {
              const active = i === index;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  id={`funcao-tab-${f.id}`}
                  aria-selected={active}
                  aria-controls={`funcao-${f.id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => select(i)}
                  className={cn(
                    "-mb-px shrink-0 border-b-2 pt-1 pb-3 text-[0.9375rem] whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active
                      ? "border-[var(--mark)] text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.name}
                </button>
              );
            })}
          </div>

          <div ref={stageRef} className="grid">
            {FEATURES.map((f, i) => {
              const active = i === index;
              return (
                <div
                  key={f.id}
                  id={`funcao-${f.id}`}
                  role="tabpanel"
                  aria-labelledby={`funcao-tab-${f.id}`}
                  inert={!active}
                  className={cn(
                    "col-start-1 row-start-1 grid gap-8 py-10 transition-opacity duration-500 ease-out motion-reduce:transition-none sm:py-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-16 lg:py-14",
                    active ? "opacity-100" : "opacity-0"
                  )}
                >
                  <div className="flex flex-col">
                    <p className="time-label tabular-nums">
                      {String(i + 1).padStart(2, "0")} / {String(FEATURES.length).padStart(2, "0")}
                    </p>
                    <h3 className="mt-3 text-[1.625rem] leading-[1.15] font-semibold tracking-[-0.02em] text-balance text-foreground sm:text-[2rem]">
                      {f.title}
                    </h3>
                    <p className="mt-3 text-[1.0625rem] leading-7 text-muted-foreground">{f.text}</p>
                    <ul className="mt-6 flex flex-col gap-3">
                      {f.details.map((d) => (
                        <li key={d} className="flex items-baseline gap-3 border-t border-border pt-3 text-[0.9375rem] leading-6 text-foreground">
                          <span aria-hidden className="text-[var(--mark)]">—</span>
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg bg-muted/80 p-4 sm:p-8">
                    <div className="mx-auto w-full max-w-xl">
                      <f.Visual />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Controles: setas e a barra de progresso. A barra enche no tempo
              do avanço automático enquanto ele roda; parado, ela só marca a
              posição — é a mesma peça dizendo "falta pouco" ou "você está
              aqui", conforme o caso. */}
          <div className="flex items-center gap-4 border-t border-border pt-5">
            <div className="flex gap-2">
              <ArrowButton label="Função anterior" onClick={() => select(index - 1)}>
                <ChevronLeft className="size-5" aria-hidden />
              </ArrowButton>
              <ArrowButton label="Próxima função" onClick={() => select(index + 1)}>
                <ChevronRight className="size-5" aria-hidden />
              </ArrowButton>
            </div>
            <div aria-hidden className="flex flex-1 gap-1.5">
              {FEATURES.map((f, i) => (
                <span key={f.id} className="h-px flex-1 overflow-hidden bg-border">
                  <span
                    // `key` com o índice atual reinicia a animação a cada troca.
                    key={i === index ? `on-${index}-${running}` : "off"}
                    className={cn(
                      "block h-full bg-foreground",
                      i < index && "w-full",
                      i > index && "w-0",
                      i === index && (running ? "feature-progress" : "w-full")
                    )}
                    style={i === index && running ? { animationDuration: `${SLIDE_MS}ms` } : undefined}
                  />
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Primeira chamada do meio da página: logo depois de ver as telas, que
            é quando "será que serve para mim?" vira "quero testar". */}
        <Reveal className="mt-14 flex flex-col items-center gap-4 text-center">
          <SignupButton from="produto">Quero experimentar</SignupButton>
          <TrialTerms className="justify-center" />
        </Reveal>
      </div>
    </section>
  );
}

function ArrowButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-md border border-border text-foreground transition-colors duration-200 outline-none hover:border-foreground/40 hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------------ */

/* Sobre as cores das miniaturas: texto pequeno sobre fundo tingido da mesma
   cor (roxo sobre roxo a 10%, verde sobre verde a 15%) fica abaixo de 4,5:1
   com os tons de marca puros — medido. Por isso esses rótulos usam um passo
   mais escuro no claro (#0b6b37 no verde) e um mais claro no escuro
   (violet-300, emerald-300). O tingido do fundo continua o da marca. */

const SERVICE_CHOICES = [
  { name: "Design de sobrancelhas", meta: "40 min · R$ 60,00", selected: true },
  { name: "Design com henna", meta: "50 min · R$ 85,00", selected: false },
  { name: "Manicure", meta: "60 min · R$ 45,00", selected: false },
];

/** Só horários livres: o que está ocupado nem chega a aparecer no link. */
const FREE_SLOTS = ["09:00", "09:40", "10:20", "14:00", "14:40", "15:20", "16:00", "16:40"];

function BookingLinkVisual() {
  return (
    <div aria-hidden className="panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Lock className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs text-muted-foreground">
          seu link / <span className="text-foreground">studio-aurora</span>
        </span>
      </div>

      <div className="grid gap-5 p-4 sm:grid-cols-2 sm:gap-6 sm:p-5">
        <div>
          <p className="section-label">Escolha seu serviço</p>
          <ul className="mt-3 flex flex-col gap-2">
            {SERVICE_CHOICES.map((s) => (
              <li
                key={s.name}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                  s.selected ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border",
                    s.selected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                  )}
                >
                  {s.selected && <Check className="size-2.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{s.name}</span>
                  <span className="block tabular-nums text-xs text-muted-foreground">{s.meta}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col">
          <p className="section-label">Data e horário</p>
          <p className="mt-3 text-sm font-medium text-foreground">Quarta, 9 de setembro</p>
          <ul className="mt-2.5 grid grid-cols-4 gap-1.5">
            {FREE_SLOTS.map((slot) => {
              const picked = slot === "14:40";
              return (
                <li
                  key={slot}
                  className={cn(
                    "rounded-md border py-1.5 text-center tabular-nums text-xs",
                    picked
                      ? "border-primary bg-primary font-semibold text-primary-foreground"
                      : "border-border bg-card text-foreground"
                  )}
                >
                  {slot}
                </li>
              );
            })}
          </ul>
          <span className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground sm:mt-auto">
            Confirmar agendamento <ArrowRight className="size-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * O modelo com os marcadores, e a mensagem que ele vira. Os marcadores e os
 * valores de exemplo são os de `reminder-settings-form.tsx` — a mesma prévia
 * que a pessoa vê quando configura o lembrete.
 */
const TEMPLATE: (string | { tag: string })[] = [
  "Olá ",
  { tag: "{cliente}" },
  "! Confirmando seu horário de ",
  { tag: "{servico}" },
  " em ",
  { tag: "{data}" },
  " às ",
  { tag: "{hora}" },
  ".",
];

function ReminderVisual() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <div className="panel flex items-center justify-between gap-3 px-3.5 py-2.5">
        <span className="text-xs text-muted-foreground">Antecedência</span>
        <span className="text-sm font-medium text-foreground">1 dia antes</span>
      </div>

      <p className="panel px-3.5 py-3 text-[0.8125rem] leading-6 text-foreground">
        {TEMPLATE.map((part, i) =>
          typeof part === "string" ? (
            <span key={i}>{part}</span>
          ) : (
            <span key={i} className="rounded bg-primary/10 px-1 py-0.5 font-mono text-[0.6875rem] text-primary dark:text-violet-300">
              {part.tag}
            </span>
          )
        )}
      </p>

      <div className="max-w-[92%] self-end rounded-lg rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[0.8125rem] leading-5 text-[#111b21] dark:bg-[#005c4b] dark:text-white">
        <p className="mb-0.5 flex items-center gap-1 text-[0.625rem] font-medium opacity-60">
          <BellRing className="size-2.5" /> enviado pelo Timely
        </p>
        Olá Marina! Confirmando seu horário de Design de Sobrancelhas em 12/09 às 14:30.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

const DAY: { start: string; client: string; service: string; status: BookingStatus }[] = [
  { start: "09:00", client: "Ana Beatriz", service: "Design de sobrancelhas", status: "finalizado" },
  { start: "11:00", client: "Carla Souza", service: "Manicure", status: "em_atendimento" },
  { start: "14:00", client: "Juliana Melo", service: "Coloração", status: "agendado" },
];

function AgendaVisual() {
  return (
    <div aria-hidden className="panel overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-2.5">
        <p className="text-sm font-medium text-foreground">Terça, 8 de setembro</p>
        <Badge variant="secondary" className="tabular-nums">3</Badge>
      </header>
      <ol className="divide-y divide-border">
        {DAY.map((b) => (
          <li key={b.start} className="flex items-center gap-3 px-3.5 py-2.5">
            <time className="w-10 shrink-0 text-sm font-semibold text-foreground">{b.start}</time>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">{b.client}</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("size-1.5 shrink-0 rounded-full", BOOKING_STATUS_DOT[b.status])} />
                <span className="truncate">{BOOKING_STATUS_LABELS[b.status]}</span>
              </span>
            </span>
          </li>
        ))}
      </ol>
      {/* A tentativa recusada é o argumento do cartão: o horário das 14:00
          vai até as 16:00, e um segundo pedido às 14:30 não entra. */}
      <div className="flex items-center gap-2 border-t border-dashed border-border bg-muted/50 px-3.5 py-2.5 text-xs text-muted-foreground">
        <Ban className="size-3.5 shrink-0 text-destructive" />
        <span>
          <span className="tabular-nums">14:30</span> recusado: horário ocupado
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function ClientVisual() {
  return (
    <div aria-hidden className="panel grid gap-5 p-4 sm:grid-cols-[1fr_0.9fr] sm:p-5">
      <div>
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary dark:text-violet-300">
            AB
          </span>
          <div className="min-w-0">
            <p className="font-medium text-foreground">Ana Beatriz</p>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Phone className="size-3.5 shrink-0" />
              <span className="tabular-nums">(11) 9••••-4821</span>
            </p>
          </div>
        </div>
        <p className="section-label mt-5">Últimos atendimentos</p>
        <ul className="mt-2.5 flex flex-col gap-2">
          {[
            ["08/09", "Design de sobrancelhas"],
            ["11/08", "Design com henna"],
            ["14/07", "Design de sobrancelhas"],
          ].map(([date, service]) => (
            <li key={date} className="flex items-baseline gap-3 text-sm">
              <span className="shrink-0 tabular-nums text-muted-foreground">{date}</span>
              <span className="min-w-0 truncate text-foreground">{service}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-3.5">
        <p className="section-label">Notas</p>
        <p className="mt-2 text-sm leading-6 text-foreground">
          Sensível à henna: fazer teste antes. Prefere horários de manhã.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function ServicesVisual() {
  return (
    <ol aria-hidden className="panel divide-y divide-border overflow-hidden">
      {[
        ["Design de sobrancelhas", "40 min", "R$ 60,00", "var(--violet-600)", true],
        ["Coloração", "120 min", "R$ 180,00", "var(--magenta)", false],
        ["Escova", "45 min", "R$ 55,00", "#0f766e", false],
      ].map(([name, duration, price, color, attachments]) => (
        <li key={name as string} className="px-3.5 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color as string }} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{name}</span>
            <span className="shrink-0 tabular-nums text-sm text-foreground">{price}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 pl-[1.125rem] text-xs text-muted-foreground">
            <span className="tabular-nums">{duration}</span>
            {attachments && (
              <span className="flex items-center gap-1">
                <Paperclip className="size-3" /> 2 fotos · 1 PDF
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------------ */

const WEEK_HOURS: { day: string; periods: string[] | null; blocked?: string }[] = [
  { day: "Seg", periods: ["09–12", "13–18"] },
  { day: "Ter", periods: ["09–12", "13–18"] },
  { day: "Qua", periods: ["09–12", "13–18"] },
  { day: "Qui", periods: null, blocked: "Folga" },
  { day: "Sex", periods: ["09–12", "13–18"] },
  { day: "Sáb", periods: ["09–14"] },
];

function HoursVisual() {
  return (
    <ul aria-hidden className="panel divide-y divide-border overflow-hidden">
      {WEEK_HOURS.map((d) => (
        <li key={d.day} className="flex items-center gap-3 px-3.5 py-2">
          <span className="w-8 shrink-0 text-xs font-medium text-muted-foreground">{d.day}</span>
          {d.periods ? (
            <span className="flex flex-wrap gap-1.5">
              {d.periods.map((p) => (
                <span key={p} className="rounded-md bg-primary/10 px-2 py-0.5 tabular-nums text-xs font-medium text-primary dark:text-violet-300">
                  {p}h
                </span>
              ))}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-md border border-dashed border-input px-2 py-0.5 text-xs text-muted-foreground">
              <CalendarOff className="size-3" /> {d.blocked}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------------ */

const THREADS = [
  { initials: "MR", name: "Marina Rocha", last: "Consigo remarcar para sexta?", time: "10:42", unread: 2 },
  { initials: "AB", name: "Ana Beatriz", last: "Confirmado! Chego 10 min antes", time: "09:15", unread: 0 },
  { initials: "CS", name: "Carla Souza", last: "Você: Te espero às 11h 😊", time: "ontem", unread: 0 },
];

function InboxVisual() {
  return (
    <ul aria-hidden className="panel divide-y divide-border overflow-hidden">
      {THREADS.map((t) => (
        <li key={t.name} className="flex items-center gap-3 px-3.5 py-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-wa/15 text-[0.6875rem] font-semibold text-[#0b6b37] dark:text-emerald-300">
            {t.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className={cn("truncate text-sm text-foreground", t.unread > 0 && "font-semibold")}>
                {t.name}
              </span>
              <span className="shrink-0 tabular-nums text-[0.6875rem] text-muted-foreground">{t.time}</span>
            </span>
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">{t.last}</span>
              {t.unread > 0 && (
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[#0b6b37] text-[0.625rem] font-semibold text-white">
                  {t.unread}
                </span>
              )}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
