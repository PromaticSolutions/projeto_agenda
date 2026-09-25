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
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#produto", label: "Produto" },
  { href: "#para-quem", label: "Para quem é" },
  { href: "#preco", label: "Preço" },
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
        "sticky top-0 z-50 w-full bg-background transition-colors duration-300",
        // O fundo é o MESMO papel do hero, então no topo a barra não aparece
        // como barra. Depois de rolar, ela ganha o fio de baixo — a linha de
        // cabeçalho de uma página de agenda — e fica opaca: desfoque sobre as
        // faixas escuras deixava o menu cinza e sem contraste.
        scrolled ? "border-b border-foreground/15" : "border-b border-transparent"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <SystemLogo className="size-9" size={72} />
          <span className="text-lg font-semibold tracking-tight">Timely</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Seções">
          {SECTIONS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {s.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="hidden text-foreground hover:bg-foreground/5 sm:inline-flex"
            onClick={() => track("login_click", { from: "header" })}
            nativeButton={false}
            render={<Link href="/login" />}
          >
            Entrar
          </Button>
          <Button
            className="h-9 rounded-md bg-foreground px-3.5 text-background hover:bg-[var(--violet-600)] hover:text-white"
            onClick={() => track("signup_click", { from: "header" })}
            nativeButton={false}
            render={<Link href="/signup" />}
          >
            Começar grátis
          </Button>

          <button
            type="button"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded-md p-2 text-foreground transition-colors hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Painel do celular. Fica no fluxo (e não em portal) porque o header já
          é sticky com z-50 — um portal exigiria repetir o controle de foco
          sem ganhar nada. */}
      {open && (
        <div className="border-t border-foreground/15 bg-background lg:hidden">
          <nav className="mx-auto flex w-full max-w-6xl flex-col px-4 py-3 sm:px-6" aria-label="Seções">
            {SECTIONS.map((s) => (
              <a
                key={s.href}
                href={s.href}
                onClick={() => setOpen(false)}
                className="border-b border-border px-1 py-3.5 text-base text-foreground last-of-type:border-b-0"
              >
                {s.label}
              </a>
            ))}
            <Button
              variant="outline"
              className="mt-2 h-11 rounded-md border-foreground/25 bg-transparent text-foreground hover:bg-foreground/5 sm:hidden"
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
