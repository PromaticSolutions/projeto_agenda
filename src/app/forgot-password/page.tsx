import { AuthShell, AuthHeading } from "@/components/auth/auth-shell";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";

export const metadata = { title: "Recuperar senha — Timely" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <AuthHeading
        title="Esqueceu sua senha?"
        description="Informe o e-mail da sua conta e enviamos um link seguro para criar uma nova."
      />
      <PasswordRecoveryForm />
    </AuthShell>
  );
}
