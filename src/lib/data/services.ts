import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  mockCreateService,
  mockDeleteService,
  mockGetService,
  mockListServices,
  mockUpdateService,
} from "@/lib/mock/store";
import { removeAttachmentObjects, signAttachmentUrls } from "@/lib/data/storage";
import { planAttachmentSync } from "@/lib/service-attachments";
import type { ServiceAttachmentItem } from "@/lib/validation";
import type { Service, ServiceWithAttachments } from "@/lib/types";

export interface ServiceInput {
  studio_id: string;
  name: string;
  price_cents: number;
  duration_min: number;
  color: string;
  active: boolean;
  /** Observações internas, opcional. Não aparece na página pública. */
  notes?: string | null;
}

/** Lista completa (ativos + inativos) para a tela de CRUD do dono. */
export async function listMyServices(studioId: string): Promise<Service[]> {
  if (!isSupabaseConfigured) return mockListServices(studioId);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("studio_id", studioId)
    .is("archived_at", null)
    .order("name");
  if (error) throw error;
  return data;
}

/**
 * A lista da tela de Serviços, com fotos e anexos. Separada de
 * `listMyServices` porque as outras telas (agenda, clientes, PDF) só precisam
 * do nome e da cor — não vale gerar URL assinada para elas.
 */
export async function listMyServicesWithAttachments(
  studioId: string
): Promise<ServiceWithAttachments[]> {
  const services = await listMyServices(studioId);
  if (!isSupabaseConfigured || services.length === 0) {
    return services.map((s) => ({ ...s, attachments: [] }));
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("service_attachments")
    .select("id, service_id, storage_path, file_name, mime_type, size_bytes")
    .eq("studio_id", studioId)
    .order("created_at");
  if (error) throw error;

  const urls = await signAttachmentUrls(data.map((a) => a.storage_path));
  const byService = new Map<string, ServiceWithAttachments["attachments"]>();
  data.forEach(({ service_id, ...attachment }, i) => {
    const list = byService.get(service_id) ?? [];
    list.push({ ...attachment, url: urls[i] });
    byService.set(service_id, list);
  });

  return services.map((s) => ({ ...s, attachments: byService.get(s.id) ?? [] }));
}

/**
 * Deixa os anexos do serviço iguais à lista que o formulário mandou no Salvar:
 * liga os arquivos recém-enviados e apaga os que o dono tirou.
 */
export async function syncServiceAttachments(
  studioId: string,
  serviceId: string,
  desired: ServiceAttachmentItem[]
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const supabase = await createServerSupabaseClient();
  const { data: existing, error } = await supabase
    .from("service_attachments")
    .select("id, storage_path")
    .eq("service_id", serviceId)
    .eq("studio_id", studioId);
  if (error) throw error;

  const plan = planAttachmentSync(studioId, existing, desired);

  if (plan.toInsert.length > 0) {
    const { error: insertError } = await supabase.from("service_attachments").insert(
      plan.toInsert.map((a) => ({ ...a, studio_id: studioId, service_id: serviceId }))
    );
    if (insertError) throw insertError;
  }

  if (plan.toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("service_attachments")
      .delete()
      .in("id", plan.toDelete.map((a) => a.id));
    if (deleteError) throw deleteError;
    await removeAttachmentObjects(plan.toDelete.map((a) => a.storage_path));
  }
}

export async function createService(input: ServiceInput): Promise<Service> {
  if (!isSupabaseConfigured) return mockCreateService(input);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("services").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateService(id: string, patch: Partial<ServiceInput>): Promise<Service> {
  if (!isSupabaseConfigured) return mockUpdateService(id, patch);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("services")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Como o serviço saiu da lista: apagado de fato ou preservado como histórico. */
export type DeleteServiceMode = "deleted" | "archived";

/**
 * Exclusão em dois regimes.
 *
 * `bookings.service_id` é `on delete restrict` (0001_init.sql) de propósito:
 * apagar um serviço não pode apagar o histórico financeiro nem deixar
 * agendamento órfão. Então um DELETE direto estoura 23503 para qualquer
 * serviço que já tenha sido agendado — que era exatamente o bug da tela.
 *
 * - serviço sem nenhum booking -> DELETE real, a linha some;
 * - serviço com bookings       -> arquivamento, sai de todas as listas mas o
 *                                 histórico continua íntegro.
 */
export async function deleteService(id: string): Promise<DeleteServiceMode> {
  if (!isSupabaseConfigured) return mockDeleteService(id);

  const supabase = await createServerSupabaseClient();
  // Os caminhos precisam ser lidos ANTES: o delete leva as linhas de anexo
  // junto (on delete cascade) e o bucket não é alcançado pelo Postgres.
  const { data: attachments } = await supabase
    .from("service_attachments")
    .select("storage_path")
    .eq("service_id", id);

  const { error } = await supabase.from("services").delete().eq("id", id);
  if (!error) {
    await removeAttachmentObjects((attachments ?? []).map((a) => a.storage_path));
    return "deleted";
  }

  if ((error as { code?: string }).code !== "23503") throw error;

  const { error: archiveError } = await supabase
    .from("services")
    .update({ archived_at: new Date().toISOString(), active: false })
    .eq("id", id);
  if (archiveError) throw archiveError;
  return "archived";
}

/** Só serviços ativos — página pública /[slug]. */
export async function listPublicServices(studioId: string): Promise<Service[]> {
  if (!isSupabaseConfigured) return mockListServices(studioId, { activeOnly: true });

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("studio_id", studioId)
    .eq("active", true)
    .is("archived_at", null)
    .order("name");
  if (error) throw error;
  return data;
}

/** Usado na revalidação server-side do booking: precisa achar mesmo um serviço já desativado no meio-tempo. */
export async function getPublicService(studioId: string, serviceId: string): Promise<Service | null> {
  if (!isSupabaseConfigured) {
    const service = mockGetService(serviceId);
    return service && service.studio_id === studioId ? service : null;
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Serviços de vários estúdios — o disparador precisa do NOME para a mensagem. */
export async function listServicesByStudioIds(studioIds: string[]): Promise<Service[]> {
  if (studioIds.length === 0) return [];
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("services").select("*").in("studio_id", studioIds);
  if (error) throw error;
  return data ?? [];
}
