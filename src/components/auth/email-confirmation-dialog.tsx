"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Inbox, Loader2, LogIn, RefreshCw } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GlassKnotMark } from "@/components/auth/glass-knot";

/**
 * Confirmação de e-mail depois do cadastro.
 *
 * Aparece quando o Supabase cria a conta mas não devolve sessão — sinal de que
 * o projeto está com "Confirm email" ligado e o link de ativação saiu por
 * e-mail. Substituiu um aviso que tomava o lugar do formulário: como a conta JÁ
 * existe nesse ponto, deixar o formulário na tela convidava a reenviar o
 * cadastro e receber "este e-mail já possui uma conta".
 *
 * É um modal de decisão, não um aviso: um clique fora não descarta nada, e
 * fechar por qualquer caminho leva ao login (ver `onClose` em quem o monta).
 */

/** Espera entre reenvios. O padrão do Supabase é um e-mail por minuto por
 *  endereço; pedir antes disso volta 429 e gasta a paciência de quem espera. */
const RESEND_COOLDOWN_SECONDS = 60;

export function EmailConfirmationDialog({
  open,
  email,
  onClose,
}: {
  open: boolean;
  /** Endereço que acabou de receber o link — mostrado para quem digitou errado perceber. */
  email: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      // A conta já foi criada: um clique fora não pode descartar a única tela
      // que diz o que fazer em seguida. O X e o Esc continuam funcionando.
      disablePointerDismissal
    >
      <DialogContent className="sm:max-w-md">
        {/* O conteúdo é um componente à parte porque o portal o desmonta ao
            fechar: assim a contagem do reenvio recomeça sozinha a cada
            abertura, sem um efeito de reset. Devolve um fragmento para as
            partes seguirem sendo filhas diretas do grid do popup. */}
        <ConfirmationBody email={email} />
      </DialogContent>
    </Dialog>
  );
}

type Feedback = { tone: "ok" | "error"; message: string };

function ConfirmationBody({ email }: { email: string }) {
  // O cadastro em si já disparou um e-mail, então o botão nasce em espera.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Contagem em cadeia de timeouts de 1s: para sozinha ao chegar em zero, sem
  // um intervalo girando à toa enquanto o modal fica aberto.
  useEffect(() => {
    if (cooldown === 0) return;
    const id = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function handleResend() {
    setResending(true);
    setFeedback(null);

    const { error } = await createBrowserSupabaseClient().auth.resend({
      type: "signup",
      email,
    });

    setResending(false);
    // Mesmo no erro a espera recomeça: insistir na hora só repete o 429.
    setCooldown(RESEND_COOLDOWN_SECONDS);

    setFeedback(
      error
        ? {
            tone: "error",
            message:
              error.status === 429
                ? "Muitos pedidos seguidos. Espere um minuto e tente de novo."
                : "Não conseguimos reenviar agora. Tente novamente em instantes.",
          }
        : { tone: "ok", message: "Link reenviado. Confira sua caixa de entrada." }
    );
  }

  return (
    <>
      <DialogHeader className="items-center text-center">
        <GlassKnotMark className="size-14" />
        <DialogTitle className="mt-1">Confirme seu e-mail</DialogTitle>
        {/* O endereço em linha própria, e não no meio da frase: é o dado que
            precisa ser conferido — quem digitou errado descobre aqui. */}
        <p className="text-sm font-medium break-all text-foreground">{email}</p>
        <DialogDescription>
          Abra a mensagem que enviamos e clique no link para ativar sua conta.
        </DialogDescription>
      </DialogHeader>

      <p className="flex items-start gap-2.5 rounded-lg border border-border bg-muted px-3 py-2.5 text-sm leading-6 text-muted-foreground">
        <Inbox className="mt-0.5 size-4 shrink-0 text-primary" />
        Não encontrou? Procure em spam e em promoções — a mensagem pode levar alguns
        minutos para chegar.
      </p>

      {feedback && (
        <p
          role="status"
          className={feedback.tone === "ok" ? "text-sm text-wa" : "text-sm text-destructive"}
        >
          {feedback.message}
        </p>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
        >
          {resending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar link"}
        </Button>
        <Button
          render={<Link href="/login" />}
          // O elemento renderizado é um <a>: sem isto o Base UI avisa que as
          // semânticas nativas de botão se perderam.
          nativeButton={false}
          size="lg"
          className="bg-cta text-white hover:opacity-90"
        >
          <LogIn className="size-4" /> Ir para o login
        </Button>
      </DialogFooter>
    </>
  );
}
