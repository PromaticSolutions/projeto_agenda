"use server";

import { revalidatePath } from "next/cache";
import { checkPlatformAdmin } from "@/lib/data/platformAdmins";
import { getPlatformWhatsApp, savePlatformWhatsApp } from "@/lib/data/platform-whatsapp";
import { syncPlatformWhatsApp } from "@/lib/data/dispatch";
import {
  friendlyProviderError,
  getWhatsAppProvider,
  instanceNameForPlatform,
  resolveWebhookTarget,
} from "@/lib/whatsapp/provider";
import { clientPhoneSchema } from "@/lib/validation";
import type { WhatsAppConnectionStatus } from "@/lib/types";

/**
 * Ações da conexão de WhatsApp da PLATAFORMA.
 *
 * Espelham `app/(dashboard)/whatsapp/actions.ts`, com a diferença que importa:
 * lá o guard é `getMyStudio()`, que amarra a instância ao inquilino; aqui é
 * `checkPlatformAdmin()`. Server Action é endpoint público — o layout já negar
 * acesso à página NÃO impede alguém de chamar a action direto, então cada uma
 * repete a checagem.
 *
 * O nome da instância é derivado (`instanceNameForPlatform`), nunca recebido do
 * cliente, pelo mesmo motivo do lado do estúdio: aceitar por parâmetro seria
 * entregar a sessão de um salão a quem trocasse o valor no formulário.
 */

export type PlatformWhatsAppActionState =
  | { ok: true; qrCodeBase64: string | null; pairingCode: string | null; alreadyConnected: boolean }
  | { ok: false; error: string }
  | null;

const SEM_GATEWAY = "O WhatsApp ainda não está disponível neste ambiente.";
const SEM_ACESSO = "Acesso restrito.";

async function guard(): Promise<boolean> {
  const check = await checkPlatformAdmin();
  return check.status === "ok";
}

export async function connectPlatformWhatsAppAction(): Promise<PlatformWhatsAppActionState> {
  if (!(await guard())) return { ok: false, error: SEM_ACESSO };

  const provider = await getWhatsAppProvider();
  if (!provider) return { ok: false, error: SEM_GATEWAY };

  const instanceName = instanceNameForPlatform();

  try {
    await provider.ensureInstance(instanceName);

    // Webhook ANTES do QR, mesma razão do lado do estúdio: a Evolution emite
    // `qrcode.updated` e `connection.update` durante o pareamento, e registrar
    // depois perderia justamente o evento que diz "conectou".
    const target = resolveWebhookTarget();
    if (target) {
      try {
        await provider.setWebhook({ instanceName, url: target.url, secret: target.secret });
      } catch (cause) {
        console.error("[superadmin/whatsapp] setWebhook", cause);
      }
    }

    const pairing = await provider.connect(instanceName);

    if (!pairing.qrCodeBase64 && !pairing.pairingCode) {
      const conexao = await syncPlatformWhatsApp(provider);
      revalidatePath("/superadmin/whatsapp");
      return {
        ok: true,
        qrCodeBase64: null,
        pairingCode: null,
        alreadyConnected: conexao.status === "conectado",
      };
    }

    await savePlatformWhatsApp({
      status: "conectando",
      instance_name: instanceName,
      last_error: null,
    });
    revalidatePath("/superadmin/whatsapp");

    return {
      ok: true,
      qrCodeBase64: pairing.qrCodeBase64,
      pairingCode: pairing.pairingCode,
      alreadyConnected: false,
    };
  } catch (cause) {
    console.error("[superadmin/whatsapp/connect]", cause);
    const friendly = friendlyProviderError(cause);
    await savePlatformWhatsApp({
      status: "erro",
      instance_name: instanceName,
      last_error: friendly,
    });
    revalidatePath("/superadmin/whatsapp");
    return { ok: false, error: friendly };
  }
}

export async function refreshPlatformWhatsAppAction(): Promise<
  { ok: true; status: WhatsAppConnectionStatus; phone: string | null } | { ok: false; error: string }
> {
  if (!(await guard())) return { ok: false, error: SEM_ACESSO };

  const provider = await getWhatsAppProvider();
  if (!provider) return { ok: false, error: SEM_GATEWAY };

  const conexao = await syncPlatformWhatsApp(provider);
  revalidatePath("/superadmin/whatsapp");
  return { ok: true, status: conexao.status, phone: conexao.connected_phone };
}

export async function disconnectPlatformWhatsAppAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (!(await guard())) return { ok: false, error: SEM_ACESSO };

  const provider = await getWhatsAppProvider();
  if (!provider) return { ok: false, error: SEM_GATEWAY };

  try {
    await provider.logout(instanceNameForPlatform());
  } catch (cause) {
    console.error("[superadmin/whatsapp/disconnect]", cause);
    // Mesmo com falha no gateway o estado local vira "desconectado": deixar a
    // tela dizendo "conectado" faria o aviso de lead parecer funcionando.
  }

  await savePlatformWhatsApp({
    status: "desconectado",
    connected_phone: null,
    last_error: null,
  });
  revalidatePath("/superadmin/whatsapp");
  return { ok: true };
}

export type NotifyPhoneState = { ok: true; phone: string | null } | { ok: false; error: string } | null;

/**
 * Define (ou limpa) o número que recebe o aviso de lead.
 *
 * Aceita ficar IGUAL ao número conectado — é o arranjo de quem tem um chip só,
 * e a mensagem cai em "Mensagem para você mesmo". Vazio limpa o destino e o
 * aviso volta a não ser enfileirado, que é melhor do que enfileirar para
 * lugar nenhum.
 */
export async function savePlatformNotifyPhoneAction(
  _prev: NotifyPhoneState,
  formData: FormData
): Promise<NotifyPhoneState> {
  if (!(await guard())) return { ok: false, error: SEM_ACESSO };

  const raw = String(formData.get("notify_phone") ?? "").trim();

  if (!raw) {
    await savePlatformWhatsApp({ notify_phone: null });
    revalidatePath("/superadmin/whatsapp");
    return { ok: true, phone: null };
  }

  const parsed = clientPhoneSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Telefone inválido" };
  }

  await savePlatformWhatsApp({ notify_phone: parsed.data });
  revalidatePath("/superadmin/whatsapp");
  return { ok: true, phone: parsed.data };
}

/** Usado pela tela para mostrar o estado sem reimplementar a leitura. */
export async function readPlatformWhatsAppAction() {
  if (!(await guard())) return null;
  return getPlatformWhatsApp();
}
