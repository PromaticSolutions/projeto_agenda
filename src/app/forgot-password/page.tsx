import { KeyRound } from "lucide-react";
import { BrandMark, AuthBackdrop } from "@/components/auth/brand-mark";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Recuperar senha — Agenda Online" };
export default function ForgotPasswordPage() {
  return (
    <div className="auth-motion-bg relative flex flex-1 flex-col items-center justify-center gap-8 overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
      <AuthBackdrop />
      <BrandMark />
      <Card className="relative w-full max-w-sm overflow-hidden border !border-violet-500/20 bg-violet-950/100 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="h-1 bg-cta" />
        <CardHeader className="px-6 pb-5 pt-6">
          <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-violet-600/15 text-violet-200">
            <KeyRound className="size-5" />
          </span>
          <CardTitle className="font-heading text-[1.7rem] leading-tight text-white">Redefina sua senha</CardTitle>
          <CardDescription className="mt-2 text-sm leading-6 text-violet-200/85">Enviaremos um link seguro para o seu e-mail.</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <PasswordRecoveryForm />
        </CardContent>
      </Card>
    </div>
  );
}
