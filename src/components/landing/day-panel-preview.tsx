import { CalendarDays, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Seal } from "@/components/landing/seal";
import { cn } from "@/lib/utils";

/**
 * O terceiro slide do hero: o resumo do dia em números.
 *
 * A pergunta que ele responde é a que sobra depois de ver a agenda e o
 * celular — "e eu, como acompanho?". A resposta do Timely não é um painel de
 * BI: é o resumo por status que já existe em `app/(dashboard)/page.tsx`, e é
 * exatamente ele que está aqui. Nenhum número inventado, nenhuma métrica que
 * o produto não calcula — faturamento previsto, taxa de comparecimento e
 * afins ficariam bonitos neste espaço e seriam promessa falsa.
 *
 * É a MESMA terça-feira dos outros dois slides: seis atendimentos, quatro
 * agendados, um em atendimento, um finalizado. O carrossel troca o ponto de
 * vista, não os dados.
 */

const WEEK = [
  { label: "Seg", day: 7 },
  { label: "Ter", day: 8 },
  { label: "Qua", day: 9 },
  { label: "Qui", day: 10 },
  { label: "Sex", day: 11 },
  { label: "Sáb", day: 12 },
  { label: "Dom", day: 13 },
];

const TILES = [
  { label: "Total", value: 6, accent: "bg-[#1c1b22]" },
  { label: "Agendados", value: 4, accent: "bg-[#6d3ad4]" },
  { label: "Em atendimento", value: 1, accent: "bg-amber-500" },
  { label: "Finalizados", value: 1, accent: "bg-emerald-500" },
];

/** Os pontos de status são os de `lib/booking-status.ts`. */
const ROWS = [
  {
    start: "09:00",
    client: "Ana Beatriz",
    service: "Design de sobrancelhas",
    price: "R$ 60,00",
    status: "Finalizado",
    dot: "bg-[#128c4a]",
  },
  {
    start: "11:00",
    client: "Carla Souza",
    service: "Manicure",
    price: "R$ 45,00",
    status: "Em atendimento",
    dot: "bg-[#c62f86]",
  },
  {
    start: "14:00",
    client: "Juliana Melo",
    service: "Coloração",
    price: "R$ 180,00",
    status: "Agendado",
    dot: "bg-[#8b5cf6]",
  },
];

export function DayPanelPreview() {
  return (
    <div
      className="relative"
      role="img"
      aria-label="Resumo do dia no Timely: seis atendimentos na terça-feira, sendo quatro agendados, um em atendimento e um finalizado, com a agenda do dia abaixo."
    >
      {/* Tema claro fixo, como nos outros slides: o painel é uma superfície
          clara, e o contraste com o plum é o que separa produto de página. */}
      <div className="panel overflow-hidden bg-white text-[#1c1b22] shadow-2xl shadow-black/30">
        <header className="flex items-center justify-between gap-3 border-b border-[#dcdee4] px-4 py-3">
          <div>
            <p className="font-semibold">Painel do dia</p>
            <p className="text-sm text-[#61616e]">Terça, 8 de setembro</p>
          </div>
          {/* O `date-nav.tsx` da tela real: anterior, hoje, próximo. */}
          <div className="flex items-center gap-1 text-[#61616e]" aria-hidden>
            <span className="rounded-[0.375rem] border border-[#dcdee4] p-1.5">
              <ChevronLeft className="size-3.5" />
            </span>
            <span className="rounded-[0.375rem] border border-[#dcdee4] px-2.5 py-1 text-xs font-medium">
              Hoje
            </span>
            <span className="rounded-[0.375rem] border border-[#dcdee4] p-1.5">
              <ChevronRight className="size-3.5" />
            </span>
          </div>
        </header>

        <div className="flex flex-col gap-3.5 p-4">
          <div className="flex gap-1.5" aria-hidden>
            {WEEK.map((d) => (
              <span
                key={d.day}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-[0.5rem] px-2 py-1.5",
                  d.day === 8 ? "bg-[#6d3ad4] text-white" : "text-[#61616e]"
                )}
              >
                <span className="text-[0.625rem] font-medium tracking-wide uppercase opacity-80">
                  {d.label}
                </span>
                <span className="text-sm font-semibold tabular-nums">{d.day}</span>
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TILES.map((t) => (
              <div
                key={t.label}
                className="overflow-hidden rounded-[0.375rem] border border-[#dcdee4] bg-white"
              >
                <div className={cn("h-1", t.accent)} />
                <div className="p-2.5">
                  <p className="text-2xl leading-none font-semibold tabular-nums">{t.value}</p>
                  <p className="mt-1 truncate text-xs text-[#61616e]">{t.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-[0.375rem] border border-[#dcdee4]">
            <div className="flex items-center justify-between border-b border-[#dcdee4] px-3 py-2">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <CalendarDays className="size-3.5 text-[#61616e]" aria-hidden />
                Agenda do dia
              </p>
              <p className="text-xs text-[#61616e]">6 atendimentos</p>
            </div>
            <ol className="divide-y divide-[#dcdee4]">
              {ROWS.map((r) => (
                <li key={r.start} className="flex items-center gap-3 px-3 py-2">
                  <time className="text-sm font-semibold tabular-nums">{r.start}</time>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.client}</p>
                    <p className="truncate text-xs text-[#61616e]">{r.service}</p>
                  </div>
                  <span className="hidden items-center gap-1.5 text-xs text-[#61616e] sm:flex">
                    <span aria-hidden className={cn("size-1.5 rounded-full", r.dot)} />
                    {r.status}
                  </span>
                  <span className="tabular-nums text-xs ">{r.price}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* Selos de UMA linha, nos mesmos cantos dos outros slides. A referência
          de dashboard que inspirou esta vista usa cartões de duas linhas
          apontando para cada número; aqui eles cobriam o título e a última
          linha da agenda. Num cartão deste tamanho a legenda de duas linhas
          não cabe fora do conteúdo — e legenda que tapa o dado que explica
          é pior do que legenda nenhuma. */}
      <Seal
        shown
        className="float-soft -top-7 -left-5 hidden border-white/15 bg-plum-900/90 text-blush-50 sm:flex"
      >
        <Check className="size-3.5 shrink-0 text-emerald-400" aria-hidden />
        O dia fechado, sem contar na mão
      </Seal>

      <Seal
        shown
        className="float-soft -right-2 -bottom-5 hidden border-white/15 bg-plum-900/90 text-blush-50 sm:flex"
        style={{ animationDelay: "1.4s" }}
      >
        <CalendarDays className="size-3.5 shrink-0 text-violet-400" aria-hidden />
        A semana inteira em um toque
      </Seal>
    </div>
  );
}
