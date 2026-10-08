"use server";

import { revalidatePath } from "next/cache";
import {
  ForbiddenError,
  createSalonAttendant,
  detachSalonAttendant,
  requireManager,
  setSalonAttendantActive,
  updateSalonAttendant,
} from "@/lib/data/salons";
import { isSlugAvailable } from "@/lib/data/studios";
import { salonAttendantEditSchema, salonAttendantSchema } from "@/lib/validation";

/**
 * Ações da gerente sobre as atendentes do salão dela.
 *
 * TODAS começam por `requireManager()`. Não é redundância com o layout: o
 * layout protege a NAVEGAÇÃO, e uma Server Action é uma porta HTTP própria —
 * quem montar o POST à mão nunca passa por layout nenhum. Proteger só na tela
 * seria exatamente o "if (user.role === 'gerente')" que não basta.
 *
 * E em nenhuma delas o salão vem do formulário: `createSalonAttendant` o tira
 * da sessão, e as de edição confirmam o vínculo do estúdio alvo antes de
 * escrever (`assertStudioInMySalon`).
 */
export type AttendantFormState = { ok: false; error: string } | { ok: true } | null;

/** Erro de autorização vira mensagem; o resto sobe e aparece no log. */
function toState(error: unknown): AttendantFormState {
  if (error instanceof ForbiddenError) return { ok: false, error: error.message };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Não foi possível concluir a operação." };
}

export async function createAttendantAction(
  _prevState: AttendantFormState,
  formData: FormData
): Promise<AttendantFormState> {
  try {
    const manager = await requireManager();

    const parsed = salonAttendantSchema.safeParse({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      whatsapp: String(formData.get("whatsapp") ?? ""),
      slug: String(formData.get("slug") ?? ""),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    if (!(await isSlugAvailable(parsed.data.slug))) {
      return { ok: false, error: "Esse link já está em uso, escolha outro." };
    }

    await createSalonAttendant(manager, parsed.data);
    revalidatePath("/app/gerencia/atendentes");
    revalidatePath("/app/gerencia");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export async function updateAttendantAction(
  studioId: string,
  _prevState: AttendantFormState,
  formData: FormData
): Promise<AttendantFormState> {
  try {
    const manager = await requireManager();

    const parsed = salonAttendantEditSchema.safeParse({
      name: String(formData.get("name") ?? ""),
      whatsapp: String(formData.get("whatsapp") ?? ""),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    await updateSalonAttendant(manager, studioId, parsed.data);
    revalidatePath("/app/gerencia/atendentes");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export type AttendantActionState = { ok: false; error: string } | { ok: true } | null;

export async function setAttendantActiveAction(
  studioId: string,
  active: boolean
): Promise<AttendantActionState> {
  try {
    const manager = await requireManager();
    await setSalonAttendantActive(manager, studioId, active);
    revalidatePath("/app/gerencia/atendentes");
    revalidatePath("/app/gerencia");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/**
 * "Remover do salão" — e não excluir.
 *
 * A atendente continua com login, agenda, clientes e histórico; só deixa de
 * ser enxergada pelo salão. Excluir levaria junto agendamento e conversa de
 * clientes que nunca foram do salão.
 */
export async function detachAttendantAction(studioId: string): Promise<AttendantActionState> {
  try {
    const manager = await requireManager();
    await detachSalonAttendant(manager, studioId);
    revalidatePath("/app/gerencia/atendentes");
    revalidatePath("/app/gerencia");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}
