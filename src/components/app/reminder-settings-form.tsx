"use client";

import { useActionState, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  MessageTemplateEditor,
  type TemplateToken,
} from "@/components/app/message-template-editor";
import {
  saveReminderSettingsAction,
  type ReminderFormState,
} from "@/app/app/(dashboard)/reminders/actions";
import { REMINDER_LEAD_TIME_OPTIONS } from "@/lib/validation";
import {
  REMINDER_TEMPLATE_PRESETS,
  REMINDER_TOKENS,
  exampleReminderData,
  renderReminderMessage,
} from "@/lib/reminders";
import { formatTimeLocal } from "@/lib/format";
import type { ReminderSettings } from "@/lib/types";

const MIN_LENGTH = 10;
const MAX_LENGTH = 1000;

/**
 * Agendamento de exemplo da prévia: amanhã, 14:30 no fuso do estúdio
 * (17:30 UTC = 14:30 em São Paulo).
 *
 * Amanhã, e não uma data fixa, porque a prévia existe para a pessoa reconhecer
 * a própria mensagem — uma data de 2024 congelada no código faria ela duvidar
 * do que vai sair. É calculado uma vez, na montagem, para que a hidratação não
 * compare dois relógios diferentes.
 */
function exampleStartAt(): Date {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 17, 30)
  );
}

export function ReminderSettingsForm({ settings }: { settings: ReminderSettings }) {
  const [state, formAction, pending] = useActionState<ReminderFormState, FormData>(
    saveReminderSettingsAction,
    null
  );

  const [enabled, setEnabled] = useState(settings.enabled);
  const [template, setTemplate] = useState(settings.message_template);
  const [includeLink, setIncludeLink] = useState(settings.include_link);
  const [linkUrl, setLinkUrl] = useState(settings.link_url ?? "");
  /** Sobe a cada troca vinda de fora do campo (aplicar um modelo pronto). */
  const [revision, setRevision] = useState(0);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.ok) toast.success("Mensagem automática salva");
  }

  const [exampleStart] = useState(exampleStartAt);
  const example = useMemo(() => exampleReminderData(exampleStart), [exampleStart]);

  /** Os mesmos marcadores do envio, com o rótulo e o valor que cada um assume. */
  const tokens: TemplateToken[] = useMemo(
    () =>
      REMINDER_TOKENS.map((token) => ({
        marker: token.marker,
        label: token.label,
        example: token.read(example),
      })),
    [example]
  );

  /* A prévia chama a MESMA função do disparador. Não é uma imitação do envio:
     é o envio, com dados de exemplo. */
  const preview = renderReminderMessage(
    { message_template: template, include_link: includeLink, link_url: linkUrl.trim() || null },
    example
  );

  const tooShort = template.trim().length < MIN_LENGTH;
  const tooLong = template.length > MAX_LENGTH;

  function applyPreset(preset: string) {
    setTemplate(preset);
    setRevision((current) => current + 1);
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <section className="panel divide-y divide-border">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="space-y-0.5">
            <Label htmlFor="enabled" className="cursor-pointer font-medium">
              Avisar a cliente sozinho
            </Label>
            <p className="text-sm text-muted-foreground">
              Todo agendamento passa a receber uma mensagem antes do horário, sem você precisar
              lembrar.
            </p>
          </div>
          <Switch id="enabled" name="enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="flex flex-col gap-2 p-4">
          <Label htmlFor="lead_time_minutes">Quando avisar</Label>
          <select
            id="lead_time_minutes"
            name="lead_time_minutes"
            defaultValue={settings.lead_time_minutes}
            className="h-9 w-full max-w-xs rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {REMINDER_LEAD_TIME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="panel flex flex-col gap-4 p-4">
        <div className="space-y-0.5">
          <p className="font-medium text-foreground">O que a mensagem vai dizer</p>
          <p className="text-sm text-muted-foreground">
            Escolha um texto pronto e mude o que quiser. Escreve igual a uma mensagem no
            WhatsApp.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {REMINDER_TEMPLATE_PRESETS.map((preset) => {
            const active = preset.template === template;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.template)}
                aria-pressed={active}
                className={`flex flex-col gap-0.5 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  active
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  {active && <Check className="size-3.5 text-primary" aria-hidden />}
                  {preset.label}
                </span>
                <span className="text-xs text-muted-foreground">{preset.description}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          {/* Sem `htmlFor`: o campo é um div com role="textbox", e `<label for>`
              só associa a elementos de formulário de verdade. Quem lê o rótulo
              é o `aria-labelledby` do próprio campo. */}
          <Label id="message_template_label">Mensagem</Label>
          <MessageTemplateEditor
            id="message_template"
            name="message_template"
            value={template}
            onChange={setTemplate}
            revision={revision}
            tokens={tokens}
            labelledBy="message_template_label"
            describedBy="message_template_help"
          />
          <p id="message_template_help" className="text-xs text-muted-foreground">
            As etiquetas coloridas são preenchidas na hora do envio, uma para cada cliente. Para
            tirar uma, clique no × ou apague como se fosse uma letra.
          </p>
          {(tooShort || tooLong) && (
            <p className="text-xs text-destructive">
              {tooShort
                ? "Escreva pelo menos uma frase para a cliente."
                : `A mensagem passou de ${MAX_LENGTH} caracteres (está com ${template.length}).`}
            </p>
          )}
        </div>
      </section>

      <section className="panel divide-y divide-border">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="space-y-0.5">
            <Label htmlFor="include_link" className="cursor-pointer font-medium">
              Mandar um link junto
            </Label>
            <p className="text-sm text-muted-foreground">
              Instagram, site, localização — o endereço que você quiser. Ele entra na última
              linha.
            </p>
          </div>
          <Switch
            id="include_link"
            name="include_link"
            checked={includeLink}
            onCheckedChange={setIncludeLink}
          />
        </div>

        {includeLink && (
          <div className="flex flex-col gap-2 p-4">
            <Label htmlFor="link_url">Endereço do link</Label>
            <Input
              id="link_url"
              name="link_url"
              type="url"
              inputMode="url"
              placeholder="https://instagram.com/seuestudio"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
          </div>
        )}
      </section>

      <section className="panel flex flex-col gap-3 p-4">
        <div className="space-y-0.5">
          <p className="section-label">Como a cliente recebe</p>
          <p className="text-sm text-muted-foreground">
            Exemplo com uma cliente chamada Marina, atendimento amanhã às{" "}
            {formatTimeLocal(exampleStart)}.
          </p>
        </div>

        <div className="flex justify-end rounded-xl bg-muted/40 p-3">
          <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-500/15 px-3.5 py-2.5 text-sm leading-6 text-foreground shadow-sm">
            <p className="whitespace-pre-wrap break-words">
              {preview.trim() || "Sua mensagem aparece aqui."}
            </p>
          </div>
        </div>
      </section>

      {state && !state.ok && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={pending || tooShort || tooLong}
          className="bg-cta text-primary-foreground hover:opacity-90"
        >
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
