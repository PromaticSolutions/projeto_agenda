import { WEEKDAY_LABELS_SHORT } from "@/lib/weekdays";
import type { WorkingHour } from "@/lib/types";

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Resumo visual (só leitura) da semana — o editor por dia abaixo continua sendo
 * a forma de adicionar/remover turnos; isto é só pra bater o olho e ver buracos. */
export function WeeklyHoursGrid({ workingHours }: { workingHours: WorkingHour[] }) {
  const times = workingHours.flatMap((w) => [timeToMinutes(w.start_time), timeToMinutes(w.end_time)]);
  const domainStart = Math.min(8 * 60, ...times);
  const domainEnd = Math.max(20 * 60, ...times);
  const domainSpan = Math.max(domainEnd - domainStart, 60);

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-plum-900/5 sm:p-5">
      <div className="grid grid-cols-7 gap-2">
        {WEEKDAY_LABELS_SHORT.map((label, weekday) => {
          const shifts = workingHours.filter((w) => w.weekday === weekday);
          return (
            <div key={label} className="flex flex-col gap-1.5">
              <p className="text-center text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
                {label}
              </p>
              <div className="relative h-28 overflow-hidden rounded-lg bg-muted/60 sm:h-36">
                {shifts.map((shift) => {
                  const top = ((timeToMinutes(shift.start_time) - domainStart) / domainSpan) * 100;
                  const height =
                    ((timeToMinutes(shift.end_time) - timeToMinutes(shift.start_time)) / domainSpan) * 100;
                  return (
                    <div
                      key={shift.id}
                      className="absolute inset-x-1 rounded-md bg-cta"
                      style={{ top: `${top}%`, height: `${height}%` }}
                      title={`${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
