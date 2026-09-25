"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileText,
  ImageOff,
  Loader2,
  Pause,
  Play,
  VideoOff,
  Volume2,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { WhatsAppMessageType } from "@/lib/types";

/**
 * O conteúdo de mídia dentro do balão: foto, figurinha, áudio, vídeo e
 * documento.
 *
 * O arquivo vem do WhatsApp na hora (/api/conversations/media), então tudo
 * aqui carrega sob demanda: foto com `loading="lazy"` (só baixa quando entra
 * na tela), áudio e vídeo com `preload="none"` (só baixam quando a pessoa
 * aperta o play). Uma conversa longa não dispara cem downloads ao abrir.
 *
 * Quando o arquivo não existe mais (mídia antiga que o WhatsApp apagou,
 * número desconectado), o balão diz isso em vez de mostrar um quadrado
 * quebrado.
 */

function mediaUrl(messageId: string, download = false) {
  return `/api/conversations/media/${messageId}${download ? "?download=1" : ""}`;
}

export function MessageMedia({
  messageId,
  type,
  fromMe,
  fileLabel,
}: {
  messageId: string;
  type: WhatsAppMessageType;
  fromMe: boolean;
  /** Para documento: o nome do arquivo, que chega no corpo da mensagem. */
  fileLabel?: string | null;
}) {
  switch (type) {
    case "imagem":
      return <ImageMedia messageId={messageId} fromMe={fromMe} />;
    case "figurinha":
      return <StickerMedia messageId={messageId} />;
    case "audio":
      return <AudioMedia messageId={messageId} fromMe={fromMe} />;
    case "video":
      return <VideoMedia messageId={messageId} fromMe={fromMe} />;
    case "documento":
      return <DocumentMedia messageId={messageId} fromMe={fromMe} label={fileLabel ?? null} />;
    default:
      return null;
  }
}

function Unavailable({
  icon: Icon,
  label,
  fromMe,
}: {
  icon: typeof ImageOff;
  label: string;
  fromMe: boolean;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs",
        fromMe ? "bg-white/12 text-primary-foreground/90" : "bg-muted text-muted-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </p>
  );
}

