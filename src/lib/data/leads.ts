import "server-only";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseServiceConfigured } from "@/lib/supabase/env";
import { leadNotifyTarget } from "@/lib/data/platform-whatsapp";
import {
  LEAD_AGENDA_TOOLS,
  LEAD_HOURS_BANDS,
  LEAD_PAIN_POINTS,
  LEAD_PROFESSIONS,
  LEAD_TEAM_SIZES,
  LEAD_WEEKLY_VOLUMES,
  LEAD_WHATSAPP_RELIANCE,
  leadLabel,
  type LeadCapture,
  type LeadContext,
} from "@/lib/validation";
import type { MarketResearchLead, MessageOutboxKind } from "@/lib/types";

/**
 * Leads da landing.
 *
 * O fluxo tem dois momentos, e a separação é o ponto: a CAPTURA grava os
 * cinco campos do formulário e dispara o aviso; o CONTEXTO acrescenta o que a
 * pessoa quiser responder depois, sem travar nada. Quem fecha a página entre
 * um e outro já é um lead completo.
 *
 * Sempre service_role: a tabela não tem policy de RLS (ver 0013), então não
 * existe caminho de escrita a partir do navegador.
 */

/**
 * Destino do aviso de lead vindo do AMBIENTE.
 *
 * Continua existindo como fallback e para quem prefere fixar em variável, mas
 * a fonte preferida agora é a tabela `platform_whatsapp` (migração 0017),
 * configurada em /superadmin/whatsapp. O motivo é simples: variável de
 * ambiente exige redeploy para mudar um número, e obriga alguém a descobrir o
 * UUID de um estúdio para preencher o remetente — que nem é mais o desenho,
 * já que o remetente virou a instância da plataforma.
 */
export const leadsNotifyPhone = process.env.LEADS_NOTIFY_PHONE?.replace(/\D/g, "") || null;
export const leadsNotifyStudioId = process.env.LEADS_NOTIFY_STUDIO_ID?.trim() || null;

export type LeadSaveResult =
  | { ok: true; lead: MarketResearchLead; duplicate: false }
  | { ok: true; lead: null; duplicate: true }
  | { ok: false; error: string };

/**
 * Grava a captura, ignorando quem já se cadastrou.
 *
 * O índice único em `phone` (0013) decide o que é repetição, e
 * `ignoreDuplicates` traduz para `ON CONFLICT DO NOTHING`. Sem isso, um
 * segundo clique no botão geraria dois leads e dois avisos no WhatsApp — e o
 * segundo chegaria sem nada de novo para dizer.
 */
