import Link from "next/link";
import { Bot, ChevronRight } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { listWhatsAppConnectionsByStudioIds } from "@/lib/data/whatsapp";
import { isAgentSchemaReady, listAgentConfigs, summarizeAgentsToday } from "@/lib/agent/data";
import { AGENT_PROVIDERS } from "@/lib/agent/providers";
import { listIntegrations } from "@/lib/agent/integrations";
import { AgentToggle } from "@/components/superadmin/agent-toggle";
import { MigrationNotice } from "@/components/superadmin/migration-notice";
import { formatTimeLocal } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Agente IA — Timely Admin" };

/**
 * Agente de IA do WhatsApp, cliente a cliente.
 *
 * A lista responde "em quem está ligado e está funcionando?": o interruptor
 * liga na hora, e a linha mostra o que pode impedir o agente de responder —
 * WhatsApp desconectado, IA sem chave, erro hoje.
 */
export default async function SuperAdminAgentPage() {
  const ready = await isAgentSchemaReady();

  const supabase = createServiceRoleSupabaseClient();
  const { data: studios, error } = await supabase
    .from("studios")
    .select("id, name, slug")
    .order("name");
  if (error) throw error;

  const ids = (studios ?? []).map((s) => s.id);
  const [configs, summaries, connections, integrations] = await Promise.all([
    listAgentConfigs(),
    summarizeAgentsToday(),
    listWhatsAppConnectionsByStudioIds(ids),
    listIntegrations(),
  ]);
  const integrationById = new Map(integrations.map((i) => [i.id, i]));
  const connectionByStudio = new Map(connections.map((c) => [c.studio_id, c]));
  const activeCount = [...configs.values()].filter((c) => c.enabled).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="space-y-1 border-b border-border pb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Bot className="size-5 text-primary" aria-hidden /> Agente IA
        </h1>
        <p className="text-sm text-muted-foreground">
          A IA que responde o WhatsApp de cada estúdio. Ligou, começa a responder as próximas
          mensagens. Clique no cliente para escolher a IA e o jeito de falar.
        </p>
      </header>

      {!ready && <MigrationNotice migration="0026_ai_agent.sql" feature="O agente de IA" />}

      <p className="text-xs text-muted-foreground">
        {activeCount} de {ids.length} {ids.length === 1 ? "cliente" : "clientes"} com o agente ligado
      </p>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 font-medium">Agente</th>
                <th className="px-4 py-2.5 font-medium">IA</th>
                <th className="px-4 py-2.5 font-medium">WhatsApp</th>
                <th className="px-4 py-2.5 font-medium text-right">Respostas hoje</th>
                <th className="px-4 py-2.5 font-medium">Último erro hoje</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(studios ?? []).map((studio) => {
                const config = configs.get(studio.id);
                const summary = summaries.get(studio.id);
                const connection = connectionByStudio.get(studio.id);
                const connected = connection?.status === "conectado";
                const href = `/superadmin/agente/${studio.id}`;
                return (
                  <tr key={studio.id} className="transition-colors hover:bg-muted/50">
                    <td className="px-4 py-2.5">
                      <Link href={href} className="block">
                        <p className="font-medium text-foreground">{studio.name}</p>
                        <p className="text-xs text-muted-foreground">/{studio.slug}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      {ready ? (
                        <AgentToggle studioId={studio.id} enabled={config?.enabled ?? false} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {config?.model && (config.integration_id ? integrationById.has(config.integration_id) : config.api_key_last4) ? (
                        <>
                          <p className="text-foreground">
                            {config.integration_id
                              ? integrationById.get(config.integration_id)!.name
                              : AGENT_PROVIDERS[config.provider].label}
                          </p>
                          <p className="text-xs text-muted-foreground">{config.model}</p>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">não configurada</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          connected ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {connected ? "Conectado" : "Desconectado"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      {summary?.repliesToday ?? 0}
                    </td>
                    <td className="max-w-64 px-4 py-2.5">
                      {summary?.lastError ? (
                        <p className="truncate text-xs text-destructive" title={summary.lastError.detail ?? undefined}>
                          {formatTimeLocal(new Date(summary.lastError.at))} · {summary.lastError.detail}
                        </p>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={href}
                        title="Configurar"
                        className="inline-flex rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <ChevronRight className="size-4" />
                        <span className="sr-only">Configurar o agente de {studio.name}</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
