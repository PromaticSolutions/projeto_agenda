"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { saveWorkingWeekAction } from "@/app/app/(dashboard)/hours/actions";
import { WEEKDAY_LABELS } from "@/lib/weekdays";
import {
  DEFAULT_PERIOD,
  newPeriodKey,
  suggestNextPeriod,
  validateWeek,
  weekFromWorkingHours,
  weekToShifts,
  type DraftPeriod,
  type DraftWeek,
} from "@/lib/working-week";
import { cn } from "@/lib/utils";
import type { WorkingHour } from "@/lib/types";

/**
 * A semana de trabalho, um dia por linha.
 *
 * Cada linha tem o mesmo desenho: o interruptor do dia, o nome, os períodos
 * como dois campos de hora ("09:00 às 18:00") e, à direita, adicionar período
 * e copiar para outros dias. Dia desligado mostra "Indisponível" no lugar dos
 * campos — a semana se lê de cima a baixo sem precisar interpretar nada.
 *
 * A semana é um RASCUNHO até a pessoa salvar. A versão anterior gravava a
 * cada clique (abrir dia, adicionar período), e editar um horário significava
 * apagar e recriar o período; com a semana inteira na tela, o natural é mexer
 * em vários dias e salvar uma vez. A barra de salvar só aparece quando há
 * mudança, e sair da página com mudança pendente pede confirmação.
 *
 * Desligar um dia NÃO apaga os períodos do rascunho: religar devolve o que
 * estava lá. Só o que está ligado na hora de salvar vai para o banco.
 *
 * A validação (fim depois do início, nada sobreposto) é a mesma função que a
 * server action usa (`lib/working-week.ts`) e marca o período errado na hora.
 */

