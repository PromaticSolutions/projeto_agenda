import {
  BellRing,
  CalendarDays,
  CalendarRange,
  Check,
  Clock,
  Scissors,
  Users,
} from "lucide-react";
import { Seal } from "@/components/landing/seal";
import { cn } from "@/lib/utils";

/**
 * O segundo slide do hero: o painel do dia aberto num celular.
 *
 * Mesma regra do `agenda-preview.tsx` — NÃO é screenshot. A moldura é HTML e o
 * que está dentro dela é a anatomia real de `app/(dashboard)/page.tsx`: a
 * navegação em linha (que no celular é horizontal, `flex-row md:flex-col` no
 * `dashboard-shell`), o título "Painel do dia", a régua da semana do
 * `week-strip.tsx`, os quatro contadores de status e a agenda do dia.
 *
 * Existe porque a composição da agenda, sozinha, não responde à pergunta que
 * quem atende faz primeiro: "isso funciona no meu celular?". Um cartão largo
 * responde "isto é um sistema de computador"; o mesmo conteúdo dentro de uma
 * moldura de telefone responde o contrário, sem gastar uma linha de texto.
 *
 * Os números batem com os do slide de dados: são a mesma terça-feira vista de
 * dois lugares, e não duas demonstrações que se contradizem.
 */

/** A navegação de Operação, na ordem em que o `dashboard-shell` a monta. */
const NAV = [
  { icon: CalendarDays, label: "Painel do dia", active: true },
  { icon: CalendarRange, label: "Agendamentos", active: false },
  { icon: Users, label: "Clientes", active: false },
  { icon: Scissors, label: "Serviços", active: false },
  { icon: Clock, label: "Horários", active: false },
];

/** Segunda a domingo da semana do dia 8 — a régua começa na segunda. */
const WEEK = [
  { label: "Seg", day: 7 },
  { label: "Ter", day: 8 },
  { label: "Qua", day: 9 },
  { label: "Qui", day: 10 },
  { label: "Sex", day: 11 },
  { label: "Sáb", day: 12 },
  { label: "Dom", day: 13 },
];

/** Os quatro contadores do resumo, com as cores de acento da tela real. */
const TILES = [
  { label: "Total", value: 6, accent: "bg-[#1c1b22]" },
  { label: "Agendados", value: 4, accent: "bg-[#6d3ad4]" },
  { label: "Em atendimento", value: 1, accent: "bg-amber-500" },
  { label: "Finalizados", value: 1, accent: "bg-emerald-500" },
];

const ROWS = [
  { start: "09:00", client: "Ana Beatriz", service: "Design de sobrancelhas", color: "var(--violet-600)" },
  { start: "11:00", client: "Carla Souza", service: "Manicure", color: "var(--magenta)" },
];

export function PhonePreview() {
  return (
    <div
      className="relative mx-auto w-[16.5rem] sm:w-[17.5rem]"
      role="img"
      aria-label="O Timely aberto no celular, no painel do dia: a régua da semana, os contadores de agendamentos por status e a agenda de terça-feira."
    >
      {/* A moldura. Escura de propósito: contra o plum do hero ela desenha a
          silhueta do aparelho sem precisar de imagem nenhuma. */}
      <div className="rounded-[2rem] border border-white/15 bg-[#120a1e] p-2 shadow-2xl shadow-black/45">
        <div className="relative overflow-hidden rounded-[1.6rem] bg-[#f4f5f7] text-[#1c1b22]">
          {/* Pílula da câmera — o único elemento aqui que é só desenho. */}
          <div
            aria-hidden
            className="absolute top-1.5 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-black/12"
          />

          <div className="flex flex-col gap-2.5 px-2.5 pt-5 pb-4">
            {/* Navegação: no celular o `dashboard-shell` a deita em linha. */}
            <nav className="flex items-center gap-1" aria-hidden>
              {NAV.map((item) => (
                <span
                  key={item.label}
                  className={cn(
                    "flex flex-1 items-center justify-center rounded-lg py-1.5",
                    item.active ? "bg-[#6d3ad4] text-white" : "text-[#61616e]"
                  )}
                >
                  <item.icon className="size-3.5" />
                </span>
              ))}
            </nav>

            <div>
              <p className="text-[0.8125rem] leading-tight font-semibold">Painel do dia</p>
              <p className="text-[0.6875rem] text-[#61616e]">Terça, 8 de setembro</p>
            </div>

            {/* Régua da semana. */}
            <div className="flex gap-0.5" aria-hidden>
              {WEEK.map((d) => (
                <span
                  key={d.day}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-px rounded-lg py-1",
                    d.day === 8 ? "bg-[#6d3ad4] text-white" : "text-[#61616e]"
                  )}
                >
                  <span className="text-[0.5rem] font-medium tracking-wide uppercase opacity-80">
                    {d.label}
                  </span>
                  <span className="text-[0.6875rem] font-semibold tabular-nums">{d.day}</span>
                </span>
              ))}
            </div>

            {/* Resumo do dia. */}
            <div className="grid grid-cols-2 gap-1.5">
              {TILES.map((t) => (
                <div
                  key={t.label}
                  className="overflow-hidden rounded-[0.375rem] border border-[#dcdee4] bg-white"
                >
                  <div className={cn("h-0.5", t.accent)} />
                  <div className="px-2 py-1.5">
                    <p className="text-base leading-none font-semibold">{t.value}</p>
                    <p className="mt-0.5 truncate text-[0.5625rem] text-[#61616e]">{t.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Agenda do dia. */}
            <div className="overflow-hidden rounded-[0.375rem] border border-[#dcdee4] bg-white">
              <div className="flex items-center justify-between border-b border-[#dcdee4] px-2.5 py-1.5">
                <p className="text-[0.6875rem] font-medium">Agenda do dia</p>
                <p className="text-[0.625rem] text-[#61616e]">6 atendimentos</p>
              </div>
              <ol className="divide-y divide-[#dcdee4]">
                {ROWS.map((r) => (
                  <li key={r.start} className="relative flex items-center gap-2 py-2 pr-2.5 pl-2.5">
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-0.5"
                      style={{ backgroundColor: r.color }}
                    />
                    <time className="text-[0.6875rem] font-semibold tabular-nums">{r.start}</time>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.6875rem] font-medium">{r.client}</p>
                      <p className="truncate text-[0.5625rem] text-[#61616e]">{r.service}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Os mesmos selos do primeiro slide, no mesmo lugar da composição: é o
          que faz a troca ler como "outra vista do mesmo produto". */}
      <Seal
        shown
        className="float-soft -top-6 -left-8 hidden border-white/15 bg-plum-900/90 text-blush-50 sm:flex"
      >
        <Check className="size-3.5 shrink-0 text-emerald-400" aria-hidden />
        Agenda de hoje atualizada
      </Seal>

      <Seal
        shown
        /* Mais para fora que nos outros slides: a moldura do celular é
           estreita, e no recuo padrão o selo cobriria a última linha da
           agenda em vez de decorar o canto. */
        className="float-soft -right-12 -bottom-6 hidden border-white/15 bg-[var(--wa)]/95 font-medium text-white sm:flex"
        style={{ animationDelay: "1.4s" }}
      >
        <BellRing className="size-3.5 shrink-0" aria-hidden />
        Lembrete de amanhã programado
      </Seal>
    </div>
  );
}
