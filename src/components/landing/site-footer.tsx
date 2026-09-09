import Link from "next/link";
import { SystemLogo } from "@/components/system-logo";
import { CookiePreferencesButton } from "@/components/cookie-consent-banner";

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
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p className="text-sm text-muted-foreground">
              © {year} Timely · Promatic Solutions. Agendamento online para
              negócios de horário marcado.
            </p>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" aria-label="Legal">
              <Link
                href="/politica-de-privacidade"
                className="text-muted-foreground hover:text-foreground"
              >
                Privacidade
              </Link>
              <Link href="/termos-de-uso" className="text-muted-foreground hover:text-foreground">
                Termos de uso
              </Link>
              {/* "Cookies" não leva a lugar nenhum: reabre o aviso, que é o
                  caminho de rever a decisão. Só aparece quando existe decisão
                  para revisar. */}
              <CookiePreferencesButton className="text-sm" />
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
