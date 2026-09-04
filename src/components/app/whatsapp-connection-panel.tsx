"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  QrCode,
  RefreshCw,
  Smartphone,
  Trash2,
  TriangleAlert,
  Unplug,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  connectWhatsAppAction,
  deleteWhatsAppConnectionAction,
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
 * O componente não conhece a Evolution: chama Server Actions e desenha o que
 * elas devolvem. A chave do gateway nunca chega ao navegador — é por isso que
 * o pareamento passa por action em vez de `fetch` daqui.
 *
 * Enquanto o QR está na tela, o componente pergunta o estado ao gateway de
 * poucos em poucos segundos. Isso continua existindo mesmo agora que há
 * webhook: o webhook depende de a VPS alcançar a URL pública do app, o que não
 * acontece em desenvolvimento nem durante um deploy. Consulta é o piso que
 * sempre funciona; webhook é o que torna a mudança instantânea em produção.
 *
 * `router.refresh()` nos pontos de mudança de estado não é enfeite: o
 * formulário de envio e o histórico são renderizados no servidor, ao lado
 * deste painel. Sem o refresh, conectar aqui deixaria o formulário de envio
 * desabilitado até alguém recarregar a página na mão.
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

/**
 * A tela só chega aqui com o gateway configurado — quem decide isso é
 * `/app/whatsapp`, que troca a página inteira pelo aviso de área em produção
 * quando EVOLUTION_API_URL/KEY não existem. Por isso nenhum botão aqui trata o
 * caso "sem gateway": painel com tudo desabilitado parece defeito.
 */
export function WhatsAppConnectionPanel({
  connection,
  webhookActive,
}: {
  connection: WhatsAppConnection;
  /** Falso em dev/localhost: a VPS não alcança a URL do app. */
  webhookActive: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<WhatsAppConnectionStatus>(connection.status);
  const [phone, setPhone] = useState<string | null>(connection.connected_phone);
  const [error, setError] = useState<string | null>(connection.last_error);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

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
        router.refresh();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [polling, router]);

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

      // A 2.3.7 responde sem QR quando a sessão já está aberta — mostrar
      // "leia o código" nesse caso faria o dono esperar por um código que
      // nunca vem.
      if (result.alreadyConnected) {
        setStatus("conectado");
        setQrCode(null);
        setPairingCode(null);
        toast.success("Este número já está conectado.");
        router.refresh();
        return;
      }

      setStatus("conectando");
      setQrCode(result.qrCodeBase64);
      setPairingCode(result.pairingCode);
      if (!result.qrCodeBase64 && !result.pairingCode) {
        toast.info("O código ainda está sendo gerado. Toque em “Gerar novo código” em instantes.");
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
      router.refresh();
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
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteWhatsAppConnectionAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStatus("desconectado");
      setPhone(null);
      setQrCode(null);
      setPairingCode(null);
      setError(null);
      setDeleteOpen(false);
      toast.success("Conexão excluída");
      router.refresh();
    });
  }

  const meta = STATUS_META[status];
  const StatusIcon = meta.Icon;
  const neverConnected = !connection.instance_name && status === "desconectado";

  return (
    <div className="flex flex-col gap-5">
      <section className={cn("panel flex items-start gap-3 p-4", meta.tone)}>
        <StatusIcon
          className={cn("mt-0.5 size-5 shrink-0", status === "conectando" && "animate-spin")}
        />
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
          {connection.last_connected_at && status !== "conectado" && (
            <p className="text-xs text-muted-foreground">
              Última conexão:{" "}
              {new Date(connection.last_connected_at).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          )}
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
              disabled={pending || status === "conectado"}
              className="bg-cta text-white"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Smartphone className="size-4" />
              )}
              {status === "conectando"
                ? "Gerar novo código"
                : status === "desconectado" && connection.instance_name
                  ? "Reconectar número"
                  : "Conectar número"}
            </Button>
            <Button type="button" variant="outline" onClick={handleRefresh} disabled={pending}>
              <RefreshCw className="size-4" /> Atualizar status
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDisconnect}
              disabled={pending || status === "desconectado"}
            >
              <Unplug className="size-4" /> Desconectar
            </Button>

            {/* Excluir só aparece quando existe algo para excluir: um botão
                destrutivo permanentemente inerte só ensina o dono a ignorá-lo. */}
            {!neverConnected && (
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogTrigger
                  render={<Button type="button" variant="outline" disabled={pending} />}
                >
                  <Trash2 className="size-4" /> Excluir
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Excluir esta conexão?</DialogTitle>
                    <DialogDescription>
                      A conexão sai do sistema e a sessão é apagada no servidor. Os lembretes
                      automáticos param de sair até você conectar um número novamente — e
                      reconectar exigirá ler o QR code de novo.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline" />}>
                      Cancelar
                    </DialogClose>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={pending}
                    >
                      {pending && <Loader2 className="size-4 animate-spin" />}
                      Excluir
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {polling && (
            <p className="text-xs text-muted-foreground">
              Verificando a conexão a cada {POLL_INTERVAL_MS / 1000} segundos...
            </p>
          )}
          {!webhookActive && (
            <p className="max-w-sm text-center text-xs text-muted-foreground">
              Aviso automático de status desligado neste ambiente: o servidor de WhatsApp não
              alcança este endereço. O estado é atualizado ao abrir a tela e pelo botão acima.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
