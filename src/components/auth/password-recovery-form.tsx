"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Mail, Send } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordRecoveryForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error: recoveryError } = await createBrowserSupabaseClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (recoveryError) return setError(recoveryError.message);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-violet-900/80 p-4 text-sm text-violet-100">
        <CheckCircle2 className="mb-3 size-8 text-violet-300" />
        <p>Se existe uma conta para <strong className="text-white">{email}</strong>, enviamos as instruções de redefinição.</p>
        <Link href="/login" className="mt-4 inline-flex font-semibold text-white transition-colors hover:text-violet-200">Voltar para entrar</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <Label htmlFor="recovery-email" className="text-sm font-medium text-violet-100">E-mail cadastrado</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-violet-400/80" />
          <Input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 border border-white/12 bg-white/[0.06] px-3 pl-10 text-white transition-colors placeholder:text-violet-300/60 focus-visible:border-white/30 focus-visible:ring-3 focus-visible:ring-white/10" />
        </div>
      </div>
      {error && <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading} className="h-11 bg-cta text-white hover:opacity-90">
        {loading ? "Enviando..." : <>Enviar instruções <Send className="size-4" /></>}
      </Button>
      <Link href="/login" className="mx-auto inline-flex items-center gap-1 text-sm font-medium text-violet-200 transition-colors hover:text-white">
        <ArrowLeft className="size-3.5" /> Voltar para entrar
      </Link>
    </form>
  );}
