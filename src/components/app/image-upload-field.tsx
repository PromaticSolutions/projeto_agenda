"use client";

import { useRef, useState, useTransition } from "react";
import { ImageOff, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SystemLogo } from "@/components/system-logo";
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
  /** Oferece "usar a marca do Agenda Online" como alternativa ao arquivo
   *  próprio. Ligado, o vazio deixa de ser ausência e passa a ser escolha. */
  systemDefault?: { label: string; description: string };
  /** Colar endereço de imagem. O banner ainda aceita; o logo não, porque a
   *  escolha ali virou "marca do sistema ou arquivo meu". */
  allowUrl?: boolean;
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
  systemDefault,
  allowUrl = true,
}: ImageUploadFieldProps) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [error, setError] = useState<string | null>(null);
  /* A escolha precisa de estado PRÓPRIO, e não ser derivada de `url` estar
     vazio. Derivando, um estúdio que ainda não tem logo ficava preso: desligar
     a marca do sistema deixava `url` vazio, vazio voltava a significar
     "sistema", e o switch pulava de volta sozinho — sem nunca revelar o botão
     de enviar arquivo. O vazio continua sendo o que vai para o banco; o que
     não dá é para ele ser também o que comanda a interface. */
  const [usingSystem, setUsingSystem] = useState(
    Boolean(systemDefault) && !defaultValue
  );
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
      <Label htmlFor={allowUrl ? `${name}-url` : undefined}>{label}</Label>

      {systemDefault && (
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5">
          {/* A marca ao lado do texto: quem liga a opção vê o que vai aparecer
              na página, sem precisar salvar para descobrir. */}
          {usingSystem && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-border">
              <SystemLogo className="size-6" size={48} />
            </span>
          )}
          <Switch
            id={`${name}-system`}
            checked={usingSystem}
            onCheckedChange={(checked) => {
              setError(null);
              // `url` é preservado nos dois sentidos: quem experimenta a marca
              // do sistema e volta atrás reencontra o arquivo que já subiu.
              setUsingSystem(checked);
            }}
            className="mt-0.5"
          />
          <div className="min-w-0">
            <Label htmlFor={`${name}-system`} className="font-medium">
              {systemDefault.label}
            </Label>
            <p className="text-xs text-muted-foreground">{systemDefault.description}</p>
          </div>
        </div>
      )}

      <div className={cn("flex items-start gap-3", usingSystem && "hidden")}>
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
                  // Sem imagem própria, a página cai na marca do sistema de
                  // qualquer jeito; o switch acompanha em vez de mentir.
                  if (systemDefault) setUsingSystem(true);
                }}
              >
                <Trash2 className="size-4" /> Remover
              </Button>
            )}
          </div>

          {allowUrl && (
            <Input
              id={`${name}-url`}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ou cole uma URL: https://..."
              className="text-sm"
            />
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {/* É este campo que o formulário envia — o upload só o preenche.
          Vazio quando a escolha é a marca do sistema: é assim que o banco
          registra "sem logo próprio", e é o que a página pública lê. */}
      <input type="hidden" name={name} value={usingSystem ? "" : url} />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
