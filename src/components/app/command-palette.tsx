"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  BellRing,
  CalendarDays,
  CircleUserRound,
  Clock,
  MessageCircle,
  Scissors,
  Search,
  Settings,
  Users,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: typeof CalendarDays;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Painel do dia", href: "/app", icon: CalendarDays },
  { label: "Clientes", href: "/app/clients", icon: Users },
  { label: "Serviços", href: "/app/services", icon: Scissors },
  { label: "Horários", href: "/app/hours", icon: Clock },
  { label: "Lembretes", href: "/app/reminders", icon: BellRing },
  { label: "WhatsApp", href: "/app/whatsapp", icon: MessageCircle },
  { label: "Conta", href: "/app/account", icon: CircleUserRound },
  { label: "Configurações", href: "/app/settings", icon: Settings },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setQuery("");
  }

  const filtered = NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (filtered.length > 0) {
      go(filtered[0].href);
    } else if (query.trim()) {
      go(`/app?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
      >
        <Search className="size-3.5" />
        Buscar
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </button>

    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-plum-900/35 backdrop-blur-sm duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed top-[15%] left-1/2 z-50 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-2xl shadow-plum-900/25 ring-1 ring-plum-900/10 outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 sm:max-w-md">
          <DialogPrimitive.Title className="sr-only">Buscar e navegar</DialogPrimitive.Title>
          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ir para... ou buscar um agendamento"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              esc
            </kbd>
          </form>
          <div className="flex flex-col gap-0.5 p-1.5">
            {filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => go(item.href)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon className="size-4 text-muted-foreground" />
                  {item.label}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <button
                type="button"
                onClick={() => go(`/app?q=${encodeURIComponent(query.trim())}`)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Search className="size-4 text-muted-foreground" />
                Buscar agendamento por &quot;{query.trim()}&quot;
              </button>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
    </>
  );
}