export async function saveLead(input: LeadCapture): Promise<LeadSaveResult> {
  if (!isSupabaseServiceConfigured) {
    return { ok: false, error: "Banco não configurado neste ambiente" };
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("market_research_leads")
    .upsert(
      {
        name: input.name,
        business_name: input.business_name ? input.business_name : null,
        profession: input.profession,
        phone: input.phone,
        email: input.email,
        hours_lost_band: input.hours_lost_band ?? null,
        team_size: input.team_size ?? null,
        agenda_tools: input.agenda_tools ?? [],
        pain_points: input.pain_points ?? [],
        weekly_volume: input.weekly_volume ?? null,
        whatsapp_reliance: input.whatsapp_reliance ?? null,
        improvement_wish: input.improvement_wish || null,
        // Aceite de tratamento de dados, com carimbo de hora: guardar só um
        // booleano não responde "quando ela aceitou?", que é a pergunta que
        // aparece quando o consentimento é questionado.
        privacy_accepted_at: new Date().toISOString(),
        // Aceitar o uso dos dados não é o mesmo que autorizar abordagem. Quem
        // preenche este formulário está PEDINDO contato — daí o true — mas os
        // dois campos seguem separados na base.
        contact_allowed: true,
        source: "landing",
        utm: input.utm && Object.keys(input.utm).length > 0 ? input.utm : null,
      },
      { onConflict: "phone", ignoreDuplicates: true }
    )
    .select("*")
    .maybeSingle();

  if (error) throw error;
  // `maybeSingle` devolve null quando o conflito foi ignorado: o telefone já
  // se cadastrou. Para quem preencheu é sucesso — os dados dela estão lá.
  if (!data) return { ok: true, lead: null, duplicate: true };
  return { ok: true, lead: data, duplicate: false };
}

/**
 * Acrescenta o contexto respondido depois do envio.
 *
 * Só grava o que veio: um campo ausente não vira `null` na base, senão
 * responder uma pergunta apagaria a resposta de outra. O lead é identificado
 * pelo UUID devolvido na captura — não há como listar ou varrer leads por
 * aqui, só completar um cujo identificador já se tem.
 */
type LeadContextPatch = Pick<
  Partial<MarketResearchLead>,
  "team_size" | "weekly_volume" | "whatsapp_reliance" | "agenda_tools" | "pain_points" | "improvement_wish"
>;

export async function updateLeadContext(input: LeadContext): Promise<MarketResearchLead | null> {
  // Montado campo a campo, e não por laço sobre as chaves, para o patch ficar
  // TIPADO contra o schema: um laço devolveria Record<string, unknown> e o
  // cliente aceitaria qualquer coluna inventada.
  const patch: LeadContextPatch = {};
  if (input.team_size) patch.team_size = input.team_size;
  if (input.weekly_volume) patch.weekly_volume = input.weekly_volume;
  if (input.whatsapp_reliance) patch.whatsapp_reliance = input.whatsapp_reliance;
  if (input.agenda_tools?.length) patch.agenda_tools = input.agenda_tools;
  if (input.pain_points?.length) patch.pain_points = input.pain_points;
  if (input.improvement_wish) patch.improvement_wish = input.improvement_wish;

  // Nenhum campo respondido: não há o que gravar, e um update vazio só
  // gastaria uma ida ao banco.
  if (Object.keys(patch).length === 0) return null;

  const { id } = input;

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("market_research_leads")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Linha do resumo, omitida quando não há resposta. */
function line(label: string, value: string | null | undefined): string[] {
  return value ? [`*${label}:* ${value}`] : [];
}

/**
 * Resumo do lead, do jeito que chega no WhatsApp.
 *
 * Traduz os `value` gravados para os rótulos que a pessoa viu na tela: um
 * aviso dizendo `nail_designer` obrigaria a consultar o código para ser lido,
 * o que anula o propósito de ser um aviso.
 *
 * Campo sem resposta é OMITIDO, não impresso como "(não respondeu)": o resumo
 * agora chega no primeiro envio, quando quase tudo do contexto está vazio, e
 * uma lista de dez "não respondeu" enterraria os cinco dados que importam.
 */
export function buildLeadSummary(lead: MarketResearchLead): string {
  const linhas = [
    "*NOVO LEAD — TIMELY*",
    "",
    `*Nome:* ${lead.name}`,
    ...line("Negócio", lead.business_name),
    ...line("Profissão", leadLabel(LEAD_PROFESSIONS, lead.profession)),
    `*WhatsApp:* ${lead.phone}`,
    ...line("E-mail", lead.email),
    ...line("Instagram", lead.instagram ? `@${lead.instagram}` : null),
    ...line(
      "Tempo perdido por semana",
      lead.hours_lost_band ? leadLabel(LEAD_HOURS_BANDS, lead.hours_lost_band) : null
    ),
  ];

  // O contexto só aparece se a pessoa respondeu as perguntas opcionais.
  const contexto = [
    ...line("Modelo", lead.team_size ? leadLabel(LEAD_TEAM_SIZES, lead.team_size) : null),
    ...line(
      "Atendimentos/semana",
      lead.weekly_volume ? leadLabel(LEAD_WEEKLY_VOLUMES, lead.weekly_volume) : null
    ),
    ...line(
      "Como organiza a agenda",
      lead.agenda_tools.length
        ? lead.agenda_tools.map((v) => leadLabel(LEAD_AGENDA_TOOLS, v)).join(", ")
        : null
    ),
    ...line(
      "Principal dificuldade",
      lead.pain_points.length
        ? lead.pain_points.map((v) => leadLabel(LEAD_PAIN_POINTS, v)).join(", ")
        : null
    ),
    ...line(
      "Uso do WhatsApp",
      lead.whatsapp_reliance ? leadLabel(LEAD_WHATSAPP_RELIANCE, lead.whatsapp_reliance) : null
    ),
    ...line("O que gostaria de melhorar", lead.improvement_wish),
  ];

  if (contexto.length > 0) linhas.push("", ...contexto);
  return linhas.join("\n");
}

export type NotifyOutcome = "enfileirado" | "sem_configuracao" | "falhou";

/**
 * Enfileira o aviso do lead na fila que já existe.
 *
 * Enfileirar em vez de enviar na hora é a decisão que importa: se a Evolution
 * estiver fora do ar no momento em que o lead chega — justamente quando
 * ninguém está olhando —, um envio direto perderia o aviso. Na fila ele ganha
 * a retentativa, a contagem de tentativas e o histórico do disparador.
 *
 * Falhar aqui NUNCA derruba o envio do formulário: o lead já está gravado, e
 * é o dado que interessa. O aviso é conveniência.
 */
export async function enqueueLeadNotification(
  lead: MarketResearchLead
): Promise<NotifyOutcome> {
  /* Duas origens, nesta ordem: a configuração do superadmin primeiro, o
     ambiente como fallback. Quem já tinha as variáveis não perde o aviso; quem
     configurar pela tela não precisa mexer em deploy.

     `leadNotifyTarget()` só devolve número quando a sessão da plataforma está
     DE PÉ. Sem isso o aviso entraria na fila para ser adiado a cada rodada do
     disparador até expirar — barulho no log para um envio que nunca ia sair. */
  const alvoDaPlataforma = await leadNotifyTarget();

  const destino = alvoDaPlataforma ?? leadsNotifyPhone;
  // `studio_id` nulo = remetente é a instância da plataforma (0017). Só cai no
  // estúdio do ambiente quando é o fallback antigo que está no comando.
  const remetente = alvoDaPlataforma ? null : leadsNotifyStudioId;

  if (!destino) return "sem_configuracao";
  if (!alvoDaPlataforma && !remetente) return "sem_configuracao";

  try {
    const supabase = createServiceRoleSupabaseClient();
    const now = new Date().toISOString();
    const { error } = await supabase.from("message_outbox").insert({
      studio_id: remetente,
      booking_id: null,
      kind: "lead" as MessageOutboxKind,
      to_phone: destino,
      body: buildLeadSummary(lead),
      scheduled_for: now,
      status: "pendente",
      created_at: now,
      updated_at: now,
    });
    if (error) throw error;
    return "enfileirado";
  } catch (cause) {
    console.error("[leads/notify]", cause);
    return "falhou";
  }
}
