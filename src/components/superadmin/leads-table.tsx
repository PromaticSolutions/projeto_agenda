import { Mail, MessageCircle } from "lucide-react";
import {
  LEAD_AGENDA_TOOLS,
  LEAD_HOURS_BANDS,
  LEAD_PAIN_POINTS,
  LEAD_PROFESSIONS,
  LEAD_TEAM_SIZES,
  LEAD_WEEKLY_VOLUMES,
  LEAD_WHATSAPP_RELIANCE,
  leadLabel,
} from "@/lib/validation";
import { formatFullDateLocal, formatPhoneDisplay, formatTimeLocal } from "@/lib/format";
import type { MarketResearchLead } from "@/lib/types";

/**
 * Os leads da landing, um por linha.
 *
 * Tabela, e não cards: a pergunta aqui é de varredura ("quem entrou hoje? de
 * que profissão? já tem telefone para chamar?"), e varredura se faz em coluna
 * alinhada. O contexto opcional — o que a pessoa respondeu depois de converter
 * — fica numa segunda linha da mesma célula em vez de virar seis colunas quase
 * sempre vazias.
 *
 * Os links de WhatsApp e e-mail existem porque é o que se faz com um lead
 * cinco segundos depois de vê-lo. Copiar número da tela para o celular é o
 * tipo de trabalho que a ferramenta deveria poupar.
 */
export function LeadsTable({ leads }: { leads: MarketResearchLead[] }) {
  if (leads.length === 0) {
    return (
      <p className="panel border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum lead ainda. Quem preencher o formulário da página inicial aparece aqui.
      </p>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Quem</th>
              <th className="px-4 py-2.5 font-medium">Contato</th>
              <th className="px-4 py-2.5 font-medium">O que respondeu</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Chegou em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leads.map((lead) => (
              <tr key={lead.id} className="align-top transition-colors hover:bg-muted/50">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {leadLabel(LEAD_PROFESSIONS, lead.profession)}
                    {lead.business_name && ` · ${lead.business_name}`}
                  </p>
                  {lead.utm?.utm_source && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Origem: {lead.utm.utm_source}
                      {lead.utm.utm_campaign && ` / ${lead.utm.utm_campaign}`}
                    </p>
                  )}
                </td>

                <td className="px-4 py-3">
                  <a
                    href={`https://wa.me/${lead.phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    <MessageCircle className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
                    {formatPhoneDisplay(lead.phone)}
                  </a>
                  {lead.email && (
                    <a
                      href={`mailto:${lead.email}`}
                      className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      <Mail className="size-3.5 shrink-0" aria-hidden />
                      {lead.email}
                    </a>
                  )}
                </td>

                <td className="px-4 py-3">
                  <Respostas lead={lead} />
                </td>

                <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                  {formatFullDateLocal(new Date(lead.created_at))}
                  <span className="block">{formatTimeLocal(new Date(lead.created_at))}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * O contexto que a pessoa respondeu, se respondeu.
 *
 * Campo vazio é OMITIDO, não impresso como "—": o contexto é opcional por
 * desenho (0014), e uma coluna com seis travessões em toda linha esconderia as
 * duas respostas que existem.
 */
function Respostas({ lead }: { lead: MarketResearchLead }) {
  const itens: string[] = [];

  if (lead.hours_lost_band) {
    itens.push(`Perde ${leadLabel(LEAD_HOURS_BANDS, lead.hours_lost_band)}`);
  }
  if (lead.team_size) itens.push(leadLabel(LEAD_TEAM_SIZES, lead.team_size));
  if (lead.weekly_volume) {
    itens.push(`${leadLabel(LEAD_WEEKLY_VOLUMES, lead.weekly_volume)}/semana`);
  }
  if (lead.agenda_tools.length > 0) {
    itens.push(lead.agenda_tools.map((v) => leadLabel(LEAD_AGENDA_TOOLS, v)).join(", "));
  }
  if (lead.pain_points.length > 0) {
    itens.push(lead.pain_points.map((v) => leadLabel(LEAD_PAIN_POINTS, v)).join(", "));
  }
  if (lead.whatsapp_reliance) {
    itens.push(leadLabel(LEAD_WHATSAPP_RELIANCE, lead.whatsapp_reliance));
  }

  if (itens.length === 0 && !lead.improvement_wish) {
    return <span className="text-xs text-muted-foreground">Só a captura.</span>;
  }

  return (
    <div className="max-w-md space-y-1">
      {itens.length > 0 && <p className="text-xs text-muted-foreground">{itens.join(" · ")}</p>}
      {lead.improvement_wish && (
        <p className="text-sm text-foreground">“{lead.improvement_wish}”</p>
      )}
    </div>
  );
}
