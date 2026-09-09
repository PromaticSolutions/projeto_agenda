import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SystemLogo } from "@/components/system-logo";
import { SiteFooter } from "@/components/landing/site-footer";

/**
 * Moldura das páginas legais (`/politica-de-privacidade`, `/termos-de-uso`).
 *
 * NÃO usa o `SiteHeader` da landing: aquele cabeçalho é uma barra de âncoras
 * para seções da home (`#rotina`, `#duvidas`...), e num documento legal cada
 * link daqueles seria um clique que sai da página sem avisar. Aqui em cima
 * fica só a marca e a volta para o início.
 *
 * O rodapé é o MESMO da landing, de propósito: é dele que saem os links entre
 * as duas páginas legais, e mantê-los num lugar só evita a lista divergir.
 *
 * Server Component, como as duas páginas que ela embrulha — é texto estático,
 * não tem estado nenhum.
 */
export function LegalShell({
  title,
  updatedAt,
  summary,
  children,
}: {
  title: string;
  /** Data de vigência exibida. Ver a nota sobre `POLICY_VERSION` nas páginas. */
  updatedAt: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-lg text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <SystemLogo className="size-8" size={64} />
            <span className="font-semibold tracking-tight">Timely</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Início
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">
          Documento legal
        </p>
        <h1 className="mt-3 text-[2rem] leading-[1.15] font-semibold text-balance sm:text-[2.5rem]">
          {title}
        </h1>
        <p className="mt-4 text-[1.0625rem] leading-7 text-muted-foreground">{summary}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Em vigor desde <strong className="font-medium text-foreground">{updatedAt}</strong>.
        </p>

        {/* Espaçamento por classe utilitária em vez de `prose`: o projeto não
            usa @tailwindcss/typography, e trazer o plugin só por duas páginas
            de texto seria uma dependência nova para resolver margem. */}
        <div className="mt-10 flex flex-col gap-10">{children}</div>
      </main>

      <SiteFooter />
    </>
  );
}

/** Uma seção do documento. O `id` permite linkar direto para ela. */
export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-[1.375rem] leading-snug font-semibold text-balance sm:text-[1.5rem]">
        {title}
      </h2>
      <div className="mt-4 flex flex-col gap-4 leading-7 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_li]:leading-7 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
