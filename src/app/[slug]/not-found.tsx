import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function StudioNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="font-heading text-3xl font-semibold text-plum-900 dark:text-blush-50">
        Estúdio não encontrado
      </h1>
      <p className="max-w-sm text-muted-foreground">
        Verifique se o link está certo com quem te enviou, ou confirme com o estúdio se a
        página ainda está ativa.
      </p>
      <Button render={<Link href="/" />} className="bg-cta text-white hover:opacity-90">
        Voltar para o início
      </Button>
    </div>
  );
}
