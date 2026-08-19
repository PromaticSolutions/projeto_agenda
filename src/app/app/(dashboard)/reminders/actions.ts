"use server";

import { revalidatePath } from "next/cache";
import { getMyStudio } from "@/lib/data/studios";
import { upsertReminderSettings } from "@/lib/data/reminders";
import { reminderSettingsSchema } from "@/lib/validation";

export type ReminderFormState = { ok: false; error: string } | { ok: true } | null;

export async function saveReminderSettingsAction(
  _prevState: ReminderFormState,
  formData: FormData
): Promise<ReminderFormState> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  const includeLink = formData.get("include_link") === "on";
  const linkUrl = String(formData.get("link_url") ?? "").trim();

  const parsed = reminderSettingsSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    lead_time_minutes: Number(formData.get("lead_time_minutes") ?? 0),
    message_template: String(formData.get("message_template") ?? ""),
    include_link: includeLink,
    link_url: linkUrl,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    await upsertReminderSettings(studio.id, {
      enabled: parsed.data.enabled,
      lead_time_minutes: parsed.data.lead_time_minutes,
      message_template: parsed.data.message_template,
      include_link: parsed.data.include_link,
      // Link desligado grava NULL: guardar a string escondida faria a tela
      // reabrir com um valor que o dono acha que apagou.
      link_url: parsed.data.include_link ? (parsed.data.link_url ?? null) : null,
    });
    revalidatePath("/app/reminders");
    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Não foi possível salvar. Tente novamente." };
  }
}
