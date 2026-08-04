import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { checkPlatformAdmin } from "@/lib/data/platformAdmins";
import { SuperAdminShell } from "@/components/superadmin/superadmin-shell";
import { Button } from "@/components/ui/button";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const check = await checkPlatformAdmin();

  if (check.status === "unauthenticated") {
    redirect("/login?next=/superadmin");
  }

  if (check.status === "forbidden") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="size-6" />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-semibold text-plum-900">Acesso restrito</h1>
          <p className="mt-1 max-w-sm text-muted-foreground">
            Essa área é exclusiva da equipe Promatic. Se você acha que deveria ter acesso, fale
            com quem administra a plataforma.
          </p>
        </div>
        <Button render={<Link href="/app" />} variant="outline">
          Ir para o meu painel
        </Button>
      </div>
    );
  }

  return <SuperAdminShell adminEmail={check.admin.email}>{children}</SuperAdminShell>;
}
