"use server";

import { revalidatePath } from "next/cache";
import { getMyStudio, updateMyStudio } from "@/lib/data/studios";
import { studioProfileSchema } from "@/lib/validation";
import { onlyDigits } from "@/lib/validation";

export type SettingsFormState = { ok: false; error: string } | { ok: true } | null;

/** Campo de texto vazio vira NULL; string vazia poluiria o banco e a tela. */
function nullIfBlank(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

export async function saveStudioProfileAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  const parsed = studioProfileSchema.safeParse({
    owner_name: String(formData.get("owner_name") ?? ""),
    salon_name: String(formData.get("salon_name") ?? ""),
    owner_cpf: String(formData.get("owner_cpf") ?? ""),
    owner_birth_date: String(formData.get("owner_birth_date") ?? ""),
    acquired_at: String(formData.get("acquired_at") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    await updateMyStudio(studio.id, {
      name: parsed.data.salon_name,
      owner_name: nullIfBlank(parsed.data.owner_name),
      // A check constraint `studios_owner_cpf_format` exige 11 dígitos crus,
      // então a máscara digitada na tela é removida antes de gravar.
      owner_cpf: parsed.data.owner_cpf ? onlyDigits(parsed.data.owner_cpf) : null,
      owner_birth_date: nullIfBlank(parsed.data.owner_birth_date),
      acquired_at: nullIfBlank(parsed.data.acquired_at),
    });

    revalidatePath("/app/settings");
    revalidatePath("/app/account");
    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Não foi possível salvar. Tente novamente." };
  }
}
