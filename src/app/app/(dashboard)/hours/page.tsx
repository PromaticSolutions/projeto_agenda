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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
      <header className="flex flex-col gap-1 border-b border-border pb-5">
        <h1 className="text-2xl font-semibold text-foreground">Horários</h1>
        <p className="text-sm text-muted-foreground">
          Os dias e horários em que o seu link de agendamento oferece vagas.
        </p>
      </header>

      <WorkingHoursEditor workingHours={workingHours} />
      <BlocksEditor blocks={blocks} />
    </div>
  );
}
