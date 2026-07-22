"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface RootErrorProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

export default function RootError({ error, unstable_retry }: RootErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="font-heading text-2xl font-semibold text-plum-900 dark:text-blush-50">
        Algo deu errado
      </h1>
      <p className="max-w-sm text-muted-foreground">
        Tente novamente. Se o problema continuar, volte para o início.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => unstable_retry()} variant="outline">
          Tentar de novo
        </Button>
        <Button render={<Link href="/" />} className="bg-cta text-white hover:opacity-90">
          Início
        </Button>
      </div>
    </div>
  );
}
