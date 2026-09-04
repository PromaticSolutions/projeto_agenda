"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Send, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import {
  sendManualMessageAction,
  type ManualSendState,
} from "@/app/app/(dashboard)/whatsapp/actions";
import { formatPhoneDisplay } from "@/lib/format";
import type { WhatsAppConnectionStatus } from "@/lib/types";

/**
 * Envio manual de uma mensagem (seções 20–22 do plano).
 *
 * O componente não conhece a Evolution: chama uma Server Action e desenha o
 * que ela devolve. Toda a validação que importa (propriedade do estúdio, teto
 * de envio, sessão conectada, número existente no WhatsApp) roda no servidor —
 * o `required` e o contador daqui são conveniência de digitação, não barreira.
 *
 * Quando a conexão não está ativa, o formulário aparece DESABILITADO em vez de
 * escondido: sumir com ele deixaria o dono procurando um recurso que a tela
 * anuncia, e o aviso explica em uma linha o que fazer antes.
 */

const MAX_LENGTH = 4096;

export function WhatsAppSendForm({
  status,
  connectedPhone,
}: {
  status: WhatsAppConnectionStatus;
  connectedPhone: string | null;
}) {
  const [state, formAction, pending] = useActionState<ManualSendState, FormData>(
    sendManualMessageAction,
    null
  );

  const connected = status === "conectado";

  // O aviso é efeito puro: nada de estado do React muda por causa dele.
  // `useActionState` devolve um objeto novo a cada submissão, então duas
  // falhas idênticas em sequência ainda avisam duas vezes.
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(`Mensagem enviada para ${formatPhoneDisplay(state.to)}.`);
    else toast.error(state.error);
  }, [state]);

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="font-medium text-foreground">Enviar mensagem</h2>
        {connected && connectedPhone && (
          <span className="text-xs text-muted-foreground">
            Sai de {formatPhoneDisplay(connectedPhone)}
          </span>
        )}
      </header>

      {!connected && (
        <div className="flex items-start gap-3 border-b border-border bg-amber-500/5 px-4 py-3">
          <Unplug className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="text-sm text-muted-foreground">
            WhatsApp desconectado. Conecte o WhatsApp acima antes de enviar mensagens.
          </p>
        </div>
      )}

      {/* A `key` troca a cada envio aceito, remontando os campos já vazios.
          É o que limpa o formulário no sucesso e MANTÉM o texto depois de uma
          falha — apagar o que o dono escreveu o obrigaria a redigitar tudo
          para tentar de novo. */}
      <ComposeFields
        key={state?.ok ? state.token : "inicial"}
        action={formAction}
        disabled={!connected || pending}
        pending={pending}
      />
    </section>
  );
}

function ComposeFields({
  action,
  disabled,
  pending,
}: {
  action: (formData: FormData) => void;
  disabled: boolean;
  pending: boolean;
}) {
  const [length, setLength] = useState(0);

  return (
    <form action={action} className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Número</Label>
        <PhoneInput id="phone" name="phone" required disabled={disabled} />
        <p className="text-xs text-muted-foreground">
          DDD + número. O 55 do Brasil é acrescentado automaticamente.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="message">Mensagem</Label>
          <span className="text-xs text-muted-foreground">
            {length}/{MAX_LENGTH}
          </span>
        </div>
        <Textarea
          id="message"
          name="message"
          required
          rows={4}
          maxLength={MAX_LENGTH}
          disabled={disabled}
          placeholder="Digite sua mensagem..."
          onChange={(e) => setLength(e.target.value.length)}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={disabled} className="bg-cta text-white hover:opacity-90">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Enviar mensagem
        </Button>
      </div>
    </form>
  );
}
