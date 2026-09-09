import "server-only";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseServiceConfigured } from "@/lib/supabase/env";
import type {
  DataRequestKind,
  DataRequestStatus,
  DataSubjectRequest,
} from "@/lib/types";

/**
 * Solicitações do titular (tabela `data_subject_requests`, migração 0016).
 *
 * Escrita pela service role key, como todo caminho público do sistema — a
 * página pública não tem policy de escrita anônima. Ver a nota de RLS em
 * 0016_data_subject_requests.sql.
 */

/** Rótulos exibidos, na ordem em que aparecem no formulário. */
export const DATA_REQUEST_LABELS: Record<DataRequestKind, string> = {
  acesso: "Quero saber quais dados vocês têm sobre mim",
  correcao: "Quero corrigir um dado errado",
  exclusao: "Quero que meus dados sejam excluídos",
  oposicao: "Não quero mais receber mensagens",
};

export const DATA_REQUEST_ORDER: DataRequestKind[] = [
  "acesso",
  "correcao",
  "exclusao",
  "oposicao",
];

export type CreateDataRequestInput = {
  studioId: string;
  kind: DataRequestKind;
  clientName: string;
  clientPhone: string;
  message?: string;
};

export type CreateDataRequestResult =
  | { ok: true }
  | { ok: false; error: "sem_banco" | "falhou" };

export async function createDataSubjectRequest(
  input: CreateDataRequestInput
): Promise<CreateDataRequestResult> {
  if (!isSupabaseServiceConfigured) return { ok: false, error: "sem_banco" };

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { error } = await supabase.from("data_subject_requests").insert({
      studio_id: input.studioId,
      kind: input.kind,
      client_name: input.clientName,
      client_phone: input.clientPhone,
      message: input.message || null,
    });
    if (error) throw error;
    return { ok: true };
  } catch (cause) {
    console.error("[data-requests/create]", cause);
    return { ok: false, error: "falhou" };
  }
}

/**
 * A fila do estúdio. Sem paginação de propósito: uma conta que acumular
 * centenas de solicitações abertas tem um problema de processo, não de
 * interface, e o limite deixa isso visível em vez de esconder.
 */
export async function listDataSubjectRequests(
  studioId: string
): Promise<DataSubjectRequest[]> {
  if (!isSupabaseServiceConfigured) return [];

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("data_subject_requests")
    .select("*")
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

/**
 * Fecha uma solicitação. Escreve pela service role e confere o `studio_id` na
 * própria consulta — a página que chama isto já resolveu o estúdio do dono
 * logado, mas amarrar o filtro aqui é o que impede que um id vindo do
 * formulário aponte para outra conta.
 */
export async function resolveDataSubjectRequest(input: {
  id: string;
  studioId: string;
  status: DataRequestStatus;
  note: string | null;
}): Promise<boolean> {
  if (!isSupabaseServiceConfigured) return false;

  const encerrada = input.status === "concluida" || input.status === "recusada";
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("data_subject_requests")
    .update({
      status: input.status,
      resolution_note: input.note,
      resolved_at: encerrada ? new Date().toISOString() : null,
    })
    .eq("id", input.id)
    .eq("studio_id", input.studioId);
  if (error) {
    console.error("[data-requests/resolve]", error);
    return false;
  }
  return true;
}
