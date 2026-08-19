import "server-only";
import {
  WhatsAppProviderError,
  evolutionApiKey,
  evolutionApiUrl,
  type ProviderPairing,
  type ProviderStatus,
  type SendTextInput,
  type WhatsAppProvider,
} from "@/lib/whatsapp/provider";

/**
 * Adaptador da Evolution API (self-hosted, integração WHATSAPP-BAILEYS).
 *
 * ATENÇÃO AO VERIFICAR: os caminhos e o formato dos corpos abaixo seguem a
 * linha 2.x da Evolution. A v1 usava outro shape no envio
 * (`{ number, textMessage: { text } }` em vez de `{ number, text }`), e o
 * projeto muda endpoint entre versões menores com mais frequência do que a
 * documentação sugere. Antes de confiar em produção, rode o smoke test do
 * README contra a SUA instância — é meia dúzia de chamadas e evita descobrir
 * a diferença no dia em que o primeiro lembrete não sair.
 *
 * A chave (`EVOLUTION_API_KEY`) é global da instalação e vai no header
 * `apikey`. Ela NUNCA pode chegar ao navegador: por isso este módulo é
 * `server-only` e a tela de conexão fala com ele por Server Action, nunca por
 * fetch do cliente.
 */

const REQUEST_TIMEOUT_MS = 15_000;

interface EvolutionRequest {
  path: string;
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  /** Códigos que não são erro para esta chamada (ex.: 404 ao checar estado). */
  tolerate?: number[];
}

interface EvolutionResponse {
  status: number;
  data: unknown;
}

async function callEvolution(request: EvolutionRequest): Promise<EvolutionResponse> {
  if (!evolutionApiUrl || !evolutionApiKey) {
    throw new WhatsAppProviderError("Evolution API não configurada", { retryable: false });
  }

  const url = `${evolutionApiUrl.replace(/\/+$/, "")}${request.path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: request.method ?? "GET",
      headers: {
        apikey: evolutionApiKey,
        ...(request.body ? { "Content-Type": "application/json" } : {}),
      },
      body: request.body ? JSON.stringify(request.body) : undefined,
      // A rota de cron tem orçamento de tempo; uma instância fora do ar não
      // pode segurar o disparador até o timeout da plataforma.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (cause) {
    // Rede, DNS, timeout: a instância pode voltar. Vale nova tentativa.
    throw new WhatsAppProviderError("Evolution API inacessível", { retryable: true, cause });
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok && !request.tolerate?.includes(response.status)) {
    // 5xx e 429 passam; 4xx são configuração ou dado errado, e repetir não
    // conserta nenhum dos dois.
    const retryable = response.status >= 500 || response.status === 429;
    throw new WhatsAppProviderError(
      `Evolution API respondeu ${response.status}: ${describe(data)}`,
      { retryable }
    );
  }

  return { status: response.status, data };
}

/** Extrai uma mensagem curta e legível do corpo de erro da Evolution. */
function describe(data: unknown): string {
  if (typeof data === "string") return data.slice(0, 200);
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const message = record.message ?? record.error ?? record.response;
    if (typeof message === "string") return message.slice(0, 200);
    if (Array.isArray(message)) return message.map(String).join("; ").slice(0, 200);
  }
  return "sem detalhe";
}

function pick(data: unknown, ...path: string[]): unknown {
  let current: unknown = data;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function createEvolutionProvider(): WhatsAppProvider {
  return {
    name: "evolution",

    async ensureInstance(instanceName: string): Promise<void> {
      // A Evolution devolve 403/409 quando a instância já existe. Como o
      // objetivo é "garantir que existe", esses códigos são sucesso aqui —
      // criar-se-ia uma corrida boba entre duas abas do painel de outro jeito.
      await callEvolution({
        path: "/instance/create",
        method: "POST",
        body: {
          instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        },
        tolerate: [403, 409],
      });
    },

    async connect(instanceName: string): Promise<ProviderPairing> {
      const { data } = await callEvolution({
        path: `/instance/connect/${encodeURIComponent(instanceName)}`,
      });

      // O QR vem em `base64` (às vezes já com o prefixo data:image) e o código
      // de pareamento por número em `pairingCode`.
      const base64 = pick(data, "base64") ?? pick(data, "qrcode", "base64");
      const pairingCode = pick(data, "pairingCode") ?? pick(data, "qrcode", "pairingCode");

      return {
        qrCodeBase64:
          typeof base64 === "string" ? base64.replace(/^data:image\/\w+;base64,/, "") : null,
        pairingCode: typeof pairingCode === "string" ? pairingCode : null,
      };
    },

    async status(instanceName: string): Promise<ProviderStatus> {
      const { status, data } = await callEvolution({
        path: `/instance/connectionState/${encodeURIComponent(instanceName)}`,
        tolerate: [404],
      });

      // 404 = instância nunca criada. Não é erro: é o estado inicial de um
      // estúdio que ainda não tentou conectar.
      if (status === 404) return { state: "desconectado", phone: null, error: null };

      const raw = pick(data, "instance", "state") ?? pick(data, "state");
      const phone = pick(data, "instance", "owner") ?? pick(data, "instance", "number");

      return {
        state: mapState(typeof raw === "string" ? raw : null),
        // O `owner` vem como "5511999999999@s.whatsapp.net".
        phone: typeof phone === "string" ? (phone.split("@")[0].replace(/\D/g, "") || null) : null,
        error: null,
      };
    },

    async logout(instanceName: string): Promise<void> {
      await callEvolution({
        path: `/instance/logout/${encodeURIComponent(instanceName)}`,
        method: "DELETE",
        tolerate: [404],
      });
    },

    async sendText({ instanceName, toPhone, body }: SendTextInput) {
      const { data } = await callEvolution({
        path: `/message/sendText/${encodeURIComponent(instanceName)}`,
        method: "POST",
        body: { number: toPhone, text: body },
      });

      const id = pick(data, "key", "id");
      return { providerMessageId: typeof id === "string" ? id : null };
    },
  };
}

/** Estados da Evolution → vocabulário do nosso enum `whatsapp_connection_status`. */
function mapState(state: string | null): ProviderStatus["state"] {
  switch (state) {
    case "open":
      return "conectado";
    case "connecting":
      return "conectando";
    case "close":
    case "closed":
      return "desconectado";
    default:
      return state ? "erro" : "desconectado";
  }
}
