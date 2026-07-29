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

  if (sent) return <div className="rounded-2xl border border-wa/20 bg-wa/8 p-4 text-sm text-muted-foreground"><CheckCircle2 className="mb-3 size-8 text-wa" /><p>Se existe uma conta para <strong className="text-plum-900">{email}</strong>, enviamos as instruções de redefinição.</p><Link href="/login" className="mt-4 inline-flex font-semibold text-violet-600">Voltar para entrar</Link></div>;

  return <form onSubmit={handleSubmit} className="flex flex-col gap-4"><div className="flex flex-col gap-2"><Label htmlFor="recovery-email">E-mail cadastrado</Label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 pl-10" /></div></div>{error && <p className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={loading} className="h-11 bg-cta text-white shadow-lg shadow-violet-600/20">{loading ? "Enviando..." : <>Enviar instruções <Send className="size-4" /></>}</Button><Link href="/login" className="mx-auto inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-violet-600"><ArrowLeft className="size-3.5" /> Voltar para entrar</Link></form>;
}
