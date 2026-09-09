"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CheckCircle2, LockKeyhole } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Nova senha, a partir do link enviado por e-mail.
 *
 * Não recebe token por props: o Supabase troca o código do link por uma sessão
 * de recuperação no próprio navegador antes desta tela renderizar, e é essa
 * sessão que autoriza o `updateUser`. Por isso um link expirado só aparece
 * como erro no envio — não há nada para validar antes disso.
 */
export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Use pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await createBrowserSupabaseClient().auth.updateUser({
      password,
    });
    setLoading(false);

    if (updateError) {
      // O caso mais comum aqui é o link expirado, e é o que a mensagem de
      // reserva diz. Os demais (senha fraca, senha igual à anterior) têm
      // frase própria e precisam chegar como são — mandar todo mundo
      // "solicitar nova redefinição" faria a pessoa refazer o processo por
      // um problema que ela resolveria trocando a senha digitada.
      setError(
        authErrorMessage(
          updateError,
          "Este link expirou ou é inválido. Solicite uma nova redefinição."
        )
      );
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-wa/20 bg-wa/8 p-4 text-sm text-muted-foreground">
        <CheckCircle2 className="mb-3 size-8 text-wa" />
        <p>Sua senha foi atualizada. Agora você já pode entrar.</p>
        <Link href="/login" className="mt-4 inline-flex font-semibold text-violet-600">
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Campo
        id="new-password"
        label="Nova senha"
        value={password}
        onChange={setPassword}
      />
      <Campo
        id="confirmation"
        label="Confirmar nova senha"
        value={confirmation}
        onChange={setConfirmation}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading} className="h-11 bg-cta text-white">
        {loading ? "Atualizando..." : "Salvar nova senha"}
      </Button>
    </form>
  );
}

function Campo({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type="password"
          autoComplete="new-password"
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 pl-10"
        />
      </div>
    </div>
  );
}
