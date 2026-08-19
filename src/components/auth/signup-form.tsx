"use client";

import { useState, type FormEvent } from "react";
import { Check, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // Com "Confirm email" ativo, o Supabase pode retornar sucesso para um
    // e-mail já existente a fim de não expor quais endereços têm conta. Nesse
    // caso `identities` vem vazio — tratamos de forma honesta na interface.
    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      setError("Este e-mail já possui uma conta. Entre ou redefina sua senha para continuar.");
      return;
    }

    if (data.session) {
      router.push("/app/onboarding");
      router.refresh();
      return;
    }

    setNeedsEmailConfirmation(true);
  }

  if (needsEmailConfirmation) {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-violet-950/85 p-4 text-sm text-violet-100">
        <span className="mb-3 flex size-9 items-center justify-center rounded-xl bg-violet-600 text-white"><Mail className="size-4" /></span>
        Enviamos um link de confirmação para <strong className="text-white">{email}</strong>. Abra seu e-mail, confirme a conta e depois faça login.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="rounded-2xl border border-violet-500/20 bg-violet-950/85 px-4 py-3 text-sm text-violet-100">
        <span className="flex items-center gap-2 text-sm text-violet-100"><ShieldCheck className="size-4 text-violet-300" /> Seus dados são protegidos e você pode editar tudo depois.</span>
      </div>
      <div className="flex flex-col gap-2.5">
        <Label htmlFor="email" className="text-sm font-medium text-violet-100">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 rounded-2xl border border-violet-500/20 bg-white/5 px-3 text-white focus-visible:border-white/30 focus-visible:ring-3 focus-visible:ring-white/10"
        />
      </div>
      <div className="flex flex-col gap-2.5">
        <Label htmlFor="password" className="text-sm font-medium text-violet-100">Senha</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 rounded-2xl border border-violet-500/20 bg-white/5 px-3 text-white focus-visible:border-white/30 focus-visible:ring-3 focus-visible:ring-white/10"
        />
        <div className="flex items-center gap-1.5" aria-label="Força da senha">
          {[1, 2, 3].map((level) => <span key={level} className={`h-1 flex-1 rounded-full transition-colors ${level <= passwordStrength ? passwordStrength === 1 ? "bg-magenta" : passwordStrength === 2 ? "bg-violet-500" : "bg-violet-600" : "bg-border"}`} />)}
        </div>
        <p className="text-xs text-violet-200/75">Use pelo menos 6 caracteres. Quanto maior, mais segura.</p>
      </div>
      {error && <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <Button type="submit" className="mt-1 h-11 bg-cta text-white hover:opacity-90" disabled={loading}>
        {loading ? "Criando conta..." : <><Check className="size-4" /> Criar minha conta</>}
      </Button>
    </form>
  );
}
