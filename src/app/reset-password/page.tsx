import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandMark } from "@/components/auth/brand-mark";
import { AuthShell, AUTH_CARD_CLASS } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Nova senha — Agenda Online" };

export default function ResetPasswordPage() {
  return (
    <AuthShell showcase={false}>
      <BrandMark />

      <Card className={AUTH_CARD_CLASS}>
        <CardHeader className="px-6 pt-6 pb-5">
          <CardTitle className="text-2xl leading-tight text-white">Nova senha</CardTitle>
          <CardDescription className="mt-1.5 text-sm leading-6 text-blush-50/70">
            Escolha uma senha segura para voltar ao painel.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
