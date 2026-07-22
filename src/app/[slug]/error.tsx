"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

interface StudioErrorProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

export default function StudioError({ error, unstable_retry }: StudioErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="font-heading text-2xl font-semibold text-plum-900 dark:text-blush-50">
        Não foi possível carregar esta página
      </h1>
      <p className="max-w-sm text-muted-foreground">
        Algo deu errado ao buscar os horários. Tente novamente em instantes.
      </p>
      <Button onClick={() => unstable_retry()} className="bg-cta text-white hover:opacity-90">
        Tentar de novo
      </Button>
    </div>
  );
}
