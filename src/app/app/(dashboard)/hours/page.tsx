import { getMyStudio } from "@/lib/data/studios";
import { listMyWorkingHours } from "@/lib/data/workingHours";
import { listMyBlocks } from "@/lib/data/blocks";
import { WorkingHoursEditor } from "@/components/app/working-hours-editor";
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
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-10">
      <div>
        <p className="text-xs font-bold tracking-[.14em] text-violet-600 uppercase">Disponibilidade</p>
        <h1 className="mt-1 font-heading text-3xl font-semibold text-plum-900 dark:text-foreground">Quando você atende?</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Configure sua semana em poucos cliques. Desative os dias fechados e adicione outro período apenas quando precisar, como para separar manhã e tarde.</p>
        <div className="mt-6"><WorkingHoursEditor workingHours={workingHours} /></div>
      </div>

      <div>
        <p className="text-xs font-bold tracking-[.14em] text-violet-600 uppercase">Exceções</p>
        <h2 className="mt-1 font-heading text-2xl font-semibold text-plum-900 dark:text-foreground">
          Folgas e bloqueios pontuais
        </h2>
        <p className="mt-2 text-muted-foreground">
          Bloqueie um horário específico (almoço, feriado, folga) mesmo dentro de um turno aberto.
        </p>
        <div className="mt-4">
          <BlocksEditor blocks={blocks} />
        </div>
      </div>
    </div>
  );
}
