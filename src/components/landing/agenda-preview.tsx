import { BellRing, CalendarPlus, Check, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Prévia do produto no hero.
 *
 * NÃO é screenshot. É a interface montada com os mesmos primitivos do
 * sistema: `panel`, `Badge`, a barra colorida do serviço à esquerda, hora em
 * peso semibold com o fim em `muted-foreground`, telefone com o ícone —
 * a anatomia de `components/app/booking-card.tsx`.
 *
 * Imagem estática seria mais rápida de fazer e pior em três frentes: não
 * acompanha o tema claro/escuro, fica desalinhada com a interface real no
 * primeiro ajuste de layout, e um PNG legível no desktop pesa muito para o
 * celular. Aqui o "mockup" é HTML — responsivo e sempre atual por construção.
 *
 * Os dados são demonstrativos e genéricos de propósito: nomes comuns, sem
 * sugerir cliente real de ninguém.
 */

const DEMO_BOOKINGS = [
  {
    start: "09:00",
    end: "10:30",
    service: "Design de sobrancelhas",
    client: "Ana Beatriz",
    phone: "(11) 9••••-4821",
    color: "var(--violet-600)",
    status: "Confirmado",
  },
  {
    start: "11:00",
    end: "12:00",
    service: "Manicure",
    client: "Carla Souza",
    phone: "(11) 9••••-7734",
    color: "var(--magenta)",
    status: "Confirmado",
  },
  {
    start: "14:00",
    end: "16:00",
    service: "Coloração",
    client: "Juliana Melo",
    phone: "(21) 9••••-1190",
    color: "#0f766e",
    status: "Aguardando",
  },
];

export function AgendaPreview() {
  return (
    <div className="relative" aria-label="Exemplo da agenda do Timely" role="img">
      {/* A prévia inteira usa o tema CLARO, independente do tema do visitante:
          ela representa o painel, que é uma superfície clara — e sobre o
          plum-900 do hero isso cria a separação "isto é o produto, aquilo é a
          página". `text-foreground` dentro dela resolve para o token claro
          porque o wrapper não herda `.dark`. */}
      <div className="panel overflow-hidden bg-white text-[#1c1b22] shadow-2xl shadow-black/30">
        <header className="flex items-center justify-between gap-3 border-b border-[#dcdee4] px-4 py-3">
          <div>
            <p className="text-[0.6875rem] font-semibold tracking-[0.04em] text-[#61616e] uppercase">
              Hoje
            </p>
            <p className="font-semibold">Terça, 8 de setembro</p>
          </div>
          <Badge variant="secondary" className="shrink-0 font-mono">
            3 horários
          </Badge>
        </header>

        <ol className="divide-y divide-[#dcdee4]">
          {DEMO_BOOKINGS.map((b) => (
            <li key={b.start} className="relative flex gap-3 pl-4">
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-1"
                style={{ backgroundColor: b.color }}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1 py-3 pr-4">
                <p className="flex items-baseline gap-1.5">
                  <time className="text-lg font-semibold">{b.start}</time>
                  <span className="text-sm text-[#61616e]">→ {b.end}</span>
                </p>
                <p className="truncate text-sm text-[#61616e]">{b.service}</p>
                <p className="truncate font-medium">{b.client}</p>
                <p className="flex items-center gap-1.5 text-sm text-[#61616e]">
                  <Phone className="size-3.5 shrink-0" aria-hidden />
                  <span className="font-mono">{b.phone}</span>
                </p>
              </div>
              <span
                className={cn(
                  "my-3 mr-4 h-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                  b.status === "Confirmado"
                    ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-amber-500/10 text-amber-700"
                )}
              >
                {b.status}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Elementos flutuantes com flutuação suave e defasada — a defasagem
          é o que impede os três de subirem em bloco, que pareceria um único
          objeto se movendo. `hidden sm:flex` porque no celular eles cobririam
          o cartão em vez de decorar a composição. */}
      <div className="float-soft absolute -top-7 -left-5 hidden items-center gap-2 rounded-lg border border-white/15 bg-plum-900/90 px-3 py-2 text-xs text-blush-50 shadow-lg backdrop-blur-sm sm:flex">
        <BellRing className="size-3.5 shrink-0 text-blush-50/70" aria-hidden />
        Lembrete enviado
      </div>

      <div
        className="float-soft absolute top-1/3 -left-8 hidden items-center gap-2 rounded-lg border border-white/15 bg-plum-900/90 px-3 py-2 text-xs text-blush-50 shadow-lg backdrop-blur-sm lg:flex"
        style={{ animationDelay: "1.6s" }}
      >
        <CalendarPlus className="size-3.5 shrink-0 text-blush-50/70" aria-hidden />
        Novo agendamento
      </div>

      <div
        className="float-soft absolute -right-3 -bottom-4 hidden items-center gap-2 rounded-lg border border-white/15 bg-[var(--wa)]/95 px-3 py-2 text-xs font-medium text-white shadow-lg sm:flex"
        style={{ animationDelay: "3.1s" }}
      >
        <Check className="size-3.5 shrink-0" aria-hidden />
        Cliente confirmou
      </div>
    </div>
  );
}
