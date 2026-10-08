"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, LayoutDashboard, MessagesSquare, Users, UserCog } from "lucide-react";
import { SystemLogo } from "@/components/system-logo";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/app/sign-out-button";
import { ThemeToggle } from "@/components/app/theme-toggle";

/**
 * Casca da área da gerente.
 *
 * Componente separado do `DashboardShell` de propósito, e não um `if` dentro
 * dele: a gerente não tem estúdio, não tem página pública para copiar o link,
 * não tem assinatura própria e não tem Conversas no sentido de responder. Enfiar
 * os dois papéis na mesma casca encheria o arquivo de condicionais e colocaria
 * em risco a navegação da atendente, que é a que já funciona.
 */
const NAV_ITEMS = [
  { href: "/app/gerencia", label: "Visão geral", icon: LayoutDashboard },
  { href: "/app/gerencia/atendentes", label: "Atendentes", icon: UserCog },
  { href: "/app/gerencia/clientes", label: "Clientes", icon: Users },
  { href: "/app/gerencia/conversas", label: "Conversas", icon: MessagesSquare },
  { href: "/app/gerencia/agendamentos", label: "Agendamentos", icon: CalendarRange },
] as const;

function isActive(pathname: string, href: string): boolean {
  return (
    pathname === href || (href !== "/app/gerencia" && pathname.startsWith(`${href}/`))
  );
}

export function GerenciaShell({
  salonName,
  managerName,
  children,
}: {
  salonName: string;
  managerName: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-border bg-card px-4 py-4 md:w-64 md:border-b-0 md:border-r md:px-4 md:py-5">
        <div className="flex items-center gap-2.5">
          <SystemLogo className="size-9" size={80} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{salonName}</p>
            <p className="truncate text-xs text-muted-foreground">Gerência</p>
          </div>
        </div>

        <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col md:gap-0.5 md:overflow-visible">
          <p className="section-label hidden px-2 pb-1 text-muted-foreground md:block">Salão</p>
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto hidden flex-col gap-2 md:flex">
          {managerName ? (
            <p className="truncate px-2 text-xs text-muted-foreground">{managerName}</p>
          ) : null}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </aside>

      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
