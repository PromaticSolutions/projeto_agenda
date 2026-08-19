import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mockGetReminderSettings, mockUpsertReminderSettings } from "@/lib/mock/store";
import type { ReminderSettings } from "@/lib/types";

/**
 * Espelha os DEFAULTs da migração 0008. A tabela só ganha linha quando o dono
 * salva pela primeira vez, então a tela precisa de algo coerente para exibir
 * antes disso — e esses valores têm que bater com o banco, senão a primeira
 * gravação "mudaria" configurações que o dono nunca tocou.
 */
export const REMINDER_DEFAULTS = {
  enabled: false,
  lead_time_minutes: 1440,
  message_template:
    "Olá {cliente}! Passando para confirmar seu horário de {servico} em {data} às {hora}. Até logo! — {salao}",
  include_link: false,
  link_url: null,
} as const;

export interface ReminderSettingsInput {
  enabled: boolean;
  lead_time_minutes: number;
  message_template: string;
  include_link: boolean;
  link_url: string | null;
}

export async function getReminderSettings(studioId: string): Promise<ReminderSettings> {
  if (!isSupabaseConfigured) return mockGetReminderSettings(studioId);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("reminder_settings")
    .select("*")
    .eq("studio_id", studioId)
    .maybeSingle();
  if (error) throw error;

  if (data) return data;
  return { studio_id: studioId, ...REMINDER_DEFAULTS, updated_at: new Date().toISOString() };
}

export async function upsertReminderSettings(
  studioId: string,
  input: ReminderSettingsInput
): Promise<ReminderSettings> {
  if (!isSupabaseConfigured) return mockUpsertReminderSettings(studioId, input);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("reminder_settings")
    .upsert(
      {
        studio_id: studioId,
        ...input,
        // A constraint `reminder_settings_link_required` recusa link vazio com
        // include_link ligado; normalizar aqui evita depender só do banco.
        link_url: input.include_link ? input.link_url : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "studio_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
