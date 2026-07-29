"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CheckCircle2, LockKeyhole } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(null); if (password.length < 6) return setError("Use pelo menos 6 caracteres."); if (password !== confirmation) return setError("As senhas não coincidem."); setLoading(true); const { error: updateError } = await createBrowserSupabaseClient().auth.updateUser({ password }); setLoading(false); if (updateError) return setError("Este link expirou ou é inválido. Solicite uma nova redefinição."); setSuccess(true); }
  if (success) return <div className="rounded-2xl border border-wa/20 bg-wa/8 p-4 text-sm text-muted-foreground"><CheckCircle2 className="mb-3 size-8 text-wa" /><p>Sua senha foi atualizada. Agora você já pode entrar.</p><Link href="/login" className="mt-4 inline-flex font-semibold text-violet-600">Ir para o login</Link></div>;
  return <form onSubmit={handleSubmit} className="flex flex-col gap-4">{[["new-password", "Nova senha", password, setPassword], ["confirmation", "Confirmar nova senha", confirmation, setConfirmation]].map(([id, label, value, onChange]) => <div key={id as string} className="flex flex-col gap-2"><Label htmlFor={id as string}>{label as string}</Label><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id={id as string} type="password" autoComplete="new-password" required value={value as string} onChange={(event) => (onChange as (value: string) => void)(event.target.value)} className="h-11 pl-10" /></div></div>)}{error && <p className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={loading} className="h-11 bg-cta text-white">{loading ? "Atualizando..." : "Salvar nova senha"}</Button></form>;
}
