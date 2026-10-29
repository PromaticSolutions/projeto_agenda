"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkPlatformAdmin } from "@/lib/data/platformAdmins";
import { addTicketMessage, setTicketStatus } from "@/lib/data/support";
import { BODY_MAX, type SupportWriteResult } from "@/lib/support";
import type { SupportTicketStatus } from "@/lib/types";

/**
 * Ações da equipe nos chamados. Server Action é endpoint público, então cada
 * uma confere `platform_admins` de novo — o layout só esconde a tela.
 */

const bodySchema = z.string().trim().min(1, "Escreva a mensagem.").max(BODY_MAX);
const STATUSES: SupportTicketStatus[] = ["aberto", "em_andamento", "resolvido"];

export async function replyAsSupportAction(ticketId: string, body: string, resolve: boolean): Promise<SupportWriteResult> {
  const check = await checkPlatformAdmin();
  if (check.status !== "ok") return { ok: false, error: "Acesso restrito." };

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Escreva a mensagem." };

  const result = await addTicketMessage({
    ticketId,
    author: "suporte",
    authorId: check.admin.id,
    body: parsed.data,
    resolve,
  });
  if (result.ok) {
    revalidatePath(`/superadmin/chamados/${ticketId}`);
    revalidatePath("/superadmin/chamados");
  }
  return result;
}

export async function setTicketStatusAction(ticketId: string, status: string): Promise<void> {
  if ((await checkPlatformAdmin()).status !== "ok") return;
  if (!STATUSES.includes(status as SupportTicketStatus)) return;
  await setTicketStatus({ ticketId, status: status as SupportTicketStatus });
  revalidatePath(`/superadmin/chamados/${ticketId}`);
  revalidatePath("/superadmin/chamados");
}
