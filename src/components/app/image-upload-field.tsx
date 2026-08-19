"use client";

import { useRef, useState, useTransition } from "react";
import { ImageOff, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadStudioImageAction } from "@/app/app/(dashboard)/account/actions";
import { IMAGE_UPLOAD_ACCEPT, type ImageUploadKind } from "@/lib/validation";
import { cn } from "@/lib/utils";

interface ImageUploadFieldProps {
  kind: ImageUploadKind;
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string | null;
  /** Proporção da moldura de prévia — logo é quadrado, banner é panorâmico. */
  aspect?: "square" | "wide";
}

/**
 * Campo de imagem com dois caminhos: enviar do dispositivo ou colar uma URL.
 *
 * O valor que o formulário envia é sempre uma URL (input escondido) — o upload
 * apenas preenche esse campo. Assim a gravação em `studios` continua sendo uma
 * coisa só, no submit, e um upload seguido de "cancelar" não troca a imagem
 * pela metade.
 */
export function ImageUploadField({
  kind,
  name,
  label,
  hint,
  defaultValue,
  aspect = "square",
}: ImageUploadFieldProps) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const result = await uploadStudioImageAction(kind, formData);
      if (result.ok) setUrl(result.url);
      else setError(result.error);
      // Limpa o input para que reenviar o MESMO arquivo dispare onChange again.
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${name}-url`}>{label}</Label>

      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40",
            aspect === "square" ? "size-16" : "h-16 w-28"
          )}
        >
          {url ? (
            /* A URL é arbitrária — upload do dono ou endereço colado por ele.
               next/image exigiria uma allowlist de domínios que não há como
               prever, então aqui a tag nativa é a escolha certa. */
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="size-full object-cover" />
          ) : (
            <ImageOff className="size-5 text-muted-foreground" aria-hidden />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {pending ? "Enviando..." : "Enviar do dispositivo"}
            </Button>

            {url && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setUrl("");
                  setError(null);
                }}
              >
                <Trash2 className="size-4" /> Remover
              </Button>
            )}
          </div>

          <Input
            id={`${name}-url`}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="ou cole uma URL: https://..."
            className="text-sm"
          />
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {/* É este campo que o formulário envia — o upload só o preenche. */}
      <input type="hidden" name={name} value={url} />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
