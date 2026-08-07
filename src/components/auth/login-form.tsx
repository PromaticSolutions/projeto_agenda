"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createBrowserSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : signInError.message
      );
      return;
    }

    router.push(searchParams.get("next") ?? "/app");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <Label htmlFor="email" className="text-sm font-medium text-foreground">E-mail</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-2xl border border-violet-500/20 bg-violet-950/75 px-3 pl-10 text-white shadow-sm transition-all duration-200 placeholder:text-violet-300/50 focus-visible:border-violet-500 focus-visible:ring-3 focus-visible:ring-violet-500/15" />
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password" className="text-sm font-medium text-foreground">Senha</Label>
          <Link href="/forgot-password" className="text-xs font-semibold text-violet-600 transition-colors hover:text-violet-700">Esqueci minha senha</Link>
        </div>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-2xl border border-violet-500/20 bg-violet-950/75 px-3 pl-10 text-white shadow-sm transition-all duration-200 placeholder:text-violet-300/50 focus-visible:border-violet-500 focus-visible:ring-3 focus-visible:ring-violet-500/15" />
        </div>
      </div>
      {error && <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <Button type="submit" className="mt-1 h-12 bg-cta text-white shadow-lg shadow-violet-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90" disabled={loading}>
        {loading ? "Entrando..." : <>Entrar no painel <ArrowRight className="size-4" /></>}
      </Button>
    </form>
  );
}
