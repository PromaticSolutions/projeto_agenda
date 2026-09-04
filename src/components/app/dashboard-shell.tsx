"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  CalendarDays,
  CalendarRange,
  CircleUserRound,
  Clock,
  MessageCircle,
  Scissors,
  Settings,
  Users,
} from "lucide-react";
import { SystemLogo } from "@/components/system-logo";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/app/sign-out-button";
import { CopyLinkButton } from "@/components/app/copy-link-button";
import { CommandPalette } from "@/components/app/command-palette";
import { ThemeToggle } from "@/components/app/theme-toggle";
import type { Studio } from "@/lib/types";

/**
 * Navegação agrupada por finalidade. Uma lista corrida de oito itens não
 * comunica que "Lembretes" e "WhatsApp" são o mesmo assunto, nem que
 * "Configurações" não faz parte da operação do dia.
 */
const NAV_GROUPS = [
  {
    label: "Operação",
    items: [
      { href: "/app", label: "Painel do dia", icon: CalendarDays },
      { href: "/app/bookings", label: "Agendamentos", icon: CalendarRange },
      { href: "/app/clients", label: "Clientes", icon: Users },
      { href: "/app/services", label: "Serviços", icon: Scissors },
      { href: "/app/hours", label: "Horários", icon: Clock },
    ],
  },
  {
    label: "Automação",
    items: [
      { href: "/app/reminders", label: "Lembretes", icon: BellRing },
      { href: "/app/whatsapp", label: "WhatsApp", icon: MessageCircle },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/app/account", label: "Conta", icon: CircleUserRound },
      { href: "/app/settings", label: "Configurações", icon: Settings },
    ],
  },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/app" && pathname.startsWith(`${href}/`));
}

export function DashboardShell({
  studio,
  publicUrl,
  children,
}: {
  studio: Studio;
  publicUrl: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-border bg-card px-4 py-4 md:w-64 md:border-b-0 md:border-r md:px-4 md:py-5">
        <div className="flex items-center gap-2.5">
          {/* Marca do produto, igual para todo estúdio. Antes era a inicial do
              nome sobre a cor da marca do dono — o que fazia o painel parecer
              um app diferente a cada cliente. A identidade de cada estúdio
              continua onde ela importa: na página pública e no nome aqui do
              lado. */}
          <SystemLogo className="size-9" size={80} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{studio.name}</p>
            <p className="truncate text-xs text-muted-foreground">/{studio.slug}</p>
          </div>
        </div>

        <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col md:gap-5 md:overflow-visible">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-row gap-1 md:flex-col md:gap-0.5">
              {/* Rótulo do grupo só no layout vertical: na barra horizontal do
                  celular ele viraria ruído entre os ícones. */}
              <p className="section-label hidden px-2 pb-1 text-muted-foreground md:block">
                {group.label}
              </p>

              {group.items.map((item) => {
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
            </div>
          ))}
        </nav>

        <div className="mt-auto hidden flex-col gap-2 rounded-md border border-border p-3 md:flex">
          <p className="section-label text-muted-foreground">Link público</p>
          <CopyLinkButton url={publicUrl} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5 md:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <CommandPalette />
          </div>
          <div className="flex items-center gap-1">
            <div className="md:hidden">
              <CopyLinkButton url={publicUrl} />
            </div>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
