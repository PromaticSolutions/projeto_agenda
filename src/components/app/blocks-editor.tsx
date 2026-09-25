"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { CalendarOff, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  addBlockAction,
  removeBlockAction,
  type HoursActionState,
} from "@/app/app/(dashboard)/hours/actions";
import { formatDateLocal, formatTimeLocal } from "@/lib/format";
import { utcToLocalDate } from "@/lib/availability";
import type { Block } from "@/lib/types";

/**
 * Folgas e bloqueios — no mesmo desenho da semana de trabalho: um painel, uma
 * linha por item, horário como "09:00 às 12:00".
 *
 * A primeira linha do painel é o formulário de novo bloqueio, com "Dia
 * inteiro" ligado por padrão: folga e feriado são o caso mais comum, e
 * obrigar a digitar 00:00 e 23:59 para fechar um dia era o que tornava esta
 * tela confusa. Desligado, aparecem os dois campos de hora.
 *
 * Só aparecem os bloqueios que ainda não terminaram — um bloqueio passado
 * não muda mais nada no link de agendamento e só atrapalhava a leitura.
 */

const FULL_DAY = { start: "00:00", end: "23:59" } as const;

export function BlocksEditor({ blocks }: { blocks: Block[] }) {
  // Lido uma vez na montagem: o corte "ainda não terminou" não precisa
  // andar com o relógio enquanto a tela está aberta.
  const [now] = useState(() => Date.now());
  const upcoming = [...blocks]
    .filter((b) => new Date(b.end_at).getTime() >= now)
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  return (
    <section className="flex flex-col gap-3" aria-labelledby="bloqueios-titulo">
      <div className="flex flex-col gap-0.5">
        <h2 id="bloqueios-titulo" className="text-base font-semibold text-foreground">
          Folgas e bloqueios
        </h2>
        <p className="text-sm text-muted-foreground">
          Feche um dia ou um intervalo específico. Ninguém consegue marcar nele pelo seu link.
        </p>
      </div>

      <div className="panel shadow-float divide-y divide-border overflow-hidden">
        <NewBlockRow />

        {upcoming.length === 0 ? (
          <p className="flex items-center gap-2.5 px-4 py-5 text-sm text-muted-foreground sm:px-6">
            <CalendarOff className="size-4 shrink-0" aria-hidden />
            Nenhum bloqueio marcado. Use para folgas, feriados e compromissos.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((block) => (
              <BlockRow key={block.id} block={block} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function NewBlockRow() {
  const [state, formAction, pending] = useActionState<HoursActionState, FormData>(addBlockAction, null);
  const [fullDay, setFullDay] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);
  const today = utcToLocalDate(new Date());

  // Bloqueio criado: avisa e limpa o formulário para o próximo.
  useEffect(() => {
    if (state?.ok) {
      toast.success("Bloqueio adicionado.");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 bg-muted/30 px-4 py-4 sm:px-6"
    >
      <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="block-date" className="text-xs text-muted-foreground">
            Data
          </Label>
          <Input
            id="block-date"
            type="date"
            name="date"
            min={today}
            defaultValue={today}
            required
            className="h-10 w-[10.5rem] bg-card text-[0.9375rem] tabular-nums"
          />
        </div>

        <label className="flex h-10 cursor-pointer items-center gap-2.5 rounded-lg px-1">
          <Switch checked={fullDay} onCheckedChange={setFullDay} aria-label="Dia inteiro" />
          <span className="text-sm font-medium text-foreground">Dia inteiro</span>
        </label>

        {fullDay ? (
          <>
            <input type="hidden" name="start_time" value={FULL_DAY.start} />
            <input type="hidden" name="end_time" value={FULL_DAY.end} />
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type="time"
              name="start_time"
              step={300}
              defaultValue="12:00"
              required
              aria-label="Início do bloqueio"
              className="h-10 w-[7.25rem] bg-card text-center text-[0.9375rem] font-medium tabular-nums"
            />
            <span className="text-sm text-muted-foreground">às</span>
            <Input
              type="time"
              name="end_time"
              step={300}
              defaultValue="13:00"
              required
              aria-label="Fim do bloqueio"
              className="h-10 w-[7.25rem] bg-card text-center text-[0.9375rem] font-medium tabular-nums"
            />
          </div>
        )}

        <div className="flex min-w-40 flex-1 flex-col gap-1.5">
          <Label htmlFor="block-reason" className="text-xs text-muted-foreground">
            Motivo <span className="font-normal">(opcional)</span>
          </Label>
          <Input
            id="block-reason"
            name="reason"
            maxLength={120}
            placeholder="Folga, feriado, almoço..."
            className="h-10 bg-card"
          />
        </div>

        <Button type="submit" disabled={pending} className="h-10">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          {pending ? "Salvando..." : "Bloquear"}
        </Button>
      </div>

      {state && !state.ok && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

function BlockRow({ block }: { block: Block }) {
  const [pending, startTransition] = useTransition();
  const start = new Date(block.start_at);
  const end = new Date(block.end_at);
  const startTime = formatTimeLocal(start);
  const endTime = formatTimeLocal(end);
  const isFullDay = startTime === FULL_DAY.start && endTime === FULL_DAY.end;

  return (
    <li className="flex items-center gap-4 px-4 py-3.5 sm:px-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/8 text-destructive">
        <CalendarOff className="size-[1.125rem]" aria-hidden />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-6">
        <p className="text-[0.9375rem] font-semibold text-foreground capitalize sm:w-44 sm:shrink-0">
          {formatDateLocal(start)}
        </p>
        <p className="text-sm text-foreground tabular-nums sm:w-36 sm:shrink-0">
          {isFullDay ? "Dia inteiro" : `${startTime} às ${endTime}`}
        </p>
        {block.reason && <p className="truncate text-sm text-muted-foreground">{block.reason}</p>}
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await removeBlockAction(block.id);
            toast.success("Bloqueio removido. O horário voltou a aparecer no link.");
          })
        }
        aria-label={`Remover bloqueio de ${formatDateLocal(start)}`}
        title="Remover bloqueio"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
      </button>
    </li>
  );
}
