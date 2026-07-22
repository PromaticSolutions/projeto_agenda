"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    if (!isSupabaseConfigured) {
      toast.info("Modo demonstração: não há sessão real para encerrar.");
      router.push("/");
      return;
    }
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
      <LogOut className="size-4" />
      Sair
    </Button>
  );
}
