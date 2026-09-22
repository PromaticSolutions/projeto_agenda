"use server";

import { revalidatePath } from "next/cache";
import {
  createService,
  deleteService,
  syncServiceAttachments,
  updateService,
  type DeleteServiceMode,
} from "@/lib/data/services";
import { uploadServiceAttachment, type AttachmentUploadResult } from "@/lib/data/storage";
import { getMyStudio } from "@/lib/data/studios";
import { serviceAttachmentListSchema, serviceInputSchema } from "@/lib/validation";

/** `warning`: o serviço foi salvo, mas algo secundário (os anexos) não. */
export type ServiceActionState =
  | { ok: false; error: string }
  | { ok: true; warning?: string }
  | null;

function parsePriceReais(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const reais = Number(normalized);
  return Math.round(reais * 100);
}

function parseServiceForm(formData: FormData) {
  // Campo opcional: em branco vira `undefined` para gravar NULL, e não uma
  // string vazia que depois apareceria como observação existente e em branco.
  const notes = String(formData.get("notes") ?? "").trim();

  return serviceInputSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    price_cents: parsePriceReais(String(formData.get("price_reais") ?? "0")),
    duration_min: Number(formData.get("duration_min") ?? 0),
    color: String(formData.get("color") ?? "#7C3AED"),
    active: formData.get("active") === "on",
    notes: notes === "" ? undefined : notes,
  });
}

/** A lista de anexos vem como JSON num campo escondido do formulário. */
function parseAttachmentsField(formData: FormData) {
  const raw = formData.get("attachments");
  // Sem o campo = formulário antigo em cache: não mexe nos anexos.
  if (typeof raw !== "string") return { success: true as const, data: null };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { success: false as const, error: "Lista de anexos inválida." };
  }
  const parsed = serviceAttachmentListSchema.safeParse(json);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Lista de anexos inválida." };
  }
  return { success: true as const, data: parsed.data };
}

const ATTACHMENTS_WARNING =
  "Serviço salvo, mas não foi possível atualizar as fotos e anexos. Abra o serviço e tente de novo.";

export async function createServiceAction(
  _prevState: ServiceActionState,
  formData: FormData
): Promise<ServiceActionState> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  const parsed = parseServiceForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const attachments = parseAttachmentsField(formData);
  if (!attachments.success) return { ok: false, error: attachments.error };

  const service = await createService({
    studio_id: studio.id,
    ...parsed.data,
    notes: parsed.data.notes ?? null,
  });
  revalidatePath("/app/services");

  if (attachments.data && attachments.data.length > 0) {
    try {
      await syncServiceAttachments(studio.id, service.id, attachments.data);
    } catch (err) {
      console.error(err);
      // O serviço já existe: devolver erro deixaria o diálogo aberto e o
      // próximo Salvar criaria um segundo serviço igual.
      return { ok: true, warning: ATTACHMENTS_WARNING };
    }
  }
  return { ok: true };
}

export async function updateServiceAction(
  id: string,
  _prevState: ServiceActionState,
  formData: FormData
): Promise<ServiceActionState> {
  const parsed = parseServiceForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const attachments = parseAttachmentsField(formData);
  if (!attachments.success) return { ok: false, error: attachments.error };

  const service = await updateService(id, { ...parsed.data, notes: parsed.data.notes ?? null });
  revalidatePath("/app/services");

  if (attachments.data) {
    try {
      await syncServiceAttachments(service.studio_id, service.id, attachments.data);
    } catch (err) {
      console.error(err);
      return { ok: true, warning: ATTACHMENTS_WARNING };
    }
  }
  return { ok: true };
}

/**
 * Recebe UM arquivo escolhido no formulário do serviço e devolve o caminho no
 * bucket. Não liga nada ao serviço — isso é do Salvar (ver
 * `uploadServiceAttachment`). Um arquivo por chamada mantém cada requisição
 * abaixo do bodySizeLimit, mesmo quando o dono escolhe vários de uma vez.
 */
export async function uploadServiceAttachmentAction(
  formData: FormData
): Promise<AttachmentUploadResult> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Nenhum arquivo recebido." };

  return uploadServiceAttachment(studio.id, file);
}

export type DeleteServiceState =
  | { ok: true; mode: DeleteServiceMode }
  | { ok: false; error: string };

/**
 * O retorno diz ao dono o que realmente aconteceu: um serviço já agendado não
 * pode ser apagado (FK `on delete restrict`), então ele é arquivado — e a tela
 * precisa explicar isso em vez de fingir que excluiu.
 */
export async function deleteServiceAction(id: string): Promise<DeleteServiceState> {
  try {
    const mode = await deleteService(id);
    revalidatePath("/app/services");
    revalidatePath("/app");
    return { ok: true, mode };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Não foi possível excluir o serviço. Tente novamente." };
  }
}

export type ToggleServiceState = { ok: true } | { ok: false; error: string };

export async function toggleServiceActiveAction(
  id: string,
  active: boolean
): Promise<ToggleServiceState> {
  try {
    await updateService(id, { active });
    revalidatePath("/app/services");
    revalidatePath("/app");
    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Não foi possível alterar o serviço. Tente novamente." };
  }
}
