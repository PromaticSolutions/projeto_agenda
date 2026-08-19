import Link from "next/link";
import { CalendarDays, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const SHOWCASE_BENEFITS = [
  "Clientes marcam direto pelo link, sem precisar te chamar",
  "Confirmação automática no WhatsApp — sem mensagem perdida",
  "Você não perde tempo respondendo 'tem horário na quinta?'",
];

export function AuthShowcasePanel({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        // Sem fundo próprio: o escuro vem do AuthShell, e as partículas
        // atravessam esta coluna em vez de pararem na divisa.
        "relative flex-col justify-between border-r border-white/10 px-10 py-12",
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-md bg-cta text-white">
          <CalendarDays className="size-5" />
        </span>
        <span className="text-[1.25rem] font-semibold">Agenda Online</span>
      </div>

      <div className="max-w-sm">
        <h2 className="text-[2rem] leading-tight font-semibold sm:text-[2.3rem]">
          Sua agenda, sempre aberta — mesmo enquanto você atende.
        </h2>
        <ul className="mt-6 flex flex-col gap-4 text-sm leading-6 text-blush-50/80">
          {SHOWCASE_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Check className="size-3" />
              </span>
              {benefit}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-blush-50/50">
        Feito para estúdios de beleza, barbearias e clínicas.
      </p>
    </div>
  );
}

export function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-md bg-cta text-white">
        <CalendarDays className="size-5" />
      </span>
      {/* Sem cor própria: herda do contexto. As telas de auth são escuras
          (AuthShell define claro) e o onboarding é claro — fixar a cor aqui
          apagaria a marca em um dos dois. */}
      <span className="text-[1.15rem] font-semibold">Agenda Online</span>
    </Link>
  );
}
