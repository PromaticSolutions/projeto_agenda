import Link from "next/link";
import { Check } from "lucide-react";
import { SystemLogo } from "@/components/system-logo";
import { cn } from "@/lib/utils";

const SHOWCASE_BENEFITS = [
  "Clientes marcam direto pelo link, sem precisar te chamar",
  "Confirmação automática no WhatsApp — sem mensagem perdida",
  "Você não perde tempo respondendo 'tem horário na quinta?'",
];

/**
 * Coluna de apresentação das telas de autenticação (só em telas largas).
 *
 * A marca aqui em cima é o PNG estático, não o nó em WebGL: com o nó grande
 * girando ao fundo, uma segunda cópia girando no canto disputava atenção com
 * ele e com o formulário. Uma peça em movimento por tela é o suficiente.
 */
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
        <SystemLogo className="size-10" size={80} />
        <span className="text-[1.25rem] font-semibold">Timely</span>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        {/* `text-balance` distribui as linhas em vez de deixar uma palavra
            sozinha na última — o que aparece com frase centralizada e some
            com frase alinhada à esquerda. */}
        <h2 className="text-center text-[2.25rem] leading-[1.15] font-semibold tracking-normal text-balance sm:text-[2.6rem]">
          Sua agenda, sempre aberta — mesmo enquanto você atende.
        </h2>

        {/* A lista continua alinhada à esquerda mesmo com o bloco centralizado:
            item de lista centralizado não tem eixo de leitura, e o olho perde
            o começo de cada linha. */}
        <ul className="mt-8 flex flex-col gap-4 self-stretch text-[0.9375rem] leading-6 text-blush-50/80">
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

      <footer className="border-t border-white/10 pt-5">
        <p className="text-[0.6875rem] font-semibold tracking-[0.08em] text-blush-50/45 uppercase">
          Promatic Solutions
        </p>
        <p className="mt-1 text-sm text-blush-50/60">
          Sistema de agendamento para estúdios de beleza, barbearias e clínicas.
        </p>
      </footer>
    </div>
  );
}

export function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <SystemLogo className="size-10" size={80} />
      {/* Sem cor própria: herda do contexto. As telas de auth são escuras
          (AuthShell define claro) e o onboarding é claro — fixar a cor aqui
          apagaria a marca em um dos dois. */}
      <span className="text-[1.15rem] font-semibold">Timely</span>
    </Link>
  );
}
