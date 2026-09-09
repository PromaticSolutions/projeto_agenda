"use server";

import { revalidatePath } from "next/cache";
import { getMyStudio } from "@/lib/data/studios";
import { resolveDataSubjectRequest } from "@/lib/data/data-requests";
import type { DataRequestStatus } from "@/lib/types";

const STATUS_VALIDOS: DataRequestStatus[] = [
  "aberta",
  "em_andamento",
  "concluida",
  "recusada",
];

/**
 * Muda o estado de uma solicitação do titular.
 *
 * O estúdio do DONO LOGADO é resolvido aqui dentro, e não recebido do
 * formulário: um `studioId` vindo do cliente seria um caminho para mexer na
 * fila de outra conta. O id da solicitação ainda vem de fora, e por isso o
 * filtro por estúdio é repetido na consulta (ver `resolveDataSubjectRequest`).
 */
export async function resolveDataRequestAction(
  id: string,
  status: string,
  note: string | null
): Promise<void> {
  if (!STATUS_VALIDOS.includes(status as DataRequestStatus)) return;

  const studio = await getMyStudio();
  if (!studio) return;

  await resolveDataSubjectRequest({
    id,
    studioId: studio.id,
    status: status as DataRequestStatus,
    note: note?.trim() || null,
  });
  revalidatePath("/app/privacidade");
}
