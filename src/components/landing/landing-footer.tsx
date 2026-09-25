import Link from "next/link";
import { SystemLogo } from "@/components/system-logo";
import { CookiePreferencesButton } from "@/components/cookie-consent-banner";

/**
 * Rodapé da landing, em colunas.
 *
 * Separado do `SiteFooter` porque aquele também fecha as páginas legais
 * (`legal-shell.tsx`), e os links daqui são âncoras DESTA página — numa
 * página de termos, "#funcoes" não levaria a lugar nenhum.
 *
 * Três colunas e não cinco: cada link aponta para algo que existe. Um rodapé
 * cheio de itens sem destino seria cenografia.
 */

const COLUMNS = [
  {
    title: "Produto",
    links: [
      { href: "#como-funciona", label: "Como funciona" },
      { href: "#produto", label: "O produto" },
      { href: "#funcoes", label: "Funcionalidades" },
      { href: "#para-quem", label: "Para quem é" },
      { href: "#preco", label: "Preço" },
    ],
  },
  {
    title: "Começar",
    links: [
      { href: "/signup", label: "Começar grátis" },
      { href: "/login", label: "Entrar" },
      { href: "#duvidas", label: "Dúvidas" },
      { href: "#conhecer", label: "Falar com o time" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/politica-de-privacidade", label: "Política de privacidade" },
      { href: "/termos-de-uso", label: "Termos de uso" },
    ],
  },
];

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-background pt-16 pb-10 sm:pt-20">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1fr_auto]">
          <nav aria-label="Rodapé" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:gap-x-20">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="text-sm font-semibold text-foreground">{column.title}</p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      {link.href.startsWith("/") ? (
                        <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground">
                          {link.label}
                        </Link>
                      ) : (
                        <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground">
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                  {column.title === "Legal" && (
                    <li>
                      {/* Reabre o aviso de cookies; só aparece quando existe
                          uma decisão para revisar. */}
                      <CookiePreferencesButton className="text-sm" />
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </nav>

          <div className="flex flex-col gap-4 lg:items-end lg:text-right">
            <div className="flex items-center gap-2.5">
              <SystemLogo className="size-9" size={72} />
              <span className="font-heading text-2xl font-semibold text-foreground">Timely</span>
            </div>
            <p className="max-w-[16rem] text-[0.9375rem] leading-6 text-muted-foreground">
              Sua agenda funcionando enquanto você atende.
            </p>
          </div>
        </div>

        <p className="border-t border-border pt-6 text-sm text-muted-foreground">
          © {year} Timely · Promatic Solutions. Agendamento online para negócios
          de horário marcado.
        </p>
      </div>
    </footer>
  );
}
