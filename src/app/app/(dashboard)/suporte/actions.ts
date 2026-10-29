"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMyStudio } from "@/lib/data/studios";
import { addTicketMessage, createTicket, setTicketStatus } from "@/lib/data/support";
import { BODY_MAX, CATEGORY_ORDER, SUBJECT_MAX, SUBJECT_MIN, type SupportWriteResult } from "@/lib/support";
import type { SupportTicketCategory } from "@/lib/types";

/**
 * Ações de chamado do lado do estúdio.
 *
 * O estúdio vem SEMPRE da sessão (`getMyStudio`), nunca do formulário — é
 * isso que mantém cada dono dentro dos próprios chamados. O id do chamado
 * ainda vem de fora, e por isso a camada de dados filtra pelo estúdio também.
 */

const newTicketSchema = z.object({
  subject: z.string().trim().min(SUBJECT_MIN, "Escreva um título curto.").max(SUBJECT_MAX),
  category: z.enum(CATEGORY_ORDER as [SupportTicketCategory, ...SupportTicketCategory[]]),
  body: z.string().trim().min(10, "Conte um pouco mais do que aconteceu.").max(BODY_MAX),
});

const bodySchema = z.string().trim().min(1, "Escreva a mensagem.").max(BODY_MAX);

export async function createTicketAction(input: z.input<typeof newTicketSchema>): Promise<SupportWriteResult> {
  const parsed = newTicketSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira os campos." };

  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Sessão expirada. Entre de novo." };

  const result = await createTicket({ studioId: studio.id, userId: studio.owner_id, ...parsed.data });
  if (result.ok) revalidatePath("/app/suporte");
  return result;
}

export async function replyTicketAction(ticketId: string, body: string): Promise<SupportWriteResult> {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Escreva a mensagem." };

  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Sessão expirada. Entre de novo." };

  const result = await addTicketMessage({
    ticketId,
    studioId: studio.id,
    author: "cliente",
    authorId: studio.owner_id,
    body: parsed.data,
  });
  if (result.ok) revalidatePath(`/app/suporte/${ticketId}`);
  return result;
}

/** O próprio cliente diz "resolveu". Reabrir é só escrever de novo. */
export async function resolveMyTicketAction(ticketId: string): Promise<void> {
  const studio = await getMyStudio();
  if (!studio) return;
  await setTicketStatus({ ticketId, studioId: studio.id, status: "resolvido" });
  revalidatePath(`/app/suporte/${ticketId}`);
}
