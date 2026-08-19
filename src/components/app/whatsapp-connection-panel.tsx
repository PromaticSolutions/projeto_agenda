"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, QrCode, RefreshCw, Smartphone, TriangleAlert, Unplug, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  connectWhatsAppAction,
  disconnectWhatsAppAction,
  refreshWhatsAppStatusAction,
} from "@/app/app/(dashboard)/whatsapp/actions";
import { formatPhoneDisplay } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WhatsAppConnection } from "@/lib/types";
import type { WhatsAppConnectionStatus } from "@/lib/supabase/types";

/**
 * Tela de conexão do WhatsApp, ligada à Evolution API.
 *
 * O componente não conhece a Evolution: ele chama três Server Actions e
 * desenha o que elas devolvem. A chave do gateway nunca chega ao navegador —
 * é por isso que o pareamento passa por action em vez de `fetch` daqui.
 *
 * Enquanto o QR está na tela, o componente pergunta o estado ao gateway de
 * poucos em poucos segundos. É consulta, não webhook: quem lê o código quer
 * ver a tela mudar em segundos, e um webhook perdido num deploy deixaria o
 * painel mentindo até alguém reconectar na mão.
 */

const STATUS_META: Record<
  WhatsAppConnectionStatus,
  { label: string; description: string; tone: string; Icon: typeof Wifi }
> = {
  conectado: {
    label: "Conectado",
    description: "As mensagens automáticas podem ser enviadas por este número.",
    tone: "text-emerald-600 border-emerald-500/30 bg-emerald-500/5",
    Icon: Wifi,
  },
  conectando: {
    label: "Conectando",
    description: "Aguardando a leitura do QR code no aparelho.",
    tone: "text-amber-600 border-amber-500/30 bg-amber-500/5",
    Icon: Loader2,
  },
  desconectado: {
    label: "Desconectado",
    description: "Nenhum número vinculado a este estúdio.",
    tone: "text-muted-foreground border-border bg-muted/30",
    Icon: Unplug,
  },
  erro: {
    label: "Erro",
    description: "A última tentativa de pareamento falhou.",
    tone: "text-destructive border-destructive/30 bg-destructive/5",
    Icon: TriangleAlert,
  },
};

/** De quanto em quanto tempo perguntar ao gateway enquanto o QR está aberto. */
const POLL_INTERVAL_MS = 4000;

export function WhatsAppConnectionPanel({
  connection,
  providerConfigured,
}: {
  connection: WhatsAppConnection;
  /** Falso quando EVOLUTION_API_URL/KEY não estão no ambiente. */
  providerConfigured: boolean;
}) {
  const [status, setStatus] = useState<WhatsAppConnectionStatus>(connection.status);
  const [phone, setPhone] = useState<string | null>(connection.connected_phone);
  const [error, setError] = useState<string | null>(connection.last_error);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Só faz sentido perguntar enquanto há um pareamento em curso.
  const polling = qrCode !== null && status === "conectando";

  useEffect(() => {
    if (!polling) return;

    const id = setInterval(async () => {
      const result = await refreshWhatsAppStatusAction();
      if (!result.ok) return;
      setStatus(result.status);
      setPhone(result.phone);
      if (result.status === "conectado") {
        setQrCode(null);
        setPairingCode(null);
        toast.success("WhatsApp conectado");
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [polling]);

  function handleConnect() {
    startTransition(async () => {
      const result = await connectWhatsAppAction();
      if (!result?.ok) {
        setError(result?.error ?? "Falha ao conectar");
        setStatus("erro");
        toast.error(result?.error ?? "Falha ao conectar");
        return;
      }
      setError(null);
      setStatus("conectando");
      setQrCode(result.qrCodeBase64);
      setPairingCode(result.pairingCode);
      if (!result.qrCodeBase64 && !result.pairingCode) {
        toast.info("O gateway não devolveu QR code. Atualize o status em alguns segundos.");
      }
    });
  }

  function handleRefresh() {
    startTransition(async () => {
      const result = await refreshWhatsAppStatusAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStatus(result.status);
      setPhone(result.phone);
      if (result.status === "conectado") setQrCode(null);
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectWhatsAppAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStatus("desconectado");
      setPhone(null);
      setQrCode(null);
      setPairingCode(null);
      toast.success("Número desconectado");
    });
  }

  const meta = STATUS_META[status];
  const StatusIcon = meta.Icon;

  return (
    <div className="flex flex-col gap-5">
      {!providerConfigured && (
        <section className="panel flex items-start gap-3 border-amber-500/30 bg-amber-500/5 p-4">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div className="space-y-0.5 text-sm">
            <p className="font-medium text-foreground">Gateway não configurado</p>
            <p className="text-muted-foreground">
              Defina <code className="font-mono text-xs">EVOLUTION_API_URL</code> e{" "}
              <code className="font-mono text-xs">EVOLUTION_API_KEY</code> no ambiente para
              habilitar a conexão. Os lembretes continuam sendo planejados na fila, mas nada é
              enviado.
            </p>
          </div>
        </section>
      )}

      <section className={cn("panel flex items-start gap-3 p-4", meta.tone)}>
        <StatusIcon className={cn("mt-0.5 size-5 shrink-0", status === "conectando" && "animate-spin")} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-medium text-foreground">{meta.label}</h2>
            {phone && status === "conectado" && (
              <Badge variant="secondary" className="font-mono">
                {formatPhoneDisplay(phone)}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
          {status === "erro" && error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </section>

      <section className="panel p-4">
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex size-44 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-white">
            {qrCode ? (
              // eslint-disable-next-line @next/next/no-img-element -- QR em base64 vindo do gateway; next/image exige URL ou import estático.
              <img
                src={`data:image/png;base64,${qrCode}`}
                alt="QR code para conectar o WhatsApp"
                className="size-full object-contain"
              />
            ) : pending ? (
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            ) : (
              <QrCode className="size-10 text-muted-foreground" aria-hidden />
            )}
          </div>

          <div className="max-w-sm space-y-1 text-center">
            <p className="font-medium text-foreground">
              {qrCode ? "Leia o código no aparelho" : "Área do QR code"}
            </p>
            <p className="text-sm text-muted-foreground">
              WhatsApp → Aparelhos conectados → Conectar aparelho.
            </p>
            {pairingCode && (
              <p className="text-sm text-muted-foreground">
                Ou use o código de pareamento:{" "}
                <span className="font-mono font-semibold text-foreground">{pairingCode}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              onClick={handleConnect}
              disabled={pending || !providerConfigured || status === "conectado"}
              className="bg-cta text-white"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />}
              {status === "conectando" ? "Gerar novo código" : "Conectar número"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleRefresh}
              disabled={pending || !providerConfigured}
            >
              <RefreshCw className="size-4" /> Atualizar status
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDisconnect}
              disabled={pending || !providerConfigured || status === "desconectado"}
            >
              <Unplug className="size-4" /> Desconectar
            </Button>
          </div>

          {polling && (
            <p className="text-xs text-muted-foreground">
              Verificando a conexão a cada {POLL_INTERVAL_MS / 1000} segundos...
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
