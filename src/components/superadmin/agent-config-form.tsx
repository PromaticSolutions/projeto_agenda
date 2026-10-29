"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Loader2, PlugZap, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AGENT_PROVIDERS, AGENT_TONES, canTranscribe } from "@/lib/agent/providers";
import {
  saveAgentConfigAction,
  testAgentConnectionAction,
  type AgentConfigInput,
  type ConnectionTestResult,
} from "@/app/superadmin/agente/actions";
import type { AgentProvider, AgentTone, IntegrationModel } from "@/lib/supabase/types";

/**
 * Configuração do agente de UM estúdio.
 *
 * A chave não mora aqui: escolhe-se uma integração cadastrada em
 * /superadmin/integracoes e um dos modelos que ela libera.
 */

export interface IntegrationOption {
  id: string;
  name: string;
  provider: AgentProvider;
  last4: string;
  models: IntegrationModel[];
}

export interface AgentFormInitial {
  integrationId: string | null;
  model: string | null;
  transcriptionIntegrationId: string | null;
  transcriptionModel: string | null;
  assistantName: string | null;
  tone: AgentTone;
  instructions: string | null;
  canBook: boolean;
  handoffHours: number;
  maxRepliesPerDay: number;
}

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

type Feedback = { ok: boolean; text: string } | null;

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p className={feedback.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{feedback.text}</p>
  );
}

function integrationLabel(i: IntegrationOption): string {
  return `${i.name} — ${AGENT_PROVIDERS[i.provider].label} (…${i.last4})`;
}

