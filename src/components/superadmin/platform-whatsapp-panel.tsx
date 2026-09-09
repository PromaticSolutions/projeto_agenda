"use client";

import Image from "next/image";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, QrCode, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhoneDisplay } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  connectPlatformWhatsAppAction,
  disconnectPlatformWhatsAppAction,
  refreshPlatformWhatsAppAction,
  savePlatformNotifyPhoneAction,
  type NotifyPhoneState,
  type PlatformWhatsAppActionState,
} from "@/app/superadmin/whatsapp/actions";
import type { PlatformWhatsApp } from "@/lib/data/platform-whatsapp";
import type { WhatsAppConnectionStatus } from "@/lib/types";

/**
 * Pareamento e destino do WhatsApp da plataforma.
 *
 * Mesma mecânica da tela do estúdio (`whatsapp-connection-panel.tsx`): o
 * pareamento passa por server action em vez de `fetch` daqui, porque a chave
 * da Evolution não pode sair do servidor — nenhum componente de cliente
 * importa `@/lib/whatsapp/*`.
 *
 * Enquanto o QR está na tela, o componente pergunta o estado ao gateway de
 * tempos em tempos. É o piso que sempre funciona: o webhook depende de a VPS
 * alcançar a URL pública do app, o que não acontece em desenvolvimento.
 */

const ROTULO: Record<WhatsAppConnectionStatus, { texto: string; classe: string }> = {
  desconectado: { texto: "Desconectado", classe: "bg-muted text-muted-foreground" },
  conectando: { texto: "Aguardando leitura do QR", classe: "bg-amber-500/10 text-amber-700" },
  conectado: { texto: "Conectado", classe: "bg-emerald-500/10 text-emerald-700" },
  erro: { texto: "Erro", classe: "bg-destructive/10 text-destructive" },
};

const POLL_MS = 3000;

export function PlatformWhatsAppPanel({ conexao }: { conexao: PlatformWhatsApp }) {
  const [status, setStatus] = useState<WhatsAppConnectionStatus>(conexao.status);
  const [phone, setPhone] = useState<string | null>(conexao.connected_phone);
  const [pairing, setPairing] = useState<PlatformWhatsAppActionState>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(conexao.last_error);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [notifyState, saveNotify, savingNotify] = useActionState<NotifyPhoneState, FormData>(
    savePlatformNotifyPhoneAction,
    null
  );

  /* CONTROLADO, não `defaultValue`. O valor muda depois de salvar (a action
     revalida a rota e o servidor manda `conexao` nova), e trocar o
     `defaultValue` de um campo já montado não atualiza a tela — só rende o
     aviso do Base UI sobre mexer no estado de um campo não-controlado. */
  const [notifyPhone, setNotifyPhone] = useState(conexao.notify_phone ?? "");

  const parar = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // O polling vive enquanto o QR está na tela. Sai de cena assim que o estado
  // vira "conectado" — continuar perguntando depois é bater no gateway à toa.
  useEffect(() => {
    if (status !== "conectando") {
      parar();
      return;
    }
    pollRef.current = setInterval(async () => {
      const r = await refreshPlatformWhatsAppAction();
      if (r.ok) {
        setStatus(r.status);
        setPhone(r.phone);
        if (r.status === "conectado") setPairing(null);
      }
    }, POLL_MS);
    return parar;
  }, [status, parar]);

  async function conectar() {
    setBusy(true);
    setErro(null);
    const r = await connectPlatformWhatsAppAction();
    setBusy(false);
    if (!r) return;
    if (!r.ok) {
      setErro(r.error);
      setStatus("erro");
      return;
    }
    setPairing(r);
    setStatus(r.alreadyConnected ? "conectado" : "conectando");
  }

  async function atualizar() {
    setBusy(true);
    const r = await refreshPlatformWhatsAppAction();
    setBusy(false);
    if (r.ok) {
      setStatus(r.status);
      setPhone(r.phone);
    } else {
      setErro(r.error);
    }
  }

  async function desconectar() {
    setBusy(true);
    const r = await disconnectPlatformWhatsAppAction();
    setBusy(false);
    if (r.ok) {
      setStatus("desconectado");
      setPhone(null);
      setPairing(null);
    } else {
      setErro(r.error);
    }
  }

  const rotulo = ROTULO[status];

  return (
    <div className="flex flex-col gap-6">
      <div className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium text-foreground">Número que envia</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A instância da plataforma. É por ela que o aviso de lead sai.
            </p>
          </div>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", rotulo.classe)}>
            {rotulo.texto}
          </span>
        </div>

        {/* Só com a sessão DE PÉ. O número pareado sobrevive na tabela depois
            de uma queda, e mostrá-lo ao lado de "Desconectado" faria a tela
            dizer duas coisas contraditórias sobre o mesmo estado. */}
        {phone && status === "conectado" && (
          <p className="mt-3 flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
            Pareado com {formatPhoneDisplay(phone)}
          </p>
        )}

        {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}

        {pairing?.ok && pairing.qrCodeBase64 && status === "conectando" && (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5">
            <Image
              src={pairing.qrCodeBase64}
              alt="QR code para parear o WhatsApp da plataforma"
              width={240}
              height={240}
              unoptimized
              className="rounded-lg"
            />
            <p className="max-w-xs text-center text-sm text-muted-foreground">
              No celular: WhatsApp → Dispositivos conectados → Conectar dispositivo.
            </p>
            {pairing.pairingCode && (
              <p className="text-sm text-muted-foreground">
                Ou use o código{" "}
                <span className="font-mono font-semibold text-foreground">
                  {pairing.pairingCode}
                </span>
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {status !== "conectado" && (
            <Button onClick={conectar} disabled={busy} size="sm">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
              {status === "conectando" ? "Gerar novo QR" : "Conectar WhatsApp"}
            </Button>
          )}
          <Button onClick={atualizar} disabled={busy} size="sm" variant="outline">
            <RefreshCw className={cn("size-4", busy && "animate-spin")} />
            Atualizar estado
          </Button>
          {status === "conectado" && (
            <Button onClick={desconectar} disabled={busy} size="sm" variant="ghost">
              <Unplug className="size-4" />
              Desconectar
            </Button>
          )}
        </div>
      </div>

      <form action={saveNotify} className="panel flex flex-col gap-3 p-5">
        <div>
          <h2 className="font-medium text-foreground">Número que recebe</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Para onde cada resposta do formulário da landing é enviada. Pode ser o
            mesmo número acima — nesse caso a mensagem cai em “Mensagem para você
            mesmo”, que é o arranjo de quem tem um chip só.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="notify_phone">WhatsApp de destino</Label>
          <Input
            id="notify_phone"
            name="notify_phone"
            value={notifyPhone}
            onChange={(e) => setNotifyPhone(e.target.value)}
            placeholder="(11) 93447-6935"
            inputMode="tel"
          />
          <p className="text-xs text-muted-foreground">
            Deixe vazio para não avisar ninguém. O lead continua sendo gravado.
          </p>
        </div>

        {notifyState && !notifyState.ok && (
          <p className="text-sm text-destructive">{notifyState.error}</p>
        )}
        {notifyState?.ok && (
          <p className="text-sm text-emerald-700">
            {notifyState.phone
              ? `Avisos vão para ${formatPhoneDisplay(notifyState.phone)}.`
              : "Destino removido — ninguém será avisado."}
          </p>
        )}

        <Button type="submit" disabled={savingNotify} size="sm" className="self-start">
          {savingNotify ? "Salvando..." : "Salvar destino"}
        </Button>
      </form>
    </div>
  );
}
