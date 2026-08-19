"use server";

import { revalidatePath } from "next/cache";
import { getMyStudio } from "@/lib/data/studios";
import { saveWhatsAppConnection } from "@/lib/data/whatsapp";
import { syncWhatsAppConnection } from "@/lib/data/dispatch";
import { getWhatsAppProvider, instanceNameForStudio } from "@/lib/whatsapp/provider";
import type { WhatsAppConnectionStatus } from "@/lib/types";

/**
 * Ações da tela de conexão do WhatsApp.
 *
 * Todas passam por `getMyStudio()` antes de tocar no gateway: é isso que
 * amarra a instância da Evolution ao inquilino certo. O nome da instância é
 * derivado do ID do estúdio (`instanceNameForStudio`), nunca recebido do
 * cliente — aceitar esse nome por parâmetro seria entregar a sessão de um
 * salão para outro a quem trocasse o valor no formulário.
 *
 * A chave da Evolution nunca sai do servidor: a tela chama estas ações, não a
 * API do gateway.
 */

export type WhatsAppActionState =
  | { ok: true; qrCodeBase64: string | null; pairingCode: string | null }
  | { ok: false; error: string }
  | null;

const SEM_GATEWAY =
  "Gateway de WhatsApp não configurado. Defina EVOLUTION_API_URL e EVOLUTION_API_KEY no ambiente.";

export async function connectWhatsAppAction(): Promise<WhatsAppActionState> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  const provider = await getWhatsAppProvider();
  if (!provider) return { ok: false, error: SEM_GATEWAY };

  const instanceName = instanceNameForStudio(studio.id);

  try {
    await provider.ensureInstance(instanceName);
    const pairing = await provider.connect(instanceName);

    await saveWhatsAppConnection(studio.id, {
      status: "conectando",
      instance_name: instanceName,
      last_error: null,
    });
    revalidatePath("/app/whatsapp");

    return { ok: true, qrCodeBase64: pairing.qrCodeBase64, pairingCode: pairing.pairingCode };
  } catch (cause) {
    console.error("[whatsapp/connect]", cause);
    const message = cause instanceof Error ? cause.message : "Falha ao conectar";
    await saveWhatsAppConnection(studio.id, {
      status: "erro",
      instance_name: instanceName,
      last_error: message,
    });
    revalidatePath("/app/whatsapp");
    return { ok: false, error: message };
  }
}

/**
 * Relê o estado real no gateway e grava no banco.
 *
 * A tela chama isto em intervalos enquanto o QR está aberto — é assim que ela
 * descobre que a leitura funcionou, sem webhook. Preferir consulta a webhook
 * aqui é decisão registrada em DECISIONS.md: uma entrega de webhook perdida
 * durante um deploy deixaria a tela mentindo até alguém reconectar na mão.
 */
export async function refreshWhatsAppStatusAction(): Promise<
  { ok: true; status: WhatsAppConnectionStatus; phone: string | null } | { ok: false; error: string }
> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  const provider = await getWhatsAppProvider();
  if (!provider) return { ok: false, error: SEM_GATEWAY };

  const connection = await syncWhatsAppConnection(studio.id, provider);
  revalidatePath("/app/whatsapp");
  return { ok: true, status: connection.status, phone: connection.connected_phone };
}

export async function disconnectWhatsAppAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  const provider = await getWhatsAppProvider();
  if (!provider) return { ok: false, error: SEM_GATEWAY };

  try {
    await provider.logout(instanceNameForStudio(studio.id));
  } catch (cause) {
    console.error("[whatsapp/disconnect]", cause);
    // Mesmo com falha no gateway, o estado local vira "desconectado": o dono
    // pediu para desconectar, e deixar a tela dizendo "conectado" faria os
    // lembretes parecerem funcionando quando não estão.
  }

  await saveWhatsAppConnection(studio.id, {
    status: "desconectado",
    connected_phone: null,
    last_error: null,
  });
  revalidatePath("/app/whatsapp");
  return { ok: true };
}
