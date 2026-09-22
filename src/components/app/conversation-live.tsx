"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markConversationReadAction } from "@/app/app/(dashboard)/conversations/actions";

/**
 * O que faz a tela de Conversas parecer viva sem Realtime.
 *
 * A mensagem nova chega pelo webhook e vai para o banco; a tela descobre
 * relendo a página. Realtime do Supabase evitaria o intervalo, mas exigiria
 * publicar a tabela e manter um canal aberto por aba com as políticas de RLS
 * certas. Para uma caixa de mensagens de salão, 10 segundos é tempo de sobra
 * (ver DECISIONS.md).
 */

const REFRESH_INTERVAL_MS = 10_000;

export function ConversationsAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    function refreshIfVisible() {
      // Aba em segundo plano não relê nada: ninguém está olhando, e cada
      // leitura é uma ida ao banco.
      if (document.visibilityState === "visible") router.refresh();
    }
    const id = setInterval(refreshIfVisible, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router]);

  return null;
}

/** Zera as não lidas quando a conversa está aberta e chega mensagem nova. */
export function MarkConversationRead({
  chatId,
  unreadCount,
}: {
  chatId: string;
  unreadCount: number;
}) {
  useEffect(() => {
    if (unreadCount === 0) return;
    void markConversationReadAction(chatId);
  }, [chatId, unreadCount]);

  return null;
}

/**
 * Área rolável das mensagens.
 *
 * Abre no fim, como todo chat. Quando chega mensagem nova, só desce se a
 * pessoa já estava no fim: arrancar alguém do meio do histórico que está
 * lendo, a cada atualização automática, tornaria a leitura impossível.
 */
export function ThreadViewport({
  lastMessageKey,
  children,
}: {
  lastMessageKey: string | null;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element && atBottom.current) element.scrollTop = element.scrollHeight;
  }, [lastMessageKey]);

  return (
    <div
      ref={ref}
      onScroll={(event) => {
        const element = event.currentTarget;
        atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
      }}
      role="log"
      aria-label="Mensagens"
      className="min-h-0 flex-1 overflow-y-auto bg-muted/30 px-3 py-4 sm:px-6"
    >
      {children}
    </div>
  );
}
