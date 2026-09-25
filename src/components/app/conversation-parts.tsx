import {
  Contact,
  FileText,
  Image as ImageIcon,
  MapPin,
  MessageSquareText,
  Mic,
  Sticker,
  Video,
  type LucideIcon,
} from "lucide-react";
import { initialsOf } from "@/lib/conversations";
import { cn } from "@/lib/utils";
import type { WhatsAppMessageType } from "@/lib/types";

/**
 * Peças visuais usadas tanto pela lista (Client Component) quanto pela
 * conversa (Server Component). Sem estado e sem diretiva, então servem aos
 * dois lados.
 */

export const MESSAGE_TYPE_ICONS: Record<WhatsAppMessageType, LucideIcon | null> = {
  texto: null,
  imagem: ImageIcon,
  video: Video,
  audio: Mic,
  documento: FileText,
  figurinha: Sticker,
  localizacao: MapPin,
  contato: Contact,
  outro: MessageSquareText,
};

export function ConversationAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary",
        size === "sm" ? "size-8 text-xs" : "size-10 text-sm"
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * O balão do WhatsApp, desenhado aqui: o lucide não tem marcas, e o canal
 * precisa ser reconhecível na etiqueta da lista e no cabeçalho da conversa.
 */
export function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.7-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}
