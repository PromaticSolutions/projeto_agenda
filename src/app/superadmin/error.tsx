"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface SuperAdminErrorProps {
  error: Error & { digest?: string; code?: string };
  unstable_retry: () => void;
}

/**
 * Mesmo raciocínio do error boundary do /app: `unstable_retry` (e não `reset`)
 * porque a causa mais provável de erro aqui é uma migração que ainda não
 * rodou — e nesse caso re-renderizar sem buscar de novo não resolve nada.
 *
 * A mensagem do erro aparece na tela porque quem vê esta página é quem
 * administra a plataforma, não a cliente final.
 */
export default function SuperAdminError({ error, unstable_retry }: SuperAdminErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isMissingTable =
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message.includes("does not exist") ||
    error.message.includes("schema cache");

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <Alert className="border-destructive/40 bg-destructive/5 text-left">
        <AlertTriangle className="size-4 text-destructive" />
        <AlertTitle>
          {isMissingTable ? "Falta rodar uma migração" : "Não foi possível carregar o painel"}
        </AlertTitle>
        <AlertDescription>
          <p>
            {isMissingTable
              ? "Alguma tabela usada por esta tela não existe no banco. Rode as migrações pendentes de supabase/migrations no SQL Editor do Supabase."
              : error.message || "Erro inesperado ao agregar as métricas."}
          </p>
        </AlertDescription>
      </Alert>
      <Button variant="outline" onClick={() => unstable_retry()}>
        Tentar de novo
      </Button>
    </div>
  );
}
