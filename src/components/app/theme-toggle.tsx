"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return <Button type="button" variant="ghost" size="icon" onClick={() => setTheme(isDark ? "light" : "dark")} aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"} title={isDark ? "Ativar tema claro" : "Ativar tema escuro"} className="rounded-full text-muted-foreground hover:bg-violet-600/10 hover:text-violet-600">{isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>;
}
