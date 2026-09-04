"use server";

import { revalidatePath } from "next/cache";
import { getMyStudio } from "@/lib/data/studios";
import { saveWhatsAppConnection } from "@/lib/data/whatsapp";
import { syncWhatsAppConnection } from "@/lib/data/dispatch";
import { sendManualWhatsAppMessage } from "@/lib/data/whatsappSend";
import {
  friendlyProviderError,
  getWhatsAppProvider,
  instanceNameForStudio,
  resolveWebhookTarget,
} from "@/lib/whatsapp/provider";
import type { WhatsAppConnectionStatus } from "@/lib/types";

/**
 * Ações da tela de conexão do WhatsApp.
 *
 * Todas passam por `getMyStudio()` antes de tocar no gateway: é isso que
 * amarra a instância ao inquilino certo. O nome da instância é derivado do ID
 * do estúdio (`instanceNameForStudio`), nunca recebido do cliente — aceitar
 * esse nome por parâmetro seria entregar a sessão de um salão para outro a
 * quem trocasse o valor no formulário (seção 6 do plano).
 *
 * A chave da Evolution nunca sai do servidor: a tela chama estas ações, e
 * nenhum componente de cliente importa `@/lib/whatsapp/*`.
 */

export type WhatsAppActionState =
  | { ok: true; qrCodeBase64: string | null; pairingCode: string | null; alreadyConnected: boolean }
  | { ok: false; error: string }
  | null;

const SEM_GATEWAY = "O WhatsApp ainda não está disponível neste ambiente.";

export async function connectWhatsAppAction(): Promise<WhatsAppActionState> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  const provider = await getWhatsAppProvider();
  if (!provider) return { ok: false, error: SEM_GATEWAY };

  const instanceName = instanceNameForStudio(studio.id);

  try {
    await provider.ensureInstance(instanceName);

    // O webhook é registrado ANTES de pedir o QR: a Evolution emite
    // `qrcode.updated` e `connection.update` durante o pareamento, e um
    // webhook registrado depois perderia justamente o evento que diz
    // "conectou". Falha aqui não aborta a conexão — o polling da tela cobre.
    const target = resolveWebhookTarget();
    if (target) {
      try {
        await provider.setWebhook({ instanceName, url: target.url, secret: target.secret });
      } catch (cause) {
        console.error("[whatsapp/connect] setWebhook", cause);
      }
    }

    const pairing = await provider.connect(instanceName);

    // Sessão já aberta: a 2.3.7 responde sem QR nesse caso, e insistir em
    // mostrar "leia o código" faria o dono esperar por um código que não vem.
    if (!pairing.qrCodeBase64 && !pairing.pairingCode) {
      const connection = await syncWhatsAppConnection(studio.id, provider);
      revalidatePath("/app/whatsapp");
      if (connection.status === "conectado") {
        return { ok: true, qrCodeBase64: null, pairingCode: null, alreadyConnected: true };
      }
      // Estado fechado + resposta sem QR: a rota reconecta e espera 2s, e o
      // código pode simplesmente não ter sido gerado ainda. A tela pede de novo.
      return { ok: true, qrCodeBase64: null, pairingCode: null, alreadyConnected: false };
    }

    await saveWhatsAppConnection(studio.id, {
      status: "conectando",
      instance_name: instanceName,
      last_error: null,
    });
    revalidatePath("/app/whatsapp");

    return {
      ok: true,
      qrCodeBase64: pairing.qrCodeBase64,
      pairingCode: pairing.pairingCode,
      alreadyConnected: false,
    };
  } catch (cause) {
    console.error("[whatsapp/connect]", cause);
    const friendly = friendlyProviderError(cause);
    await saveWhatsAppConnection(studio.id, {
      status: "erro",
      instance_name: instanceName,
      // A coluna alimenta a tela, então guarda a versão amigável. O detalhe
      // técnico ficou no log acima.
      last_error: friendly,
    });
    revalidatePath("/app/whatsapp");
    return { ok: false, error: friendly };
  }
}

/**
 * Relê o estado real no gateway e grava no banco.
 *
 * Existe mesmo havendo webhook, e isso é deliberado: o webhook depende de a
 * VPS alcançar a URL pública do app, o que não acontece em desenvolvimento
 * (localhost) nem durante um deploy. Consulta é o piso que sempre funciona;
 * webhook é o que torna a tela instantânea. Ver DECISIONS.md.
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
  revalidatePath("/app/reminders");
  return { ok: true };
}

/**
 * Exclui a conexão (seção 19).
 *
 * Diferente de desconectar: apaga a instância no gateway, o que descarta as
 * credenciais da sessão do lado da Evolution. Reconectar depois disso exige
 * ler o QR de novo — é por isso que a tela pede confirmação.
 *
 * A linha do banco é ZERADA, não removida: `whatsapp_connections.studio_id` é
 * a chave primária e a tela lê essa linha para desenhar o estado. Apagá-la e
 * recriá-la a cada ciclo perderia `last_connected_at`, que é o histórico que
 * responde "desde quando esse número parou de funcionar?".
 */
export async function deleteWhatsAppConnectionAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  const provider = await getWhatsAppProvider();
  if (!provider) return { ok: false, error: SEM_GATEWAY };

  try {
    await provider.deleteInstance(instanceNameForStudio(studio.id));
  } catch (cause) {
    console.error("[whatsapp/delete]", cause);
    return { ok: false, error: friendlyProviderError(cause) };
  }

  await saveWhatsAppConnection(studio.id, {
    status: "desconectado",
    instance_name: null,
    connected_phone: null,
    last_error: null,
    last_connected_at: null,
  });
  revalidatePath("/app/whatsapp");
  revalidatePath("/app/reminders");
  return { ok: true };
}

export type ManualSendState =
  /**
   * `token` é novo a cada envio aceito. A tela o usa como `key` do
   * subformulário: remontar é o que limpa os campos e o contador de
   * caracteres de uma vez, sem `setState` dentro de efeito (o que o lint do
   * React Compiler recusa, com razão — geraria render em cascata).
   */
  | { ok: true; to: string; token: string }
  | { ok: false; error: string }
  | null;

/**
 * Envio manual (seções 20–22). Toda a regra está em
 * `sendManualWhatsAppMessage`, compartilhada com POST /api/whatsapp/send —
 * esta camada só traduz FormData e revalida a tela.
 */
export async function sendManualMessageAction(
  _prev: ManualSendState,
  formData: FormData
): Promise<ManualSendState> {
  const result = await sendManualWhatsAppMessage({
    phone: String(formData.get("phone") ?? ""),
    message: String(formData.get("message") ?? ""),
  });

  if (!result.ok) return { ok: false, error: result.error };

  // O histórico da própria tela acabou de ganhar uma linha.
  revalidatePath("/app/whatsapp");
  return { ok: true, to: result.to, token: crypto.randomUUID() };
}
