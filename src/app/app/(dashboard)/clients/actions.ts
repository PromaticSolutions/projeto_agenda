"use server";

import { revalidatePath } from "next/cache";
import { getMyClient, updateClientNotes } from "@/lib/data/clients";
import { getMyStudio } from "@/lib/data/studios";
import { clientNotesSchema } from "@/lib/validation";

export type ClientActionState = { ok: false; error: string } | { ok: true } | null;

export async function updateClientNotesAction(
  clientId: string,
  _prevState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  const existing = await getMyClient(studio.id, clientId);
  if (!existing) return { ok: false, error: "Cliente não encontrado" };

  const parsed = clientNotesSchema.safeParse({ notes: String(formData.get("notes") ?? "") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  await updateClientNotes(clientId, parsed.data.notes || null);
  revalidatePath(`/app/clients/${clientId}`);
  return { ok: true };
}
