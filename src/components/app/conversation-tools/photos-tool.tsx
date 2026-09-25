"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ImagePlus, Send } from "lucide-react";
import { toast } from "sonner";
import { useConversationTools } from "@/components/app/conversation-workspace";
import {
  FIELD_CLASS,
  FieldLabel,
  ToolButton,
  WithTools,
} from "@/components/app/conversation-tools/shared";
import type { ToolsData } from "@/components/app/conversation-tools/use-tools-data";
import {
  sendConversationImageAction,
  type ConversationTools,
} from "@/app/app/(dashboard)/conversations/actions";
import { useChatDraft } from "@/lib/chat-drafts";
import { cn } from "@/lib/utils";

/**
 * Mandar fotos de procedimento — as que já estão cadastradas nos serviços.
 *
 * Agrupadas por serviço, porque é assim que a pergunta chega ("tem foto do
 * volume brasileiro?"). Dá para marcar várias; elas saem uma de cada vez, na
 * ordem em que foram marcadas, com a legenda só na primeira (como o próprio
 * WhatsApp faz ao mandar um álbum).
 */

const MAX_PER_SEND = 10;

export function PhotosTool({ data }: { data: ToolsData }) {
  return <WithTools data={data}>{(tools) => <PhotoPicker tools={tools} />}</WithTools>;
}

function PhotoPicker({ tools }: { tools: ConversationTools }) {
  const { contact, sendBlockedReason } = useConversationTools()!;
  const [picked, setPicked] = useChatDraft<string[]>(contact.chatId, "fotos", []);
  const [caption, setCaption] = useChatDraft<string>(contact.chatId, "fotos-legenda", "");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const withPhotos = tools.services.filter((service) => service.photos.length > 0);
  const known = new Set(withPhotos.flatMap((service) => service.photos.map((photo) => photo.id)));
  // Foto que saiu do serviço enquanto o rascunho existia não conta mais.
  const selected = picked.filter((id) => known.has(id));

  if (withPhotos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg bg-muted/50 px-4 py-5 text-center">
        <ImagePlus className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Nenhum serviço tem foto ainda. Adicione fotos em{" "}
          <Link
            href="/app/services"
            className="font-medium text-primary underline-offset-4 hover:underline dark:text-violet-300"
          >
            Serviços
          </Link>{" "}
          para mandar por aqui.
        </p>
      </div>
    );
  }

  function toggle(id: string) {
    setPicked((current) => {
      const valid = current.filter((item) => known.has(item));
      if (valid.includes(id)) return valid.filter((item) => item !== id);
      if (valid.length >= MAX_PER_SEND) {
        toast.info(`Dá para mandar até ${MAX_PER_SEND} fotos de uma vez.`);
        return valid;
      }
      return [...valid, id];
    });
  }

  async function send() {
    const queue = [...selected];
    setProgress({ done: 0, total: queue.length });
    for (const [index, id] of queue.entries()) {
      const result = await sendConversationImageAction(contact.chatId, id, index === 0 ? caption : "");
      if (!result.ok) {
        toast.error(result.error);
        // O que já saiu sai do rascunho; o resto fica marcado para tentar de novo.
        setPicked(queue.slice(index));
        setProgress(null);
        return;
      }
      setProgress({ done: index + 1, total: queue.length });
    }
    toast.success(queue.length > 1 ? `${queue.length} fotos enviadas.` : "Foto enviada.");
    setPicked([]);
    setCaption("");
    setProgress(null);
  }

  return (
    <div className="flex flex-col gap-3.5">
      {withPhotos.map((service) => (
        <div key={service.id} className="flex flex-col gap-1.5">
          <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: service.color }} aria-hidden />
            <span className="truncate">{service.name}</span>
            <span className="font-normal text-muted-foreground">{service.photos.length}</span>
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {service.photos.map((photo) => {
              const order = selected.indexOf(photo.id);
              const active = order >= 0;
              return (
                <button
                  key={photo.id}
                  type="button"
                  aria-pressed={active}
                  aria-label={`${active ? "Desmarcar" : "Marcar"} foto ${photo.fileName}`}
                  onClick={() => toggle(photo.id)}
                  className={cn(
                    "group/foto relative aspect-square overflow-hidden rounded-lg bg-muted outline-none transition focus-visible:ring-3 focus-visible:ring-ring/60",
                    active ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:brightness-95"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do bucket privado. */}
                  <img src={photo.url} alt="" loading="lazy" className="size-full object-cover" />
                  <span
                    className={cn(
                      "absolute top-1 right-1 flex size-5 items-center justify-center rounded-full text-[0.625rem] font-bold transition",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "border border-white/80 bg-black/20 text-transparent group-hover/foto:bg-black/35"
                    )}
                  >
                    {active ? order + 1 : <Check className="size-3" aria-hidden />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="fotos-legenda">
          Legenda <span className="font-normal">(opcional)</span>
        </FieldLabel>
        <textarea
          id="fotos-legenda"
          rows={2}
          maxLength={1024}
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Ex.: Olha como fica o volume brasileiro!"
          className={cn(FIELD_CLASS, "h-auto resize-none py-2 leading-5")}
        />
      </div>

      <ToolButton
        onClick={send}
        disabled={selected.length === 0 || Boolean(sendBlockedReason)}
        title={sendBlockedReason ?? undefined}
        pending={progress !== null}
        pendingLabel={progress ? `Enviando ${Math.min(progress.done + 1, progress.total)} de ${progress.total}...` : undefined}
      >
        <Send className="size-4" aria-hidden />
        {selected.length === 0
          ? "Marque as fotos"
          : selected.length === 1
            ? "Enviar 1 foto"
            : `Enviar ${selected.length} fotos`}
      </ToolButton>
    </div>
  );
}
