"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface DashboardErrorProps {
  error: Error & { digest?: string; code?: string };
  unstable_retry: () => void;
}

export default function DashboardError({ error, unstable_retry }: DashboardErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // 42P01 = Postgres "undefined_table"; PGRST205 = PostgREST "não achei essa
  // tabela no cache do schema" — é o que a Supabase realmente devolve quando
  // a migração ainda não rodou (confirmado testando contra um projeto real
  // sem a migração: {"code":"PGRST205","message":"Could not find the table
  // 'public.studios' in the schema cache"}).
  const isMissingTable =
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message.includes("does not exist") ||
    error.message.includes("schema cache");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Alert className="max-w-md border-destructive/40 bg-destructive/5 text-left">
        <AlertTriangle className="size-4 text-destructive" />
        <AlertTitle>
          {isMissingTable ? "O banco ainda não tem as tabelas do app" : "Algo deu errado"}
        </AlertTitle>
        <AlertDescription>
          {isMissingTable ? (
            <p>
              Rode a migração <code>supabase/migrations/0001_init.sql</code> no SQL Editor do seu
              projeto Supabase (veja o README.md) e tente de novo.
            </p>
          ) : (
            <p>{error.message || "Não foi possível carregar esta página."}</p>
          )}
        </AlertDescription>
      </Alert>
      <Button onClick={() => unstable_retry()} variant="outline">
        Tentar de novo
      </Button>
    </div>
  );
}
