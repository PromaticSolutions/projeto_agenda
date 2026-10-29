"use client";

import { useState, useTransition } from "react";
import { Check, KeyRound, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGENT_PROVIDERS, AGENT_PROVIDER_ORDER, detectProviderFromKey } from "@/lib/agent/providers";
import {
  createIntegrationAction,
  deleteIntegrationAction,
  refreshIntegrationModelsAction,
  renameIntegrationAction,
  type IntegrationResult,
} from "@/app/superadmin/integracoes/actions";
import type { AgentProvider } from "@/lib/supabase/types";

/** O que a tela precisa de cada integração — sem a chave. */
export interface IntegrationSummary {
  id: string;
  name: string;
  provider: AgentProvider;
  last4: string;
  chatModels: number;
  freeModels: number;
  audioModels: number;
  updatedAt: string | null;
  lastError: string | null;
  usedBy: number;
}

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function Feedback({ result }: { result: IntegrationResult | null }) {
  if (!result) return null;
  return result.ok ? (
    <p className="text-sm text-emerald-700">{result.message}</p>
  ) : (
    <p className="text-sm text-destructive">{result.error}</p>
  );
}

export function IntegrationsManager({ integrations }: { integrations: IntegrationSummary[] }) {
  return (
    <div className="flex flex-col gap-6">
      <AddIntegration />
      {integrations.length === 0 ? (
        <p className="panel border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma integração ainda. Cole uma chave acima para começar.
        </p>
      ) : (
        <ul className="panel divide-y divide-border overflow-hidden">
          {integrations.map((integration) => (
            <IntegrationRow key={integration.id} integration={integration} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddIntegration() {
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<"auto" | AgentProvider>("auto");
  const [baseUrl, setBaseUrl] = useState("");
  const [result, setResult] = useState<IntegrationResult | null>(null);
  const [pending, startTransition] = useTransition();

  const detected = apiKey.trim() ? detectProviderFromKey(apiKey) : null;
  const showProvider = provider !== "auto" || (result && !result.ok && result.needsProvider);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const r = await createIntegrationAction({ name, apiKey, provider, baseUrl });
      setResult(r);
      if (r.ok) {
        setName("");
        setApiKey("");
        setProvider("auto");
        setBaseUrl("");
      }
    });
  }

  return (
    <form onSubmit={submit} className="panel flex flex-col gap-4 p-5">
      <div>
        <h2 className="flex items-center gap-2 font-medium text-foreground">
          <KeyRound className="size-4 text-primary" aria-hidden /> Conectar uma chave de API
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cole a chave: o provedor é reconhecido pelo começo dela e a lista de modelos é lida na
          hora. Depois, no agente de cada cliente, é só escolher.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="integration_name">Apelido</Label>
          <Input
            id="integration_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: OpenRouter da Promatic"
            className="h-9"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="integration_key">Chave de API</Label>
          <Input
            id="integration_key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-or-…, gsk_…, AIza…, sk-ant-…"
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            {apiKey.trim()
              ? detected
                ? `Parece uma chave de ${AGENT_PROVIDERS[detected].label}.`
                : "Não reconheci o provedor por esta chave — escolha abaixo."
              : "Gemini, Groq, OpenRouter, OpenAI, Anthropic ou uma API compatível."}
          </p>
        </div>

        {(showProvider || (apiKey.trim() && !detected)) && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="integration_provider">Provedor</Label>
            <select
              id="integration_provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as "auto" | AgentProvider)}
              className={SELECT_CLASS}
            >
              <option value="auto">Detectar pela chave</option>
              {AGENT_PROVIDER_ORDER.map((p) => (
                <option key={p} value={p}>
                  {AGENT_PROVIDERS[p].label}
                </option>
              ))}
            </select>
          </div>
        )}

        {provider === "custom" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="integration_base_url">Endereço da API</Label>
            <Input
              id="integration_base_url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://exemplo.com/v1"
              className="h-9"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !name.trim() || !apiKey.trim()}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Conectar
        </Button>
        <Feedback result={result} />
      </div>
    </form>
  );
}

function IntegrationRow({ integration }: { integration: IntegrationSummary }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(integration.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [result, setResult] = useState<IntegrationResult | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<IntegrationResult>, after?: (r: IntegrationResult) => void) {
    setResult(null);
    startTransition(async () => {
      const r = await action();
      setResult(r);
      after?.(r);
    });
  }

  const updated = integration.updatedAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(
        new Date(integration.updatedAt)
      )
    : null;

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {renaming ? (
            <div className="flex items-center gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-64" aria-label="Apelido" />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => renameIntegrationAction(integration.id, name), (r) => r.ok && setRenaming(false))}
              >
                <Check className="size-4" />
                <span className="sr-only">Salvar apelido</span>
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(false)}>
                <X className="size-4" />
                <span className="sr-only">Cancelar</span>
              </Button>
            </div>
          ) : (
            <p className="flex items-center gap-2 font-medium text-foreground">
              {integration.name}
              <button
                type="button"
                onClick={() => setRenaming(true)}
                className="text-muted-foreground hover:text-foreground"
                title="Renomear"
              >
                <Pencil className="size-3.5" />
                <span className="sr-only">Renomear {integration.name}</span>
              </button>
            </p>
          )}
          <p className="mt-0.5 text-sm text-muted-foreground">
            {AGENT_PROVIDERS[integration.provider].label} · chave terminando em {integration.last4}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {integration.chatModels} modelos de conversa
            {integration.freeModels > 0 && integration.freeModels < integration.chatModels
              ? ` (${integration.freeModels} grátis)`
              : ""}
            {integration.audioModels > 0 ? ` · ${integration.audioModels} de áudio` : ""}
            {updated ? ` · lista de ${updated}` : ""}
            {` · usada por ${integration.usedBy} ${integration.usedBy === 1 ? "cliente" : "clientes"}`}
          </p>
          {integration.lastError && <p className="mt-1 text-xs text-destructive">{integration.lastError}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => refreshIntegrationModelsAction(integration.id))}
          >
            <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} /> Atualizar modelos
          </Button>
          {confirmDelete ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() => run(() => deleteIntegrationAction(integration.id))}
              >
                Confirmar exclusão
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" /> Excluir
            </Button>
          )}
        </div>
      </div>
      {confirmDelete && integration.usedBy > 0 && (
        <p className="text-xs text-destructive">
          {integration.usedBy} {integration.usedBy === 1 ? "cliente usa" : "clientes usam"} esta
          integração. Excluindo, o agente {integration.usedBy === 1 ? "dele para" : "deles para"} de
          responder até escolher outra.
        </p>
      )}
      <Feedback result={result} />
    </li>
  );
}
