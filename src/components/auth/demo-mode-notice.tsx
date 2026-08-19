import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function DemoModeNotice() {
  return (
    <Alert className="border border-violet-500/20 bg-violet-950/80 p-3">
      <AlertTriangle className="size-3.5 text-violet-300" />
      <AlertTitle className="text-[0.95rem] font-semibold text-white">Supabase ainda não configurado</AlertTitle>
      <AlertDescription className="mt-1 text-sm leading-6 text-violet-200/80">
        <p>
          O login real depende das chaves em <code className="text-violet-100">.env.local</code> (veja o README). Enquanto
          isso, entre no modo demonstração para ver o painel com dados fictícios do
          &quot;Bella Studio&quot;.
        </p>
        <Button
          render={<Link href="/app" />}
          nativeButton={false}
          size="sm"
          className="mt-3 h-9 bg-cta text-white hover:opacity-90"
        >
          Entrar no modo demonstração
        </Button>
      </AlertDescription>
    </Alert>
  );
}
