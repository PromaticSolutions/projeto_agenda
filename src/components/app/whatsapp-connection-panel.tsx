"use client";

import { useState } from "react";
import { Loader2, QrCode, Smartphone, TriangleAlert, Unplug, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WhatsAppConnection } from "@/lib/types";
import type { WhatsAppConnectionStatus } from "@/lib/supabase/types";

/**
 * Tela de conexão do WhatsApp — SOMENTE INTERFACE (item 8 do escopo).
 *
 * A conexão real será feita pela Evolution API, que ainda não está integrada.
 * Por isso nenhum botão aqui abre sessão, gera QR de verdade ou grava status:
 * o painel reflete o estado persistido em `whatsapp_connections` e oferece
 * uma previsão dos estados visuais. Quando a integração entrar, o lugar de
 * ligar as chamadas é o `handleConnect`/`handleDisconnect` abaixo, e o webhook
 * dela passa a escrever o status na tabela.
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

export function WhatsAppConnectionPanel({ connection }: { connection: WhatsAppConnection }) {
  // Estado só de PREVIEW: permite conferir cada estado visual sem integração.
  // Não é persistido e não representa uma conexão real.
  const [preview, setPreview] = useState<WhatsAppConnectionStatus>(connection.status);
  const meta = STATUS_META[preview];
  const StatusIcon = meta.Icon;

  return (
    <div className="flex flex-col gap-5">
      <section className={cn("panel flex items-start gap-3 p-4", meta.tone)}>
        <StatusIcon className={cn("mt-0.5 size-5 shrink-0", preview === "conectando" && "animate-spin")} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-medium text-foreground">{meta.label}</h2>
            {connection.connected_phone && preview === "conectado" && (
              <Badge variant="secondary" className="font-mono">
                {connection.connected_phone}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
          {preview === "erro" && connection.last_error && (
            <p className="text-sm text-destructive">{connection.last_error}</p>
          )}
        </div>
      </section>

      <section className="panel p-4">
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex size-44 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
            {preview === "conectando" ? (
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            ) : (
              <QrCode className="size-10 text-muted-foreground" aria-hidden />
            )}
          </div>
          <div className="max-w-sm space-y-1 text-center">
            <p className="font-medium text-foreground">
              {preview === "conectando" ? "Leia o código no aparelho" : "Área do QR code"}
            </p>
            <p className="text-sm text-muted-foreground">
              WhatsApp → Aparelhos conectados → Conectar aparelho. O código será gerado aqui
              quando a integração estiver ativa.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" disabled className="bg-cta text-white">
              <Smartphone className="size-4" /> Conectar número
            </Button>
            <Button type="button" variant="outline" disabled>
              <Unplug className="size-4" /> Desconectar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ações desativadas: aguardando a integração com a Evolution API.
          </p>
        </div>
      </section>

      {/* Auxiliar de desenvolvimento: conferir os estados visuais sem backend. */}
      <section className="panel flex flex-wrap items-center gap-2 p-4">
        <p className="section-label mr-1 text-muted-foreground">Pré-visualizar estado</p>
        {(Object.keys(STATUS_META) as WhatsAppConnectionStatus[]).map((status) => (
          <Button
            key={status}
            type="button"
            variant={preview === status ? "default" : "outline"}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setPreview(status)}
          >
            {STATUS_META[status].label}
          </Button>
        ))}
      </section>
    </div>
  );
}
