import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="font-heading text-4xl font-semibold text-plum-900 dark:text-blush-50">
        Agenda Online
      </h1>
      <p className="max-w-md text-muted-foreground">
        Scaffold Next.js + TypeScript + Tailwind + shadcn/ui pronto. Tema da
        Promatic Solutions aplicado.
      </p>
      <div className="flex gap-3">
        <Button className="bg-cta text-white hover:opacity-90">
          Botão de ação (gradiente)
        </Button>
        <Button variant="outline">Secundário</Button>
      </div>
    </div>
  );
}