export function AgentConfigForm({
  studioId,
  initial,
  integrations,
}: {
  studioId: string;
  initial: AgentFormInitial;
  integrations: IntegrationOption[];
}) {
  const firstChatModel = (id: string | null) =>
    integrations.find((i) => i.id === id)?.models.find((m) => m.kind === "chat")?.id ?? "";

  const [integrationId, setIntegrationId] = useState(initial.integrationId ?? integrations[0]?.id ?? "");
  const [model, setModel] = useState(initial.model ?? firstChatModel(initial.integrationId ?? integrations[0]?.id ?? null));
  const [onlyFree, setOnlyFree] = useState(false);
  const [transcriptionIntegrationId, setTranscriptionIntegrationId] = useState(initial.transcriptionIntegrationId ?? "");
  const [transcriptionModel, setTranscriptionModel] = useState(initial.transcriptionModel ?? "");
  const [assistantName, setAssistantName] = useState(initial.assistantName ?? "");
  const [tone, setTone] = useState<AgentTone>(initial.tone);
  const [instructions, setInstructions] = useState(initial.instructions ?? "");
  const [canBook, setCanBook] = useState(initial.canBook);
  const [handoffHours, setHandoffHours] = useState(String(initial.handoffHours));
  const [maxReplies, setMaxReplies] = useState(String(initial.maxRepliesPerDay));

  const [saveFeedback, setSaveFeedback] = useState<Feedback>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [saving, startSaving] = useTransition();
  const [testing, startTesting] = useTransition();

  const integration = integrations.find((i) => i.id === integrationId) ?? null;
  const chatModels = useMemo(() => integration?.models.filter((m) => m.kind === "chat") ?? [], [integration]);
  const freeCount = chatModels.filter((m) => m.free).length;
  const visibleModels = onlyFree ? chatModels.filter((m) => m.free) : chatModels;
  const selectedModel = chatModels.find((m) => m.id === model);

  const audioIntegrations = integrations.filter((i) => canTranscribe(i.provider));
  const audioIntegration = integrations.find((i) => i.id === transcriptionIntegrationId) ?? null;
  const audioModels = audioIntegration?.models.filter((m) => m.kind === "audio") ?? [];

  function changeIntegration(id: string) {
    setIntegrationId(id);
    setModel(firstChatModel(id));
    setOnlyFree(false);
    setTestResult(null);
  }

  function changeAudioIntegration(id: string) {
    setTranscriptionIntegrationId(id);
    const models = integrations.find((i) => i.id === id)?.models.filter((m) => m.kind === "audio") ?? [];
    // Turbo primeiro: mais rápido e, no Groq, grátis.
    setTranscriptionModel(models.find((m) => m.id.includes("turbo"))?.id ?? models[0]?.id ?? "");
  }

  function currentInput(): AgentConfigInput {
    return {
      integrationId,
      model,
      transcriptionIntegrationId,
      transcriptionModel,
      assistantName,
      tone,
      instructions,
      canBook,
      handoffHours: Number(handoffHours),
      maxRepliesPerDay: Number(maxReplies),
    };
  }

  function save() {
    setSaveFeedback(null);
    const input = currentInput();
    startSaving(async () => {
      const result = await saveAgentConfigAction(studioId, input);
      setSaveFeedback(result.ok ? { ok: true, text: result.message ?? "Salvo." } : { ok: false, text: result.error });
    });
  }

  function test() {
    setTestResult(null);
    const input = currentInput();
    startTesting(async () => {
      setTestResult(await testAgentConnectionAction(studioId, input));
    });
  }

  if (integrations.length === 0) {
    return (
      <section className="panel flex flex-col items-start gap-3 p-5">
        <h2 className="font-medium text-foreground">Nenhuma integração de IA cadastrada</h2>
        <p className="text-sm text-muted-foreground">
          Conecte uma chave de API em Integrações (Gemini, Groq, OpenRouter, OpenAI ou Anthropic) e
          volte aqui para escolher qual este cliente usa.
        </p>
        <Button render={<Link href="/superadmin/integracoes" />}>Ir para Integrações</Button>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* --- IA --- */}
      <section className="panel flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium text-foreground">Modelo de IA</h2>
            <p className="mt-1 text-sm text-muted-foreground">Qual integração e qual modelo respondem as clientes.</p>
          </div>
          <Link href="/superadmin/integracoes" className="text-sm font-medium text-primary hover:underline">
            Gerenciar integrações
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="integration">Integração</Label>
            <select
              id="integration"
              value={integrationId}
              onChange={(e) => changeIntegration(e.target.value)}
              className={SELECT_CLASS}
            >
              {!integration && <option value="">Escolha…</option>}
              {integrations.map((i) => (
                <option key={i.id} value={i.id}>
                  {integrationLabel(i)}
                </option>
              ))}
            </select>
            {integration && <p className="text-xs text-muted-foreground">{AGENT_PROVIDERS[integration.provider].note}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="model">Modelo</Label>
              {freeCount > 0 && freeCount < chatModels.length && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={onlyFree}
                    onChange={(e) => setOnlyFree(e.target.checked)}
                    className="size-3.5 accent-[var(--primary)]"
                  />
                  Só os grátis ({freeCount})
                </label>
              )}
            </div>
            <select id="model" value={model} onChange={(e) => setModel(e.target.value)} className={SELECT_CLASS}>
              {!selectedModel && <option value={model}>{model || "Escolha…"}</option>}
              {visibleModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name !== m.id ? `${m.name} (${m.id})` : m.id}
                  {m.free && integration?.provider === "openrouter" ? " · grátis" : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {chatModels.length} modelos nesta integração. Faltou algum? Use “Atualizar modelos” em
              Integrações.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={test} disabled={testing || !integrationId || !model}>
            {testing ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
            Testar conexão
          </Button>
          <span className="text-xs text-muted-foreground">
            O agente de verdade responde uma cliente de teste com tudo o que está nesta tela — sem
            precisar salvar. Nada sai pelo WhatsApp.
          </span>
        </div>
        {testResult && <TestResultView result={testResult} />}
      </section>

      {/* --- Áudio --- */}
      <section className="panel flex flex-col gap-4 p-5">
        <div>
          <h2 className="font-medium text-foreground">Áudios</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Transcreve os áudios das clientes para a IA conseguir responder. Funciona com integração
            do Groq (grátis) ou da OpenAI.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="transcription_integration">Transcrição</Label>
            <select
              id="transcription_integration"
              value={transcriptionIntegrationId}
              onChange={(e) => changeAudioIntegration(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Desligada — pede para a cliente escrever</option>
              {audioIntegrations.map((i) => (
                <option key={i.id} value={i.id}>
                  {integrationLabel(i)}
                </option>
              ))}
            </select>
            {audioIntegrations.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhuma integração do Groq ou da OpenAI cadastrada ainda.
              </p>
            )}
          </div>

          {audioIntegration && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="transcription_model">Modelo de transcrição</Label>
              {audioModels.length > 0 ? (
                <select
                  id="transcription_model"
                  value={transcriptionModel}
                  onChange={(e) => setTranscriptionModel(e.target.value)}
                  className={SELECT_CLASS}
                >
                  {audioModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="transcription_model"
                  value={transcriptionModel}
                  onChange={(e) => setTranscriptionModel(e.target.value)}
                  placeholder="ex.: whisper-1"
                  className="h-9"
                />
              )}
            </div>
          )}
        </div>
      </section>

      {/* --- Comportamento --- */}
      <section className="panel flex flex-col gap-4 p-5">
        <div>
          <h2 className="font-medium text-foreground">Como o agente fala e age</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Serviços, preços e horários vêm do cadastro do estúdio — não precisa repetir aqui.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="assistant_name">Nome do assistente</Label>
            <Input
              id="assistant_name"
              value={assistantName}
              onChange={(e) => setAssistantName(e.target.value)}
              placeholder="Ex.: Bia, assistente do estúdio"
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tone">Tom de voz</Label>
            <select
              id="tone"
              value={tone}
              onChange={(e) => setTone(e.target.value as AgentTone)}
              className={SELECT_CLASS}
            >
              {(Object.keys(AGENT_TONES) as AgentTone[]).map((t) => (
                <option key={t} value={t}>
                  {AGENT_TONES[t].label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="instructions">Instruções do estúdio</Label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={6}
              placeholder={
                "Ex.:\n- Endereço: Rua das Flores, 123 — Centro.\n- Aceitamos Pix e cartão.\n- Não fazemos desconto.\n- Para alongamento, pedir para vir sem esmalte."
              }
            />
            <p className="text-xs text-muted-foreground">
              Tudo o que a IA precisa saber e não está no cadastro: endereço, pagamento, regras.
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={canBook}
              onChange={(e) => setCanBook(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--primary)]"
            />
            <span>
              <span className="font-medium text-foreground">Pode marcar horários sozinho</span>
              <span className="block text-muted-foreground">
                Desligado, o agente só tira dúvidas e manda o link de agendamento.
              </span>
            </span>
          </label>

          <div className="flex flex-col gap-2">
            <Label htmlFor="handoff_hours">Pausa quando a equipe responde (horas)</Label>
            <Input
              id="handoff_hours"
              type="number"
              min={1}
              max={168}
              value={handoffHours}
              onChange={(e) => setHandoffHours(e.target.value)}
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">
              Alguém do estúdio respondeu pelo celular ou pelo painel: o agente fica quieto nessa
              conversa por esse tempo.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="max_replies">Teto de respostas por dia</Label>
            <Input
              id="max_replies"
              type="number"
              min={1}
              max={5000}
              value={maxReplies}
              onChange={(e) => setMaxReplies(e.target.value)}
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">Protege o consumo da chave se algo sair do normal.</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={saving || !integrationId || !model}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Salvar configuração
        </Button>
        <FeedbackLine feedback={saveFeedback} />
      </div>
    </div>
  );
}

function TestResultView({ result }: { result: ConnectionTestResult }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
      {result.ok ? (
        <>
          <p className="font-medium text-emerald-700">IA respondeu em {result.seconds}s</p>
          <div className="flex flex-col gap-2">
            <p className="max-w-[85%] self-end whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-primary-foreground">
              {result.question}
            </p>
            <p className="max-w-[85%] self-start whitespace-pre-wrap rounded-lg border border-border bg-background px-3 py-2 text-foreground">
              {result.reply}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {result.toolsUsed.length > 0
              ? `Ferramentas usadas: ${result.toolsUsed.join(", ")}`
              : "Nenhuma ferramenta usada — se perguntou de horário e não consultou, o modelo pode não lidar bem com ferramentas."}
          </p>
        </>
      ) : (
        <p className="text-destructive">IA: {result.error}</p>
      )}
      {result.whatsapp && (
        <p className={result.whatsapp.ok ? "text-emerald-700" : "text-destructive"}>
          WhatsApp: {result.whatsapp.text}
        </p>
      )}
    </div>
  );
}
