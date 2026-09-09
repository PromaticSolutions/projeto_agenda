"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SystemLogo } from "@/components/system-logo";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

/**
 * Cabeçalho da landing.
 *
 * "Entrar" e "Criar conta" são `Link` para /login e /signup — as telas de
 * autenticação que já existem. Nenhum formulário aqui, nenhuma rota nova:
 * duplicar o cadastro numa landing é como o sistema acaba com dois caminhos
 * de criar conta que divergem no primeiro ajuste.
 *
 * A marca é o `SystemLogo` (o PNG do nó de vidro), o mesmo usado no painel e
 * na página pública de agendamento. No hero o nó aparece girando em WebGL;
 * aqui em cima ele é só identificação, e um segundo canvas 3D no header
 * custaria bateria numa página que a pessoa vai rolar inteira.
 */

const SECTIONS = [
  { href: "#rotina", label: "A rotina" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#whatsapp", label: "WhatsApp" },
  { href: "#para-quem", label: "Para quem é" },
  { href: "#duvidas", label: "Dúvidas" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // `landing_view` mora aqui porque o header é o único componente de
    // cliente que monta uma vez na landing inteira — um componente separado
    // só para disparar um evento seria um arquivo e um bundle a mais pelo
    // mesmo resultado.
    track("landing_view");
  }, []);

  useEffect(() => {
    // `passive` porque o listener só lê a posição — sem isso o navegador não
    // pode adiantar o scroll enquanto o handler roda.
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Trava o scroll do fundo enquanto o menu do celular está aberto.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full bg-plum-900 transition-colors duration-300",
        // O fundo é o MESMO do hero, e por isso a barra não aparece como
        // barra no topo: as duas superfícies se encostam e a composição
        // continua inteira. Deixar o header transparente aqui — que era o
        // desenho anterior — só funcionaria se ele estivesse SOBRE o hero;
        // sendo `sticky`, ele ocupa a faixa acima dele, sobre o fundo claro
        // da página, e o texto em blush-50 sumia contra o branco.
        //
        // Depois do topo, o que muda é a separação: translucidez, desfoque e
        // uma borda, para o conteúdo claro que passa por baixo não encostar
        // no menu.
        scrolled
          ? "border-b border-white/10 bg-plum-900/80 backdrop-blur-md"
          : "border-b border-transparent"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg text-blush-50 outline-none focus-visible:ring-3 focus-visible:ring-white/40"
        >
          <SystemLogo className="size-9" size={72} />
          <span className="text-lg font-semibold tracking-tight">Timely</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Seções">
          {SECTIONS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className="rounded-lg px-3 py-2 text-sm text-blush-50/70 transition-colors hover:text-blush-50 focus-visible:ring-3 focus-visible:ring-white/40 focus-visible:outline-none"
            >
              {s.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="hidden text-blush-50 hover:bg-white/10 hover:text-blush-50 sm:inline-flex"
            onClick={() => track("login_click", { from: "header" })}
            nativeButton={false}
            render={<Link href="/login" />}
          >
            Entrar
          </Button>
          <Button
            className="bg-blush-50 text-plum-900 hover:bg-white"
            onClick={() => track("signup_click", { from: "header" })}
            nativeButton={false}
            render={<Link href="/signup" />}
          >
            Criar conta
          </Button>

          <button
            type="button"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg p-2 text-blush-50 transition-colors hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-white/40 focus-visible:outline-none lg:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Painel do celular. Fica no fluxo (e não em portal) porque o header já
          é sticky com z-50 — um portal exigiria repetir o controle de foco
          sem ganhar nada. */}
      {open && (
        <div className="border-t border-white/10 bg-plum-900/95 backdrop-blur-md lg:hidden">
          <nav className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6" aria-label="Seções">
            {SECTIONS.map((s) => (
              <a
                key={s.href}
                href={s.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base text-blush-50/80 transition-colors hover:bg-white/10 hover:text-blush-50"
              >
                {s.label}
              </a>
            ))}
            <Button
              variant="outline"
              className="mt-2 border-white/25 bg-transparent text-blush-50 hover:bg-white/10 hover:text-blush-50 sm:hidden"
              onClick={() => {
                track("login_click", { from: "menu_mobile" });
                setOpen(false);
              }}
              nativeButton={false}
            render={<Link href="/login" />}
            >
              Entrar
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
