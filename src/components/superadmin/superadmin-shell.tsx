"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  MessageCircle,
  Receipt,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { SystemLogo } from "@/components/system-logo";
import { SignOutButton } from "@/components/app/sign-out-button";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * Casca do painel da plataforma.
 *
 * Passou de header único para navegação lateral porque o superadmin deixou de
 * ser uma tela: são três assuntos diferentes — o resumo da plataforma, a ficha
 * de cada cliente e o dinheiro. Empilhar os três numa página só obrigaria a
 * rolar para trocar de pergunta.
 *
 * A estrutura repete a do painel do estúdio (`DashboardShell`) de propósito:
 * quem administra a plataforma também usa o /app, e duas gramáticas de
 * navegação no mesmo produto custam mais do que a economia de um componente
 * compartilhado. O que muda é a faixa de identificação — este painel vê dado
 * de TODOS os estúdios, e isso tem que estar visível na tela.
 */
const NAV_ITEMS = [
  { href: "/superadmin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/superadmin/studios", label: "Clientes", icon: Building2 },
  { href: "/superadmin/billing", label: "Faturamento", icon: Receipt },
  { href: "/superadmin/leads", label: "Leads", icon: UserPlus },
  { href: "/superadmin/whatsapp", label: "WhatsApp", icon: MessageCircle },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/superadmin" && pathname.startsWith(`${href}/`));
}

export function SuperAdminShell({
  adminEmail,
  children,
}: {
  adminEmail: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-border bg-card px-4 py-4 md:w-60 md:border-b-0 md:border-r md:py-5">
        <div className="flex items-center gap-2.5">
          <SystemLogo className="size-9" size={80} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">Timely Admin</p>
            <p className="truncate text-xs text-muted-foreground">Painel da plataforma</p>
          </div>
        </div>

        <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col md:gap-0.5 md:overflow-visible">
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
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Lembrete permanente de escopo: quem está aqui lê dado de cliente. */}
        <div className="mt-auto hidden flex-col gap-1.5 rounded-md border border-border p-3 md:flex">
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <ShieldCheck className="size-3.5 text-primary" />
            Acesso de plataforma
          </p>
          <p className="text-xs leading-snug text-muted-foreground">
            Estes números atravessam todos os estúdios. Trate como dado de cliente.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5 md:px-8">
          <p className="truncate text-sm text-muted-foreground">
            {adminEmail ?? "Administrador da plataforma"}
          </p>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
