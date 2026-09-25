import Link from "next/link";
import { Check } from "lucide-react";
import { SystemLogo } from "@/components/system-logo";
import { AuthParticles } from "@/components/auth/auth-particles";
import { GlassKnotBackdrop } from "@/components/auth/glass-knot";
import { DayPanelPreview } from "@/components/landing/day-panel-preview";
import { cn } from "@/lib/utils";

/** Os mesmos benefícios da landing, na mesma voz — e só o que o produto faz. */
const SHOWCASE_BENEFITS = [
  "Suas clientes marcam sozinhas pelo seu link",
  "O lembrete sai pelo seu WhatsApp, sem você digitar",
  "Histórico e anotações de cada cliente à mão",
];

/**
 * Painel da marca nas telas de entrada (só em tela larga).
 *
 * É o hero da landing em miniatura: mesma superfície plum, mesmo nó de vidro
 * girando, mesmas partículas, mesma fonte de título — quem clicou em
 * "Começar grátis" chega aqui sem sensação de ter trocado de site. Embaixo, o
 * painel do dia do próprio produto flutuando: a tela de entrada também é
 * lugar de lembrar o que a pessoa vai encontrar do outro lado.
 *
 * O nó e as partículas moram AQUI, e não na moldura inteira: o formulário
 * fica sobre o fundo claro do tema, e vidro girando atrás de campo de senha
 * só atrapalhava a leitura.
 */
export function AuthShowcasePanel({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "relative flex-col overflow-hidden bg-plum-900 px-12 pt-8 text-blush-50 lg:sticky lg:top-0 lg:h-dvh",
        className
      )}
    >
      {/* Ordem importa: o nó pinta o próprio plum (é opaco, para o vidro ter o
          que refratar), então vem ANTES das partículas. */}
      <GlassKnotBackdrop scale={0.8} focusX={0.78} focusY={0.3} />
      <AuthParticles count={45} />

      <Link
        href="/"
        className="relative z-10 flex items-center gap-2.5 self-start rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-white/40"
      >
        <SystemLogo className="size-10" size={80} />
        <span className="text-[1.25rem] font-semibold tracking-tight">Timely</span>
      </Link>

      <div className="relative z-10 mt-10 max-w-md">
        <h2 className="text-[2.25rem] leading-[1.08] font-semibold text-balance xl:text-[2.5rem]">
          Sua agenda funcionando enquanto você atende.
        </h2>
        {/* Alinhada à esquerda: item de lista centralizado não tem eixo de
            leitura, e o olho perde o começo de cada linha. */}
        <ul className="mt-6 flex flex-col gap-3 text-[0.9375rem] leading-6 text-blush-50/85">
          {SHOWCASE_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/12">
                <Check className="size-3" strokeWidth={3} aria-hidden />
              </span>
              {benefit}
            </li>
          ))}
        </ul>
      </div>

      {/* A prévia assenta no pé do painel e passa da borda de baixo, cortada
          pelo `overflow-hidden`: o painel tem a altura exata da janela, e em
          vez de empurrar a página para rolar, o produto "continua" para fora
          do quadro. */}
      <div className="relative z-10 mt-auto -mb-10 pt-10">
        <div className="float-card mx-auto w-full max-w-md">
          <DayPanelPreview />
        </div>
      </div>
    </aside>
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
