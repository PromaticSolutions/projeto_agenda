import "server-only";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseServiceConfigured } from "@/lib/supabase/env";
import { POLICY_VERSION } from "@/lib/consent";

/**
 * Gravação da prova de consentimento (tabela `consents`, migração 0015).
 *
 * Escreve com a service role key porque o fluxo público não tem — e não deve
 * ter — policy de escrita anônima: é o mesmo caminho por onde `bookings` é
 * criado. Ver a nota de RLS em 0015_consents.sql.
 */

export type RecordConsentInput = {
  studioId: string;
  bookingId: string;
  clientId: string | null;
  clientPhone: string;
  /** Best-effort, vindo de cabeçalho de proxy. Ver `clientIpFromRequest`. */
  ipAddress: string | null;
};

/** Resultado do registro, no mesmo espírito de `enqueueLeadNotification`. */
export type ConsentOutcome = "registrado" | "sem_banco" | "falhou";

/**
 * NÃO derruba o agendamento quando falha.
 *
 * A escolha é desconfortável e é deliberada. O agendamento já foi gravado
 * quando esta função roda — precisa ter sido, porque o registro se amarra ao
 * `booking_id` — e a constraint anti-colisão significa que desfazê-lo abriria o
 * horário que a pessoa acabou de garantir. Derrubar a resposta aqui faria a
 * cliente ver "não foi possível confirmar" para um horário que está reservado
 * no nome dela, e ela marcaria de novo.
 *
 * O consentimento em si continua tendo sido dado — o `privacyAccepted` é
 * validado no servidor ANTES de gravar o agendamento, então nada é criado sem
 * aceite. O que se perde numa falha aqui é a PROVA, não o ato. Por isso o
 * resultado volta na resposta da API e a falha vai para o log: é um problema
 * de conformidade que alguém precisa ver, não um erro para a cliente resolver.
 */
export async function recordBookingConsent(
  input: RecordConsentInput
): Promise<ConsentOutcome> {
  if (!isSupabaseServiceConfigured) return "sem_banco";

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { error } = await supabase.from("consents").insert({
      studio_id: input.studioId,
      booking_id: input.bookingId,
      client_id: input.clientId,
      client_phone: input.clientPhone,
      policy_version: POLICY_VERSION,
      consented_at: new Date().toISOString(),
      ip_address: input.ipAddress,
    });
    if (error) throw error;
    return "registrado";
  } catch (cause) {
    console.error("[consents/record]", cause);
    return "falhou";
  }
}

/**
 * IP de quem enviou, na melhor das hipóteses.
 *
 * Atrás de proxy o socket é o do proxy, então o valor útil está no cabeçalho —
 * que qualquer cliente pode forjar. Por isso o campo é nullable no banco e
 * ninguém decide nada com base nele: é indício complementar de um registro
 * cuja prova real é o conjunto (telefone, versão da política, data).
 */
export function clientIpFromRequest(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  // O primeiro da lista é o cliente original; os seguintes são proxies.
  const first = forwarded?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip")?.trim() || null;
}
