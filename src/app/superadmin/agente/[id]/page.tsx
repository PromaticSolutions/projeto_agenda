import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { getStudioAdmin } from "@/lib/data/platformMetrics";
import { getWhatsAppConnection } from "@/lib/data/whatsapp";
import { getAgentConfig, isAgentSchemaReady, listRecentRuns } from "@/lib/agent/data";
import { isIntegrationsSchemaReady, listIntegrations } from "@/lib/agent/integrations";
import { AgentToggle } from "@/components/superadmin/agent-toggle";
import { AgentConfigForm } from "@/components/superadmin/agent-config-form";
import { AgentSimulator } from "@/components/superadmin/agent-simulator";
import { MigrationNotice } from "@/components/superadmin/migration-notice";
import { formatFullDateLocal, formatTimeLocal } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AgentRunStatus } from "@/lib/supabase/types";

interface AgentPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Agente IA — Timely Admin" };

const RUN_STATUS: Record<AgentRunStatus, { texto: string; classe: string }> = {
  respondeu: { texto: "Respondeu", classe: "bg-emerald-500/10 text-emerald-700" },
  humano: { texto: "Passou para a equipe", classe: "bg-amber-500/10 text-amber-700" },
  pausado: { texto: "Em pausa (equipe)", classe: "bg-muted text-muted-foreground" },
  limite: { texto: "Teto do dia", classe: "bg-amber-500/10 text-amber-700" },
  erro: { texto: "Erro", classe: "bg-destructive/10 text-destructive" },
  simulacao: { texto: "Teste", classe: "bg-primary/10 text-primary" },
};

/** Configuração do agente de IA de um cliente, com teste e histórico. */
export default async function SuperAdminAgentDetailPage({ params }: AgentPageProps) {
  const { id } = await params;
  const studio = await getStudioAdmin(id);
  if (!studio) notFound();

  const [agentReady, integrationsReady] = await Promise.all([isAgentSchemaReady(), isIntegrationsSchemaReady()]);
  const ready = agentReady && integrationsReady;
  const [agent, connection, runs, integrations] = await Promise.all([
    ready ? getAgentConfig(id) : null,
    getWhatsAppConnection(id),
    ready ? listRecentRuns(id, 30) : [],
    ready ? listIntegrations() : [],
  ]);
  const connected = connection.status === "conectado";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Link
        href="/superadmin/agente"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Todos os clientes
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Agente IA · {studio.name}</h1>
          <p className="text-sm text-muted-foreground">
            Responde o WhatsApp de /{studio.slug}. Ligado, começa nas próximas mensagens.
          </p>
        </div>
        {ready && <AgentToggle studioId={id} enabled={agent?.enabled ?? false} />}
      </header>

      {!agentReady && <MigrationNotice migration="0026_ai_agent.sql" feature="O agente de IA" />}
      {agentReady && !integrationsReady && (
        <MigrationNotice migration="0027_ai_integrations.sql" feature="As integrações de IA" />
      )}

      {ready && !connected && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          O WhatsApp deste estúdio não está conectado. O agente só responde depois que o dono
          conectar o número em /app/whatsapp.
        </p>
      )}

      {ready && (
        <>
          <AgentConfigForm
            studioId={id}
            integrations={integrations.map((i) => ({
              id: i.id,
              name: i.name,
              provider: i.provider,
              last4: i.api_key_last4,
              models: i.models,
            }))}
            initial={{
              integrationId: agent?.integration_id ?? null,
              model: agent?.integration_id ? agent.model : null,
              transcriptionIntegrationId: agent?.transcription_integration_id ?? null,
              transcriptionModel: agent?.transcription_model ?? null,
              assistantName: agent?.assistant_name ?? null,
              tone: agent?.tone ?? "acolhedor",
              instructions: agent?.instructions ?? null,
              canBook: agent?.can_book ?? true,
              handoffHours: agent?.handoff_hours ?? 6,
              maxRepliesPerDay: agent?.max_replies_per_day ?? 300,
            }}
          />

          <AgentSimulator studioId={id} />

          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-medium text-foreground">Últimas ações</h2>
              <p className="text-xs text-muted-foreground">
                Cada vez que o agente respondeu, ficou quieto ou falhou — e por quê.
              </p>
            </div>
            {runs.length === 0 ? (
              <p className="panel border-dashed p-8 text-center text-sm text-muted-foreground">
                Nada ainda. Quando uma cliente mandar mensagem com o agente ligado, aparece aqui.
              </p>
            ) : (
              <div className="panel overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[44rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Quando</th>
                        <th className="px-4 py-2.5 font-medium">Situação</th>
                        <th className="px-4 py-2.5 font-medium">Resposta ou motivo</th>
                        <th className="px-4 py-2.5 font-medium text-right">Tempo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {runs.map((run) => {
                        const at = new Date(run.created_at);
                        const status = RUN_STATUS[run.status];
                        return (
                          <tr key={run.id} className="align-top">
                            <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted-foreground">
                              {formatFullDateLocal(at)} {formatTimeLocal(at)}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", status.classe)}>
                                {status.texto}
                              </span>
                              {run.tools_used.length > 0 && (
                                <span className="mt-1 block text-[11px] text-muted-foreground">
                                  {run.tools_used.join(", ")}
                                </span>
                              )}
                            </td>
                            <td className="max-w-md px-4 py-2.5">
                              {run.reply && <p className="line-clamp-3 whitespace-pre-wrap text-foreground">{run.reply}</p>}
                              {run.detail && <p className="text-xs text-muted-foreground">{run.detail}</p>}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                              {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
