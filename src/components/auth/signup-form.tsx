"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";
import { EmailConfirmationDialog } from "@/components/auth/email-confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_INPUT_CLASS, PasswordInput } from "@/components/auth/password-input";
import { AuthError } from "@/components/auth/auth-error";
import { cn } from "@/lib/utils";

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
      setError(authErrorMessage(signUpError, "Não foi possível criar a conta agora. Tente de novo."));
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

  return (
    <>
      {/* Fora do <form>: o modal vive num portal, e mantê-lo irmão do
          formulário deixa claro que ele não participa do envio. */}
      <EmailConfirmationDialog
        open={needsEmailConfirmation}
        email={email}
        // A conta já existe neste ponto — voltar ao formulário só levaria ao
        // erro de "e-mail já cadastrado". Qualquer forma de fechar vai ao login.
        onClose={() => router.push("/login")}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="voce@exemplo.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={AUTH_INPUT_CLASS}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Crie uma senha</Label>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={6}
            describedBy="password-hint"
          />
          {/* A barra acompanha a digitação; o texto embaixo diz a regra que
              ela mede, para a cor não ser o único jeito de entender. */}
          <div className="mt-1 flex items-center gap-1.5" aria-hidden>
            {[1, 2, 3].map((level) => (
              <span
                key={level}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-200",
                  level <= passwordStrength
                    ? passwordStrength === 1
                      ? "bg-destructive"
                      : passwordStrength === 2
                        ? "bg-amber-500"
                        : "bg-wa"
                    : "bg-border"
                )}
              />
            ))}
          </div>
          <p id="password-hint" className="text-xs text-muted-foreground">
            Use pelo menos 6 caracteres. Quanto maior, mais segura.
          </p>
        </div>

        {error && <AuthError>{error}</AuthError>}

        <Button type="submit" size="lg" className="mt-1 h-11 w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden /> Criando sua conta...
            </>
          ) : (
            <>
              Criar minha conta grátis <ArrowRight className="size-4" aria-hidden />
            </>
          )}
        </Button>

        <p className="flex items-start justify-center gap-1.5 text-center text-xs leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary dark:text-violet-300" aria-hidden />
          Seus dados ficam protegidos, e você pode editar tudo depois.
        </p>
      </form>
    </>
  );
}
