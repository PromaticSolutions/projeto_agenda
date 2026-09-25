"use client";

import { useState } from "react";
import { UsersRound } from "lucide-react";
import { initialsOf } from "@/lib/conversations";
import { cn } from "@/lib/utils";

/**
 * Foto do contato, com as iniciais por baixo.
 *
 * A foto vem do WhatsApp pelo nosso servidor (/api/conversations/avatar) e
 * pode não existir: contato sem foto, foto só para contatos, número
 * desconectado. As iniciais aparecem desde o primeiro quadro e a foto cobre
 * quando carrega — nunca há um círculo vazio esperando a rede.
 *
 * Quem já falhou nesta aba não é pedido de novo a cada releitura da página.
 */

const failed = new Set<string>();

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-lg",
} as const;

export function ContactAvatar({
  name,
  chatId,
  isGroup = false,
  size = "md",
  className,
}: {
  name: string;
  /** Nulo = não buscar foto (grupo, conversa sem número). */
  chatId: string | null;
  isGroup?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const canFetch = Boolean(chatId) && !isGroup && !failed.has(chatId!);
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);

  return (
    <span
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary dark:text-violet-300",
        SIZES[size],
        className
      )}
    >
      {isGroup ? <UsersRound className="size-[45%]" /> : initialsOf(name)}
      {canFetch && !broken && (
        // eslint-disable-next-line @next/next/no-img-element -- foto por rota própria, com cache privado; o otimizador de imagem não se aplica.
        <img
          // Carregou (ou falhou) antes da hidratação: o `onLoad` já passou.
          ref={(element) => {
            if (!element?.complete || loaded) return;
            if (element.naturalWidth > 0) setLoaded(true);
            else {
              failed.add(chatId!);
              setBroken(true);
            }
          }}
          src={`/api/conversations/avatar/${encodeURIComponent(chatId!)}`}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => {
            failed.add(chatId!);
            setBroken(true);
          }}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </span>
  );
}
