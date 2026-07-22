import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function DemoModeNotice() {
  return (
    <Alert className="border-violet-500/40 bg-violet-500/5">
      <AlertTriangle className="size-4 text-violet-600" />
      <AlertTitle>Supabase ainda não configurado</AlertTitle>
      <AlertDescription>
        <p>
          O login real depende das chaves em <code>.env.local</code> (veja o README). Enquanto
          isso, entre no modo demonstração para ver o painel com dados fictícios do
          &quot;Bella Studio&quot;.
        </p>
        <Button
          render={<Link href="/app" />}
          size="sm"
          className="mt-3 bg-cta text-white hover:opacity-90"
        >
          Entrar no modo demonstração
        </Button>
      </AlertDescription>
    </Alert>
  );
}
