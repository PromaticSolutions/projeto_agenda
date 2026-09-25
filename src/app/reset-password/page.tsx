import { AuthShell, AuthHeading } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Nova senha — Timely" };

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <AuthHeading title="Crie uma nova senha" description="Escolha uma senha segura para voltar ao painel." />
      <ResetPasswordForm />
    </AuthShell>
  );
}
