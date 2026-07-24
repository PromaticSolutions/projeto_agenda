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
        "relative flex-col justify-between overflow-hidden bg-plum-900 px-10 py-12 text-blush-50",
        className
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 size-72 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="absolute -right-16 -bottom-24 size-80 rounded-full bg-magenta/20 blur-3xl" />
      </div>

      <div className="relative flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-cta text-white shadow-md shadow-violet-600/25">
          <CalendarDays className="size-5" />
        </span>
        <span className="font-heading text-xl font-semibold">Agenda Online</span>
      </div>

      <div className="relative max-w-sm">
        <h2 className="font-heading text-3xl leading-tight font-semibold">
          Sua agenda, sempre aberta — mesmo enquanto você atende.
        </h2>
        <ul className="mt-6 flex flex-col gap-4 text-sm text-blush-50/80">
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

      <p className="relative text-xs text-blush-50/50">
        Feito para estúdios de beleza, barbearias e clínicas.
      </p>
    </div>
  );
}

export function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-cta text-white shadow-md shadow-violet-600/25">
        <CalendarDays className="size-5" />
      </span>
      <span className="font-heading text-xl font-semibold text-plum-900">Agenda Online</span>
    </Link>
  );
}

export function AuthBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute left-1/2 top-[-12rem] size-[36rem] -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="absolute bottom-[-10rem] right-[-6rem] size-[28rem] rounded-full bg-magenta/15 blur-3xl" />
    </div>
  );
}
