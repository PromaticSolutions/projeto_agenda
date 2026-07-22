"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/app/sign-out-button";
import { CopyLinkButton } from "@/components/app/copy-link-button";
import type { Studio } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/app", label: "Painel do dia", icon: CalendarDays },
  { href: "/app/services", label: "Serviços", icon: Scissors },
  { href: "/app/hours", label: "Horários", icon: Clock },
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
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-border bg-card px-4 py-5 md:w-64 md:border-b-0 md:border-r md:px-5 md:py-6">
        <div className="flex items-center gap-2">
          <span
            className="flex size-9 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: studio.brand_color }}
          >
            {studio.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-heading text-base font-semibold text-plum-900 dark:text-blush-50">
              {studio.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">/{studio.slug}</p>
          </div>
        </div>

        <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-violet-600 text-white"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto hidden flex-col gap-2 md:flex">
          <p className="text-xs text-muted-foreground">Link público</p>
          <CopyLinkButton url={publicUrl} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:px-8">
          <div className="flex flex-col gap-2 md:hidden">
            <CopyLinkButton url={publicUrl} />
          </div>
          <div />
          <SignOutButton />
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