/** Segunda primeiro: é como a semana de trabalho é lida, e o domingo, que
 *  quase sempre é folga, vai para o fim. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAYS = [1, 2, 3, 4, 5];

function signature(week: DraftWeek): string {
  return JSON.stringify(
    weekToShifts(week).sort((a, b) =>
      `${a.weekday}${a.start_time}`.localeCompare(`${b.weekday}${b.start_time}`)
    )
  );
}

export function WorkingHoursEditor({ workingHours }: { workingHours: WorkingHour[] }) {
  const initial = useMemo(() => weekFromWorkingHours(workingHours), [workingHours]);
  const [week, setWeek] = useState<DraftWeek>(initial);
  const [saving, startSaving] = useTransition();

  const errors = useMemo(() => validateWeek(week), [week]);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = signature(week) !== signature(initial);

  // Sair com mudança pendente pede confirmação do navegador — perder uma
  // semana inteira de ajustes por um clique no menu é o pior tipo de erro.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function updateDay(weekday: number, update: (day: DraftWeek[number]) => DraftWeek[number]) {
    setWeek((current) => current.map((day, i) => (i === weekday ? update(day) : day)));
  }

  function toggleDay(weekday: number, enabled: boolean) {
    updateDay(weekday, (day) => ({
      enabled,
      periods:
        enabled && day.periods.length === 0 ? [{ key: newPeriodKey(), ...DEFAULT_PERIOD }] : day.periods,
    }));
  }

  function setPeriod(weekday: number, key: string, patch: Partial<DraftPeriod>) {
    updateDay(weekday, (day) => ({
      ...day,
      periods: day.periods.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    }));
  }

  function addPeriod(weekday: number) {
    updateDay(weekday, (day) => ({ ...day, periods: [...day.periods, suggestNextPeriod(day.periods)] }));
  }

  function removePeriod(weekday: number, key: string) {
    updateDay(weekday, (day) => {
      const periods = day.periods.filter((p) => p.key !== key);
      // Tirou o último período: o dia fecha, em vez de ficar "ligado e vazio".
      return { enabled: periods.length > 0, periods };
    });
  }

  function copyDay(from: number, targets: number[]) {
    const source = week[from];
    setWeek((current) =>
      current.map((day, weekday) =>
        targets.includes(weekday)
          ? {
              enabled: source.enabled,
              periods: source.periods.map((p) => ({ ...p, key: newPeriodKey() })),
            }
          : day
      )
    );
    toast.success(
      `Horários de ${WEEKDAY_LABELS[from].toLowerCase()} copiados para ${targets.length} ${
        targets.length === 1 ? "dia" : "dias"
      }. Salve para confirmar.`
    );
  }

  function save() {
    if (hasErrors) {
      toast.error("Corrija os horários marcados antes de salvar.");
      return;
    }
    startSaving(async () => {
      const result = await saveWorkingWeekAction(weekToShifts(week));
      if (result?.ok) toast.success("Horários salvos. O link de agendamento já usa a nova semana.");
      else toast.error(result?.error ?? "Não foi possível salvar os horários.");
    });
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="semana-titulo">
      <div className="flex flex-col gap-0.5">
        <h2 id="semana-titulo" className="text-base font-semibold text-foreground">
          Horário semanal
        </h2>
        <p className="text-sm text-muted-foreground">
          Ligue os dias em que você atende. Use o + para uma pausa, como o almoço.
        </p>
      </div>

      <ul className="panel shadow-float divide-y divide-border overflow-hidden">
        {DAY_ORDER.map((weekday) => {
          const day = week[weekday];
          const label = WEEKDAY_LABELS[weekday];
          return (
            <li
              key={weekday}
              className={cn(
                "flex flex-col gap-3 px-4 py-4 transition-colors sm:flex-row sm:items-start sm:gap-6 sm:px-6",
                !day.enabled && "bg-muted/30"
              )}
            >
              <label className="flex h-10 shrink-0 cursor-pointer items-center gap-3 sm:w-40">
                <Switch
                  checked={day.enabled}
                  onCheckedChange={(checked) => toggleDay(weekday, checked)}
                  aria-label={`${day.enabled ? "Fechar" : "Abrir"} ${label}`}
                />
                <span
                  className={cn(
                    "text-[0.9375rem] font-semibold",
                    day.enabled ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </label>

              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                {!day.enabled ? (
                  <p className="flex h-10 items-center text-sm text-muted-foreground">Indisponível</p>
                ) : (
                  day.periods.map((period, index) => (
                    <PeriodRow
                      key={period.key}
                      label={label}
                      period={period}
                      error={errors[period.key]}
                      first={index === 0}
                      removable={day.periods.length > 1}
                      onChange={(patch) => setPeriod(weekday, period.key, patch)}
                      onAdd={() => addPeriod(weekday)}
                      onRemove={() => removePeriod(weekday, period.key)}
                      copyControl={
                        <CopyDayPopover
                          from={weekday}
                          onApply={(targets) => copyDay(weekday, targets)}
                        />
                      }
                    />
                  ))
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* A barra só existe quando há o que salvar. Fixa no pé da tela: numa
          semana de sete linhas, o botão não pode depender de rolar até o fim. */}
      {dirty && (
        <div className="sticky bottom-4 z-20 animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none">
          <div className="panel flex flex-col gap-3 px-4 py-3 shadow-[var(--shadow-lift)] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-foreground">
              {hasErrors ? (
                <span className="text-destructive">Há horários para corrigir antes de salvar.</span>
              ) : (
                "Você tem alterações não salvas."
              )}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setWeek(initial)} disabled={saving}>
                Descartar
              </Button>
              <Button type="button" onClick={save} disabled={saving || hasErrors}>
                {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {saving ? "Salvando..." : "Salvar horários"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function PeriodRow({
  label,
  period,
  error,
  first,
  removable,
  onChange,
  onAdd,
  onRemove,
  copyControl,
}: {
  label: string;
  period: DraftPeriod;
  error?: string;
  first: boolean;
  removable: boolean;
  onChange: (patch: Partial<DraftPeriod>) => void;
  onAdd: () => void;
  onRemove: () => void;
  copyControl: React.ReactNode;
}) {
  const errorId = `${period.key}-erro`;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <TimeField
          value={period.start}
          onChange={(start) => onChange({ start })}
          label={`Início do período de ${label}`}
          invalid={Boolean(error)}
          describedBy={error ? errorId : undefined}
        />
        <span className="px-0.5 text-sm text-muted-foreground">às</span>
        <TimeField
          value={period.end}
          onChange={(end) => onChange({ end })}
          label={`Fim do período de ${label}`}
          invalid={Boolean(error)}
          describedBy={error ? errorId : undefined}
        />

        <div className="ml-1 flex items-center gap-0.5">
          {/* Adicionar e copiar ficam na PRIMEIRA linha do dia, onde o olho
              procura; as linhas extras levam só o remover. */}
          {first ? (
            <>
              <IconAction label={`Adicionar período em ${label}`} onClick={onAdd}>
                <Plus className="size-4" />
              </IconAction>
              {copyControl}
              {removable && (
                <IconAction label={`Remover este período de ${label}`} onClick={onRemove} destructive>
                  <Trash2 className="size-4" />
                </IconAction>
              )}
            </>
          ) : (
            <IconAction label={`Remover este período de ${label}`} onClick={onRemove} destructive>
              <Trash2 className="size-4" />
            </IconAction>
          )}
        </div>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function TimeField({
  value,
  onChange,
  label,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  invalid: boolean;
  describedBy?: string;
}) {
  return (
    <Input
      type="time"
      step={300}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className="h-10 w-[7.25rem] justify-center bg-card text-center text-[0.9375rem] font-medium tabular-nums"
    />
  );
}

function IconAction({
  label,
  onClick,
  destructive = false,
  children,
}: {
  label: string;
  onClick?: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        destructive ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/**
 * "Copiar para…": escolhe os dias de destino numa lista, com atalho para os
 * dias úteis — o caso de quem monta a segunda e quer a mesma coisa até sexta.
 */
function CopyDayPopover({ from, onApply }: { from: number; onApply: (targets: number[]) => void }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const others = DAY_ORDER.filter((d) => d !== from);

  function toggle(weekday: number, checked: boolean) {
    setSelected((current) => (checked ? [...current, weekday] : current.filter((d) => d !== weekday)));
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSelected([]);
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Copiar horários de ${WEEKDAY_LABELS[from]} para outros dias`}
            title="Copiar para outros dias"
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:bg-muted data-[popup-open]:text-foreground"
          />
        }
      >
        <Copy className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 gap-3 p-4">
        <p className="text-sm font-semibold text-foreground">
          Copiar horários de {WEEKDAY_LABELS[from].toLowerCase()} para:
        </p>
        <ul className="flex flex-col gap-1">
          {others.map((weekday) => {
            const id = `copiar-${from}-${weekday}`;
            return (
              <li key={weekday}>
                <label
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    id={id}
                    checked={selected.includes(weekday)}
                    onCheckedChange={(checked) => toggle(weekday, checked === true)}
                  />
                  {WEEKDAY_LABELS[weekday]}
                </label>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline dark:text-violet-300"
            onClick={() => setSelected(WEEKDAYS.filter((d) => d !== from))}
          >
            Dias úteis
          </button>
          <Button
            type="button"
            size="sm"
            disabled={selected.length === 0}
            onClick={() => {
              onApply(selected);
              setOpen(false);
              setSelected([]);
            }}
          >
            Copiar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
