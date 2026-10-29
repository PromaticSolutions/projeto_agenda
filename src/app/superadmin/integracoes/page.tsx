import { Plug } from "lucide-react";
import {
  countIntegrationUsage,
  isIntegrationsSchemaReady,
  listIntegrations,
} from "@/lib/agent/integrations";
import { IntegrationsManager } from "@/components/superadmin/integrations-manager";
import { MigrationNotice } from "@/components/superadmin/migration-notice";

export const metadata = { title: "Integrações — Timely Admin" };

/**
 * As chaves de API de IA da plataforma. Cadastra uma vez, com apelido; o
 * agente de cada cliente escolhe daqui qual usar.
 */
export default async function SuperAdminIntegrationsPage() {
  const ready = await isIntegrationsSchemaReady();
  const [integrations, usage] = ready
    ? await Promise.all([listIntegrations(), countIntegrationUsage()])
    : [[], new Map<string, number>()];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <header className="space-y-1 border-b border-border pb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Plug className="size-5 text-primary" aria-hidden /> Integrações
        </h1>
        <p className="text-sm text-muted-foreground">
          As chaves de IA da plataforma. Pode ter várias — uma grátis para teste, uma paga para
          quem precisa de mais — e escolher qual cada cliente usa em Agente IA.
        </p>
      </header>

      {!ready ? (
        <MigrationNotice migration="0027_ai_integrations.sql" feature="As integrações de IA" />
      ) : (
        <IntegrationsManager
          integrations={integrations.map((i) => {
            const chat = i.models.filter((m) => m.kind === "chat");
            return {
              id: i.id,
              name: i.name,
              provider: i.provider,
              last4: i.api_key_last4,
              chatModels: chat.length,
              freeModels: chat.filter((m) => m.free).length,
              audioModels: i.models.filter((m) => m.kind === "audio").length,
              updatedAt: i.models_updated_at,
              lastError: i.last_error,
              usedBy: usage.get(i.id) ?? 0,
            };
          })}
        />
      )}
    </div>
  );
}
