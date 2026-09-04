import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandMark } from "@/components/auth/brand-mark";
import { AuthShell, AUTH_CARD_CLASS } from "@/components/auth/auth-shell";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";

export const metadata = { title: "Recuperar senha — Timely" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell showcase={false}>
      <BrandMark />

      <Card className={AUTH_CARD_CLASS}>
        <CardHeader className="px-6 pt-6 pb-5">
          <CardTitle className="text-2xl leading-tight text-white">Redefinir senha</CardTitle>
          <CardDescription className="mt-1.5 text-sm leading-6 text-blush-50/70">
            Enviamos um link seguro para o seu e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <PasswordRecoveryForm />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
