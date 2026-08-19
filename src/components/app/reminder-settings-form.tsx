"use client";

import { useActionState, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  saveReminderSettingsAction,
  type ReminderFormState,
} from "@/app/app/(dashboard)/reminders/actions";
import { REMINDER_LEAD_TIME_OPTIONS, REMINDER_PLACEHOLDERS } from "@/lib/validation";
import type { ReminderSettings } from "@/lib/types";

/** Valores de exemplo só para a pré-visualização — nada é enviado. */
const PREVIEW_VALUES: Record<string, string> = {
  "{cliente}": "Marina",
  "{servico}": "Design de Sobrancelhas",
  "{data}": "12/09",
  "{hora}": "14:30",
  "{salao}": "Bella Studio",
};

function renderPreview(template: string, includeLink: boolean, linkUrl: string): string {
  let text = template;
  for (const [key, value] of Object.entries(PREVIEW_VALUES)) {
    text = text.replaceAll(key, value);
  }
  return includeLink && linkUrl.trim() ? `${text}\n\n${linkUrl.trim()}` : text;
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
  const templateRef = useRef<HTMLTextAreaElement>(null);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.ok) toast.success("Configuração de lembretes salva");
  }

  /** Insere o marcador na posição do cursor, não no fim do texto. */
  function insertPlaceholder(placeholder: string) {
    const el = templateRef.current;
    if (!el) return;
    const start = el.selectionStart ?? template.length;
    const end = el.selectionEnd ?? template.length;
    const next = template.slice(0, start) + placeholder + template.slice(end);
    setTemplate(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + placeholder.length, start + placeholder.length);
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <section className="panel divide-y divide-border">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="space-y-0.5">
            <Label htmlFor="enabled" className="cursor-pointer font-medium">
              Enviar lembretes automaticamente
            </Label>
            <p className="text-sm text-muted-foreground">
              Quando ligado, cada agendamento gera um lembrete na antecedência definida.
            </p>
          </div>
          <Switch id="enabled" name="enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="flex flex-col gap-2 p-4">
          <Label htmlFor="lead_time_minutes">Antecedência</Label>
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
          <p className="text-xs text-muted-foreground">
            Quanto tempo antes do horário marcado a mensagem sai.
          </p>
        </div>
      </section>

      <section className="panel flex flex-col gap-3 p-4">
        <div className="space-y-0.5">
          <Label htmlFor="message_template" className="font-medium">
            Mensagem
          </Label>
          <p className="text-sm text-muted-foreground">
            Clique num marcador para inseri-lo onde o cursor estiver.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {REMINDER_PLACEHOLDERS.map((placeholder) => (
            <Button
              key={placeholder}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 font-mono text-xs"
              onClick={() => insertPlaceholder(placeholder)}
            >
              {placeholder}
            </Button>
          ))}
        </div>

        <Textarea
          id="message_template"
          name="message_template"
          ref={templateRef}
          rows={4}
          maxLength={1000}
          required
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">{template.length}/1000 caracteres</p>
      </section>

      <section className="panel divide-y divide-border">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="space-y-0.5">
            <Label htmlFor="include_link" className="cursor-pointer font-medium">
              Incluir um link na mensagem
            </Label>
            <p className="text-sm text-muted-foreground">
              Instagram, site, localização — o endereço que você quiser.
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

      <section className="panel flex flex-col gap-2 p-4">
        <p className="section-label text-muted-foreground">Pré-visualização</p>
        <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm text-foreground">
          {renderPreview(template, includeLink, linkUrl)}
        </p>
      </section>

      {state && !state.ok && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending} className="bg-cta text-white hover:opacity-90">
          {pending ? "Salvando..." : "Salvar configuração"}
        </Button>
      </div>
    </form>
  );
}