function ImageMedia({ messageId, fromMe }: { messageId: string; fromMe: boolean }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(false);

  if (state === "error") {
    return <Unavailable icon={ImageOff} label="Foto não está mais disponível" fromMe={fromMe} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={state !== "ok"}
        aria-label="Ampliar foto"
        className={cn(
          "group/foto relative block overflow-hidden rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
          state === "loading" && "h-48 w-64 max-w-full animate-pulse bg-black/10 dark:bg-white/10"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- arquivo por rota própria com cache privado. */}
        <img
          // A foto pode terminar de carregar ANTES da hidratação, e aí o
          // `onLoad` já passou: o ref confere o estado real ao montar.
          ref={(element) => {
            if (element?.complete && state === "loading") {
              setState(element.naturalWidth > 0 ? "ok" : "error");
            }
          }}
          src={mediaUrl(messageId)}
          alt="Foto enviada na conversa"
          loading="lazy"
          decoding="async"
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          className={cn(
            "max-h-80 w-auto max-w-full object-cover transition duration-200 group-hover/foto:brightness-95",
            state === "loading" && "absolute inset-0 size-full opacity-0"
          )}
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-3 p-3 sm:max-w-3xl">
          <DialogTitle className="sr-only">Foto da conversa</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element -- idem. */}
          <img
            src={mediaUrl(messageId)}
            alt="Foto enviada na conversa"
            className="max-h-[calc(100dvh-8rem)] w-full rounded-md object-contain"
          />
          <a
            href={mediaUrl(messageId, true)}
            className="inline-flex items-center gap-1.5 justify-self-start rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-primary/8 dark:text-violet-300"
          >
            <Download className="size-4" aria-hidden />
            Baixar foto
          </a>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StickerMedia({ messageId }: { messageId: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <span className="text-xs opacity-80">Figurinha</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- idem.
    <img
      src={mediaUrl(messageId)}
      alt="Figurinha"
      loading="lazy"
      onError={() => setBroken(true)}
      className="size-32 object-contain"
    />
  );
}

/**
 * Player de áudio no formato do WhatsApp: play, barra de progresso e tempo.
 *
 * O `<audio controls>` nativo muda de desenho a cada navegador e some dentro
 * do balão roxo; este usa o mesmo elemento por baixo, sem os controles.
 */
function AudioMedia({ messageId, fromMe }: { messageId: string; fromMe: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "paused" | "error">("idle");
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  // Um áudio tocando para quando outro começa, como no WhatsApp.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    function stopOthers(event: Event) {
      if (event.target !== audio && !audio!.paused) audio!.pause();
    }
    document.addEventListener("play", stopOthers, true);
    return () => document.removeEventListener("play", stopOthers, true);
  }, []);

  if (status === "error") {
    return <Unavailable icon={Volume2} label="Áudio não está mais disponível" fromMe={fromMe} />;
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (status === "idle") setStatus("loading");
      void audio.play().catch(() => setStatus("error"));
    } else {
      audio.pause();
    }
  }

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
  const shown = status === "idle" ? null : status === "playing" || current > 0 ? current : duration;

  return (
    <div className="flex w-64 max-w-full items-center gap-3 py-0.5">
      <audio
        ref={audioRef}
        src={mediaUrl(messageId)}
        preload="none"
        onPlaying={() => setStatus("playing")}
        onPause={() => setStatus("paused")}
        onEnded={() => {
          setStatus("paused");
          setCurrent(0);
        }}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          if (Number.isFinite(value)) setDuration(value);
        }}
        onDurationChange={(event) => {
          const value = event.currentTarget.duration;
          if (Number.isFinite(value)) setDuration(value);
        }}
        onError={() => setStatus("error")}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={status === "playing" ? "Pausar áudio" : "Ouvir áudio"}
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full outline-none transition focus-visible:ring-3 focus-visible:ring-ring/60",
          fromMe
            ? "bg-white text-primary hover:bg-white/90"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {status === "loading" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : status === "playing" ? (
          <Pause className="size-4 fill-current" aria-hidden />
        ) : (
          <Play className="ml-0.5 size-4 fill-current" aria-hidden />
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={current}
          disabled={!duration}
          aria-label="Posição do áudio"
          onChange={(event) => {
            const audio = audioRef.current;
            if (!audio) return;
            audio.currentTime = Number(event.target.value);
            setCurrent(audio.currentTime);
          }}
          style={{ "--progress": `${progress}%` } as React.CSSProperties}
          className={cn(
            "audio-range h-1 w-full cursor-pointer appearance-none rounded-full disabled:cursor-default",
            fromMe ? "audio-range-light" : "audio-range-dark"
          )}
        />
        <span
          className={cn(
            "text-[0.6875rem] tabular-nums",
            fromMe ? "text-primary-foreground/90" : "text-muted-foreground"
          )}
        >
          {shown === null ? "Áudio" : formatSeconds(shown)}
        </span>
      </div>
    </div>
  );
}

function VideoMedia({ messageId, fromMe }: { messageId: string; fromMe: boolean }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return <Unavailable icon={VideoOff} label="Vídeo não está mais disponível" fromMe={fromMe} />;
  }
  return (
    <video
      src={mediaUrl(messageId)}
      controls
      preload="none"
      playsInline
      onError={() => setBroken(true)}
      className="max-h-80 w-72 max-w-full rounded-lg bg-black"
    />
  );
}

function DocumentMedia({
  messageId,
  fromMe,
  label,
}: {
  messageId: string;
  fromMe: boolean;
  label: string | null;
}) {
  return (
    <a
      href={mediaUrl(messageId, true)}
      className={cn(
        "flex w-64 max-w-full items-center gap-3 rounded-lg px-3 py-2.5 outline-none transition focus-visible:ring-3 focus-visible:ring-ring/60",
        fromMe ? "bg-white/12 hover:bg-white/20" : "bg-muted hover:bg-muted/70"
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md",
          fromMe ? "bg-white/20" : "bg-background text-primary dark:text-violet-300"
        )}
      >
        <FileText className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label ?? "Documento"}</span>
        <span className={cn("text-xs", fromMe ? "text-primary-foreground/90" : "text-muted-foreground")}>
          Toque para baixar
        </span>
      </span>
      <Download className="size-4 shrink-0 opacity-80" aria-hidden />
    </a>
  );
}

function formatSeconds(value: number): string {
  const total = Math.max(0, Math.floor(value));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
