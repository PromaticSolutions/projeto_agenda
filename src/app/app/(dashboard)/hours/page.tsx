import { getMyStudio } from "@/lib/data/studios";
import { listMyWorkingHours } from "@/lib/data/workingHours";
import { listMyBlocks } from "@/lib/data/blocks";
import { WorkingHoursEditor } from "@/components/app/working-hours-editor";
import { BlocksEditor } from "@/components/app/blocks-editor";

export const metadata = { title: "Horários — Timely" };

export default async function HoursPage() {
  const studio = await getMyStudio();
  if (!studio) return null;

  const [workingHours, blocks] = await Promise.all([
    listMyWorkingHours(studio.id),
    listMyBlocks(studio.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="space-y-1 border-b border-border pb-5">
        <h1 className="text-xl font-semibold text-foreground">Horários</h1>
        <p className="text-sm text-muted-foreground">
          A grade semanal define quando o link público oferece vagas.
        </p>
      </header>

      <WorkingHoursEditor workingHours={workingHours} />

      <section className="flex flex-col gap-3">
        <div className="space-y-0.5">
          <h2 className="font-medium text-foreground">Folgas e bloqueios</h2>
          <p className="text-sm text-muted-foreground">
            Fecham um intervalo específico mesmo dentro de um turno aberto.
          </p>
        </div>
        <BlocksEditor blocks={blocks} />
      </section>
    </div>
  );
}
