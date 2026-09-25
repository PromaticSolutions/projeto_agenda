"use client";

import { useEffect, useState } from "react";
import {
  loadConversationToolsAction,
  type ConversationTools,
} from "@/app/app/(dashboard)/conversations/actions";

/**
 * Serviços e fotos para o painel, buscados UMA vez e reaproveitados ao trocar
 * de conversa. Os serviços quase não mudam durante um atendimento, e as URLs
 * das fotos valem por uma hora (ver `signAttachmentUrls`) — dez minutos de
 * reaproveitamento ficam bem dentro disso.
 */

export type ToolsData =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; tools: ConversationTools };

const TTL_MS = 10 * 60_000;
let cached: { at: number; promise: Promise<ConversationTools | null> } | null = null;

function load(): Promise<ConversationTools | null> {
  if (!cached || Date.now() - cached.at > TTL_MS) {
    const promise = loadConversationToolsAction().catch(() => null);
    cached = { at: Date.now(), promise };
    // Falha não fica guardada: a próxima abertura tenta de novo.
    void promise.then((result) => {
      if (!result && cached?.promise === promise) cached = null;
    });
  }
  return cached.promise;
}

export function useConversationToolsData(): ToolsData {
  const [data, setData] = useState<ToolsData>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    void load().then((tools) => {
      if (alive) setData(tools ? { status: "ready", tools } : { status: "error" });
    });
    return () => {
      alive = false;
    };
  }, []);

  return data;
}
