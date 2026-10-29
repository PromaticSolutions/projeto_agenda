"use server";

import { redirect } from "next/navigation";
import { checkPlatformAdmin } from "@/lib/data/platformAdmins";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";

export type EnterAccountState = { ok: false; error: string } | null;

/**
 * Entra no /app como o dono de um estúdio, NESTA janela.
 *
 * Gera um link mágico pela API admin (nenhum e-mail sai) e o consome aqui
 * mesmo com `verifyOtp`, que grava a sessão da pessoa nos cookies. A sessão do
 * admin é substituída, não encerrada: nada de `signOut`, cujo escopo padrão é
 * global e derrubaria o admin em todos os aparelhos. Para voltar ao
 * /superadmin é sair e entrar de novo com o próprio usuário.
 *
 * Server Action é endpoint público: a checagem de `platform_admins` aqui é a
 * barreira de verdade — sem ela, qualquer pessoa logada viraria qualquer outra
 * mandando um id de estúdio.
 */
export async function enterStudioAccountAction(
  _prev: EnterAccountState,
  formData: FormData
): Promise<EnterAccountState> {
  const check = await checkPlatformAdmin();
  if (check.status !== "ok") return { ok: false, error: "Acesso restrito." };

  const studioId = String(formData.get("studio_id") ?? "");
  if (!studioId) return { ok: false, error: "Estúdio não informado." };

  const service = createServiceRoleSupabaseClient();
  const { data: studio, error: studioError } = await service
    .from("studios")
    .select("id, name, owner_id")
    .eq("id", studioId)
    .maybeSingle();
  if (studioError) throw studioError;
  if (!studio) return { ok: false, error: "Estúdio não encontrado." };

  const { data: owner, error: ownerError } = await service.auth.admin.getUserById(studio.owner_id);
  if (ownerError || !owner.user.email) {
    return { ok: false, error: "A conta do dono não tem e-mail de login." };
  }

  const { data: link, error: linkError } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: owner.user.email,
  });
  if (linkError) {
    console.error("[superadmin/enter-account] generateLink", linkError);
    return { ok: false, error: "Não foi possível gerar o acesso." };
  }

  const supabase = await createServerSupabaseClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError) {
    console.error("[superadmin/enter-account] verifyOtp", verifyError);
    return { ok: false, error: "Não foi possível entrar na conta." };
  }

  // Rastro mínimo de quem entrou onde: entrar na conta de outra pessoa é o
  // tipo de ação que alguém vai perguntar depois.
  console.info(
    `[superadmin/enter-account] ${check.admin.email ?? check.admin.id} entrou como ${owner.user.email} (estúdio ${studio.id})`
  );

  redirect("/app");
}
