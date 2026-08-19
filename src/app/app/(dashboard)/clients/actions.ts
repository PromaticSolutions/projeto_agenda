"use server";

import { revalidatePath } from "next/cache";
import {
  createClient,
  deleteClient,
  getMyClient,
  updateClient,
  updateClientNotes,
} from "@/lib/data/clients";
import { getMyStudio } from "@/lib/data/studios";
import { clientInputSchema, clientNotesSchema } from "@/lib/validation";

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

export type ClientFormState = { ok: false; error: string } | { ok: true } | null;

const DUPLICATE_MESSAGE =
  "Já existe uma cliente com esse telefone. Abra o cadastro dela em vez de criar outro.";

function parseClientForm(formData: FormData) {
  return clientInputSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  });
}

export async function createClientAction(
  _prevState: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const result = await createClient(studio.id, parsed.data.name, parsed.data.phone);
  if (!result.ok) return { ok: false, error: DUPLICATE_MESSAGE };

  revalidatePath("/app/clients");
  return { ok: true };
}

export async function updateClientAction(
  clientId: string,
  _prevState: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const result = await updateClient(studio.id, clientId, parsed.data.name, parsed.data.phone);
  if (!result.ok) return { ok: false, error: DUPLICATE_MESSAGE };

  revalidatePath("/app/clients");
  revalidatePath(`/app/clients/${clientId}`);
  return { ok: true };
}

export type DeleteClientState = { ok: true } | { ok: false; error: string };

export async function deleteClientAction(clientId: string): Promise<DeleteClientState> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  try {
    await deleteClient(studio.id, clientId);
    revalidatePath("/app/clients");
    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Não foi possível excluir a cliente. Tente novamente." };
  }
}
