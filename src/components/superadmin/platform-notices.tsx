"use client";

import { useState, useTransition } from "react";
import { Loader2, RotateCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  retryPlatformNoticeAction,
  sendPlatformTestAction,
  type NoticeActionState,
} from "@/app/superadmin/whatsapp/actions";

/**
 * Botões da tela de avisos da plataforma. A tabela é desenhada no servidor;
 * só o que dispara envio precisa de estado no navegador.
 */

function Result({ state }: { state: NoticeActionState }) {
  if (!state) return null;
  return state.ok ? (
    <span className="text-sm text-emerald-700">{state.message}</span>
  ) : (
    <span className="text-sm text-destructive">{state.error}</span>
  );
}

export function TestMessageButton({ disabled }: { disabled?: boolean }) {
  const [state, setState] = useState<NoticeActionState>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        disabled={disabled || pending}
        onClick={() =>
          startTransition(async () => {
            setState(await sendPlatformTestAction());
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Enviar mensagem de teste
      </Button>
      <Result state={state} />
    </div>
  );
}

export function RetryNoticeButton({ messageId }: { messageId: string }) {
  const [state, setState] = useState<NoticeActionState>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setState(await retryPlatformNoticeAction(messageId));
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
        Enviar agora
      </Button>
      {state && !state.ok && <span className="max-w-48 text-right text-xs text-destructive">{state.error}</span>}
    </div>
  );
}
