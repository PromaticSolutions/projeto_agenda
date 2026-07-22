import { getMyStudio } from "@/lib/data/studios";

export const metadata = { title: "Painel do dia — Agenda Online" };

export default async function DashboardHomePage() {
  const studio = await getMyStudio();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-heading text-2xl font-semibold text-plum-900 dark:text-blush-50">
        Olá, {studio?.name}
      </h1>
      <p className="text-muted-foreground">
        O painel do dia (contadores, lista de agendamentos e busca) é construído na etapa 8.
      </p>
    </div>
  );
}
