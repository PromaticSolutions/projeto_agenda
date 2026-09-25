"use client";

import { track } from "@/lib/analytics";
import { GlassKnotGhost } from "@/components/auth/glass-knot";
import { HeroCarousel } from "@/components/landing/hero-carousel";
import { SignupButton, TrialTerms } from "@/components/landing/signup-cta";
import { SectionMark } from "@/components/landing/section-heading";

/**
 * Hero.
 *
 * Responde as três perguntas dos primeiros cinco segundos — o que é, para
 * quem, qual o benefício — e oferece uma ação só: começar grátis. Embaixo
 * dos botões, as condições da oferta, que são o que trava o clique.
 *
 * A composição da direita é um carrossel de três vistas (ver
 * `hero-carousel.tsx`): cada slide ocupa o MESMO espaço, então mostrar três
 * coisas ali não custa altura nenhuma acima da dobra.
 *
 * A superfície é o papel da página, com o nó de vidro da marca girando ao
 * fundo em marca d'água. Era o plum com o nó opaco e um campo de estrelas —
 * o campo saiu; a peça ficou, na versão transparente.
 */

export function Hero() {
  return (
    <section id="topo" className="relative overflow-hidden border-b border-foreground/15 bg-background">
      {/* A marca girando ao fundo, meio apagada: a mesma peça 3D das telas de
          login, na versão transparente (sem o plum atrás), para pousar no
          papel. Fica atrás da prévia do produto e vaza pela borda direita —
          presença de marca d'água, sem disputar com o texto. */}
      <GlassKnotGhost className="absolute top-1/2 right-[-12rem] size-[52rem] -translate-y-1/2 opacity-25 max-lg:top-auto max-lg:right-[-9rem] max-lg:bottom-[-6rem] max-lg:size-[28rem] max-lg:translate-y-0 max-lg:opacity-15" />

      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-12 px-4 pt-14 pb-16 sm:px-6 sm:pb-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14 lg:pt-20 lg:pb-24">
        <div className="flex min-w-0 flex-col items-start">
          <SectionMark time="08:00" label="Para quem trabalha com horário marcado" />

          <h1 className="mt-6 text-[2.5rem] leading-[1.05] text-balance text-foreground sm:text-[3.5rem] lg:text-[3.75rem]">
            Organize sua agenda, suas clientes e seu negócio <em>em um só lugar.</em>
          </h1>

          <p className="mt-7 max-w-lg text-[1.0625rem] leading-7 text-muted-foreground">
            Suas clientes marcam pelo seu link, o lembrete sai sozinho no seu
            WhatsApp e você acompanha tudo de um lugar só, sem complicação.
          </p>

          <div className="mt-9 flex flex-col gap-4 self-stretch sm:flex-row sm:items-center sm:self-auto">
            <SignupButton from="hero" />
            {/* A segunda ação NÃO é outra conversão: desce para a demonstração
                na mesma página. Link sublinhado, e não um segundo botão, para
                não disputar com o cadastro. */}
            <a
              href="#produto"
              onClick={() => track("hero_cta_click", { target: "produto" })}
              className="self-start rounded-sm px-1 py-2 text-[0.9375rem] font-medium text-foreground underline decoration-foreground/30 underline-offset-[6px] transition-colors hover:decoration-[var(--mark)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:self-auto"
            >
              Ver como funciona
            </a>
          </div>

          <TrialTerms className="mt-6" />
        </div>

        <HeroCarousel />
      </div>
    </section>
  );
}
