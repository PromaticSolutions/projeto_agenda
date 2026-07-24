import { getMyStudio } from "@/lib/data/studios";
import { listMyWorkingHours } from "@/lib/data/workingHours";
import { listMyBlocks } from "@/lib/data/blocks";
import { WorkingHoursEditor } from "@/components/app/working-hours-editor";
import { WeeklyHoursGrid } from "@/components/app/weekly-hours-grid";
import { BlocksEditor } from "@/components/app/blocks-editor";

export const metadata = { title: "Horários — Agenda Online" };

export default async function HoursPage() {
  const studio = await getMyStudio();
  if (!studio) return null;

  const [workingHours, blocks] = await Promise.all([
    listMyWorkingHours(studio.id),
    listMyBlocks(studio.id),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-plum-900">
          Horários de atendimento
        </h1>
        <p className="text-muted-foreground">
          Adicione um ou mais turnos por dia da semana. Dias sem turno ficam fechados.
        </p>
        <div className="mt-4">
          <WeeklyHoursGrid workingHours={workingHours} />
        </div>
        <div className="mt-4">
          <WorkingHoursEditor workingHours={workingHours} />
        </div>
      </div>

      <div>
        <h2 className="font-heading text-xl font-semibold text-plum-900">
          Folgas e bloqueios pontuais
        </h2>
        <p className="text-muted-foreground">
          Bloqueie um horário específico (almoço, feriado, folga) mesmo dentro de um turno aberto.
        </p>
        <div className="mt-4">
          <BlocksEditor blocks={blocks} />
        </div>
      </div>
    </div>
  );
}
