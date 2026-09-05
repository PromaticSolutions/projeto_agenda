"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassKnotBackdrop } from "@/components/auth/glass-knot";
import { AuthParticles } from "@/components/auth/auth-particles";
import { track } from "@/lib/analytics";
import { AgendaPreview } from "@/components/landing/agenda-preview";

/**
 * Hero.
 *
 * Cinco elementos e nada mais: rótulo de público, headline, uma linha, dois
 * botões, a composição do produto. A versão anterior tinha ainda três
 * micro-benefícios em lista — informação boa, no lugar errado: acima da dobra
 * cada linha extra atrasa a decisão em vez de sustentá-la.
 *
 * A superfície é a MESMA das telas de autenticação — `bg-plum-900`, o nó de
 * vidro em WebGL, o campo de partículas. Não é enfeite: é o que faz quem
 * clica em "Criar conta" cair numa tela com o mesmo fundo, sem sensação de
 * ter trocado de site.
 */
export function Hero() {
  return (
    <section id="topo" className="relative overflow-hidden bg-plum-900 text-blush-50">
      {/* Ordem importa: o nó é opaco (o vidro precisa de algo para refratar),
          então pinta antes das partículas — mesma regra do AuthShell. */}
      <GlassKnotBackdrop />
      <AuthParticles count={50} />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.02fr_1fr] lg:items-center lg:gap-12 lg:pt-20 lg:pb-24">
        <div className="flex flex-col items-start">
          <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-blush-50/85">
            Para quem vive de horário marcado
          </span>

          <h1 className="mt-5 text-[2.5rem] leading-[1.06] font-semibold tracking-tight text-balance sm:text-[3.25rem] lg:text-[3.5rem]">
            Sua agenda funcionando enquanto você atende.
          </h1>

          <p className="mt-5 max-w-lg text-[1.0625rem] leading-7 text-blush-50/75">
            Suas clientes marcam pelo seu link, o lembrete sai sozinho no
            WhatsApp e o seu dia fica livre para atender.
          </p>

          <div className="mt-8 flex flex-col gap-3 self-stretch sm:flex-row sm:self-auto">
            <Button
              size="lg"
              nativeButton={false}
              className="bg-blush-50 text-plum-900 hover:bg-white"
              onClick={() => track("hero_cta_click", { target: "conhecer" })}
              render={<a href="#conhecer" />}
            >
              Conhecer o Timely <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              className="border-white/25 bg-transparent text-blush-50 hover:bg-white/10 hover:text-blush-50"
              onClick={() => track("signup_click", { from: "hero" })}
              render={<Link href="/signup" />}
            >
              Criar conta
            </Button>
          </div>
        </div>

        <AgendaPreview />
      </div>
    </section>
  );
}
