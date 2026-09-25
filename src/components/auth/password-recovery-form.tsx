"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail, Send } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_INPUT_CLASS } from "@/components/auth/password-input";
import { AuthError } from "@/components/auth/auth-error";

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
    if (recoveryError) {
      return setError(
        authErrorMessage(recoveryError, "Não foi possível enviar o e-mail agora. Tente de novo.")
      );
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status" className="rounded-xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground shadow-float">
        <CheckCircle2 className="mb-3 size-8 text-wa" aria-hidden />
        <p>
          Se existe uma conta para <strong className="font-semibold text-foreground break-all">{email}</strong>,
          enviamos as instruções para criar uma nova senha. Confira também a caixa de spam.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center gap-1 font-semibold text-primary hover:underline dark:text-violet-300"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Voltar para entrar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="recovery-email">E-mail cadastrado</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="recovery-email"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={AUTH_INPUT_CLASS}
          />
        </div>
      </div>
      {error && <AuthError>{error}</AuthError>}
      <Button type="submit" size="lg" disabled={loading} className="h-11 w-full">
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden /> Enviando...
          </>
        ) : (
          <>
            Enviar instruções <Send className="size-4" aria-hidden />
          </>
        )}
      </Button>
      <Link
        href="/login"
        className="mx-auto inline-flex items-center gap-1 rounded text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Voltar para entrar
      </Link>
    </form>
  );
}
