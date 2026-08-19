"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CircleUserRound, Clock, Scissors, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/app/sign-out-button";
import { CopyLinkButton } from "@/components/app/copy-link-button";
import { CommandPalette } from "@/components/app/command-palette";
import { ThemeToggle } from "@/components/app/theme-toggle";
import type { Studio } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/app", label: "Painel do dia", icon: CalendarDays },
  { href: "/app/clients", label: "Clientes", icon: Users },
  { href: "/app/services", label: "Serviços", icon: Scissors },
  { href: "/app/hours", label: "Horários", icon: Clock },
  { href: "/app/account", label: "Conta", icon: CircleUserRound },
];

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
    <div className="flex min-h-screen w-full flex-col bg-[#f7f5fc] transition-colors dark:bg-[#171020] md:flex-row">
      <aside className="relative flex shrink-0 flex-col gap-6 overflow-hidden bg-white/95 border border-violet-950/5 px-4 py-5 shadow-sm dark:bg-plum-900 dark:border-transparent md:w-70 md:px-5 md:py-6">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 size-48 rounded-full bg-violet-500/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute bottom-24 -left-20 size-44 rounded-full bg-magenta/15 blur-3xl" />
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-9 items-center justify-center rounded-full text-sm font-semibold text-white ring-2 ring-white/15"
            style={{ backgroundColor: studio.brand_color }}
          >
            {studio.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-heading text-base font-semibold text-plum-900 dark:text-blush-50">
              {studio.name}
            </p>
            <p className="truncate text-xs text-plum-500 dark:text-white/45">/{studio.slug}</p>
          </div>
        </div>

        <nav className="relative flex flex-row gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/app" && pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-cta text-white shadow-sm shadow-black/20"
                    : "text-plum-900/75 hover:bg-violet-100 hover:text-plum-900 dark:text-white/60 dark:hover:bg-white/8 dark:hover:text-white"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="relative mt-auto hidden flex-col gap-2 rounded-2xl border border-violet-950/10 bg-slate-50/80 p-3 text-plum-900 shadow-sm dark:flex dark:border-white/10 dark:bg-white/5 dark:text-white md:flex">
          <p className="flex items-center gap-1.5 text-xs text-plum-500 dark:text-white/55"><Sparkles className="size-3 text-magenta" /> Link público</p>
          <CopyLinkButton
            url={publicUrl}
            className="border-violet-950/10 bg-white/80 text-plum-900 hover:bg-violet-100 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-violet-950/6 bg-white/70 px-4 py-3 backdrop-blur-xl transition-colors dark:border-white/8 dark:bg-[#21172c]/80 md:px-8">
          <div className="flex flex-col gap-2 md:hidden">
            <CopyLinkButton url={publicUrl} />
          </div>
          <CommandPalette />
          <div className="flex items-center gap-1"><ThemeToggle /><SignOutButton /></div>
        </header>
        <main className="flex-1 bg-[radial-gradient(circle_at_88%_0%,#eee6ff_0,transparent_27%),linear-gradient(180deg,#faf9ff_0%,#f7f5fc_100%)] px-4 py-6 transition-colors dark:bg-[radial-gradient(circle_at_88%_0%,#30203f_0,transparent_28%),linear-gradient(180deg,#171020_0%,#20152b_100%)] md:px-8 md:py-9">{children}</main>
      </div>
    </div>
  );
}
