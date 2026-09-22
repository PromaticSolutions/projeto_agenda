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
