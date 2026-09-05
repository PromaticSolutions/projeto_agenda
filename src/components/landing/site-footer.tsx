import Link from "next/link";
import { SystemLogo } from "@/components/system-logo";

/**
 * Rodapé.
 *
 * Curto de propósito: um rodapé com cinco colunas de links num produto que
 * ainda não tem cinco páginas é cenografia. Aqui fica a marca, os dois
 * caminhos de autenticação e a assinatura — o mesmo par que o `AuthFooter`
 * usa nas telas de entrada.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-background py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <SystemLogo className="size-8" size={64} />
            <span className="font-semibold text-foreground">Timely</span>
          </div>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" aria-label="Rodapé">
            <a href="#conhecer" className="text-muted-foreground hover:text-foreground">
              Falar com o time
            </a>
            <a href="#duvidas" className="text-muted-foreground hover:text-foreground">
              Dúvidas
            </a>
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              Entrar
            </Link>
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Criar conta
            </Link>
          </nav>
        </div>

        <div className="border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            © {year} Timely · Promatic Solutions. Agendamento online para
            negócios de horário marcado.
          </p>
          {/* Sem "Privacidade" e "Termos" aqui: essas páginas não existem no
              projeto, e um link para 404 no rodapé custa mais confiança do
              que a ausência dele. Quando existirem, entram nesta lista. */}
        </div>
      </div>
    </footer>
  );
}
