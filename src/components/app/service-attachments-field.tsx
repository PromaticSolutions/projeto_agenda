"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadServiceAttachmentAction } from "@/app/app/(dashboard)/services/actions";
import { formatFileSize } from "@/lib/service-attachments";
import {
  ATTACHMENT_UPLOAD_ACCEPT,
  MAX_ATTACHMENTS_PER_SERVICE,
  isImageMime,
  type ServiceAttachmentItem,
} from "@/lib/validation";
import { cn } from "@/lib/utils";
import type { ServiceAttachmentView } from "@/lib/types";

/** Um anexo na tela: já gravado (tem `id`) ou recém-enviado (só `storage_path`). */
interface Item {
  key: string;
  id?: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  url: string | null;
}

function toFormItem(item: Item): ServiceAttachmentItem {
  if (item.id) return { id: item.id };
  return {
    storage_path: item.storage_path,
    file_name: item.file_name,
    mime_type: item.mime_type as Extract<ServiceAttachmentItem, { mime_type: string }>["mime_type"],
    size_bytes: item.size_bytes,
  };
}

/**
 * Fotos e PDFs do serviço. Cada arquivo sobe na hora em que é escolhido, mas
 * o que o formulário grava é a LISTA (campo escondido `attachments`), no
 * Salvar — mesmo desenho do logo na Conta: fechar sem salvar não muda nada.
 */
export function ServiceAttachmentsField({
  defaultValue = [],
  onBusyChange,
}: {
  defaultValue?: ServiceAttachmentView[];
  /** Avisa o formulário para segurar o Salvar enquanto há envio em curso. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const [items, setItems] = useState<Item[]>(() =>
    defaultValue.map((a) => ({ key: a.id, ...a }))
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const remaining = MAX_ATTACHMENTS_PER_SERVICE - items.length;

  function handleFiles(fileList: FileList | null | undefined) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    setErrors([]);

    const accepted = files.slice(0, Math.max(remaining, 0));
    const skipped = files.length - accepted.length;

    onBusyChange?.(true);
    startTransition(async () => {
      const newErrors: string[] = [];
      if (skipped > 0) {
        newErrors.push(`Limite de ${MAX_ATTACHMENTS_PER_SERVICE} arquivos: ${skipped} ficaram de fora.`);
      }
      // Um por vez: cada requisição fica abaixo do bodySizeLimit.
      for (const file of accepted) {
        const formData = new FormData();
        formData.append("file", file);
        const result = await uploadServiceAttachmentAction(formData);
        if (result.ok) {
          const { attachment, url } = result;
          setItems((prev) => [...prev, { key: attachment.storage_path, ...attachment, url }]);
        } else {
          newErrors.push(result.error);
        }
      }
      setErrors(newErrors);
      onBusyChange?.(false);
      // Limpa o input para que reenviar o MESMO arquivo dispare onChange de novo.
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function remove(key: string) {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }

  const photos = items.filter((item) => isImageMime(item.mime_type));
  const documents = items.filter((item) => !isImageMime(item.mime_type));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Fotos e anexos</Label>
        <span className="text-xs text-muted-foreground">Opcional</span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!pending) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-dashed border-input p-3 transition-colors",
          dragging && "border-plum-900/40 bg-muted/40"
        )}
      >
        {photos.length > 0 && (
          <ul className="grid grid-cols-4 gap-2">
            {photos.map((item) => (
              <li key={item.key} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" title={item.file_name}>
                    {/* URL assinada do Storage, com validade: next/image
                        cachearia uma URL que expira. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt={item.file_name} className="size-full object-cover" />
                  </a>
                ) : (
                  <span className="flex size-full items-center justify-center p-1 text-center text-[10px] text-muted-foreground">
                    {item.file_name}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(item.key)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-90 hover:opacity-100"
                  aria-label={`Remover ${item.file_name}`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {documents.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {documents.map((item) => (
              <li
                key={item.key}
                className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-sm"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate text-foreground hover:underline"
                  >
                    {item.file_name}
                  </a>
                ) : (
                  <span className="min-w-0 flex-1 truncate">{item.file_name}</span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatFileSize(item.size_bytes)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(item.key)}
                  aria-label={`Remover ${item.file_name}`}
                >
                  <X className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={pending || remaining <= 0}
          onClick={() => fileRef.current?.click()}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {pending ? "Enviando..." : "Adicionar fotos ou PDF"}
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ATTACHMENT_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input type="hidden" name="attachments" value={JSON.stringify(items.map(toFormItem))} />

      {errors.map((error) => (
        <p key={error} className="text-sm text-destructive">
          {error}
        </p>
      ))}
      <p className="text-xs text-muted-foreground">
        Fotos (JPG, PNG, WebP) ou PDF, até 10 MB cada. Uso interno — não aparece na página pública.
      </p>
    </div>
  );
}
