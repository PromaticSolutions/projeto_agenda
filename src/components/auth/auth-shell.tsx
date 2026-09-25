import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthShowcasePanel } from "@/components/auth/brand-mark";
import { SystemLogo } from "@/components/system-logo";

/**
 * Moldura comum das telas de entrada: login, cadastro, recuperar e redefinir
 * senha.
 *
 * Tela dividida. À esquerda (só em tela larga), o painel da marca: a mesma
 * superfície plum do hero da landing, com o nó de vidro e as partículas. À
 * direita, o formulário sobre o fundo CLARO do tema.
 *
 * O formulário já foi um cartão translúcido sobre o plum, e era o que dava
 * errado: rótulo herdando a cor de texto do tema sumia contra o fundo
 * escuro, campo transparente não parecia campo, e o vidro girando atrás
 * disputava a leitura. No fundo do tema, o formulário usa os mesmos campos e
 * botões do resto do sistema, com contraste garantido nos dois temas.
 *
 * O logo aparece uma vez só: no topo do painel da marca em tela larga, e no
 * topo do formulário quando o painel some (celular e tablet).
 */
export function AuthShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-1 bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]`}
    >
      <AuthShowcasePanel className="hidden lg:flex" />

      <div className="flex min-h-full flex-1 flex-col px-4 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          {/* Em tela larga o logo já está no painel da marca; aqui ele fica
              invisível (`invisible` também o tira do Tab) mas ocupa o lugar,
              para o "Voltar ao site" não pular de lado entre os tamanhos. */}
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:invisible"
          >
            <SystemLogo className="size-9" size={72} />
            <span className="text-lg font-semibold tracking-tight">Timely</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Voltar ao site
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>

        <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Timely · Promatic Solutions</span>
          <Link href="/politica-de-privacidade" className="hover:text-foreground">
            Privacidade
          </Link>
          <Link href="/termos-de-uso" className="hover:text-foreground">
            Termos de uso
          </Link>
        </footer>
      </div>
    </div>
  );
}

/** Título e linha de apoio de cada tela. `h1` porque é o título da página. */
export function AuthHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-[1.875rem] leading-[1.15] font-semibold text-balance text-foreground">{title}</h1>
      {description && <p className="mt-2.5 text-[0.9375rem] leading-6 text-muted-foreground">{description}</p>}
      {children}
    </div>
  );
}

/**
 * A troca entre entrar e criar conta, no pé do formulário. Separada por uma
 * régua: o caminho de quem está na tela errada é outro assunto, e a divisa
 * deixa isso legível sem mais um título.
 */
export function AuthSwitch({
  question,
  href,
  action,
}: {
  question: string;
  href: string;
  action: string;
}) {
  return (
    <p className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
      {question}{" "}
      <Link
        href={href}
        className="font-semibold text-primary underline-offset-4 hover:underline dark:text-violet-300"
      >
        {action}
      </Link>
    </p>
  );
}
