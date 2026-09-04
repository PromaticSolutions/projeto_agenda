import "server-only";
import {
  EVOLUTION_WEBHOOK_EVENTS,
  WEBHOOK_SECRET_HEADER,
  WhatsAppProviderError,
  evolutionApiKey,
  evolutionApiUrl,
  type ProviderPairing,
  type ProviderStatus,
  type SendTextInput,
  type SetWebhookInput,
  type WhatsAppProvider,
} from "@/lib/whatsapp/provider";

/**
 * Adaptador da Evolution API 2.3.7 (self-hosted, integração WHATSAPP-BAILEYS).
 *
 * Os caminhos e os corpos abaixo foram conferidos contra o CÓDIGO-FONTE da tag
 * 2.3.7, não contra exemplo de versão antiga — a Evolution muda contrato entre
 * versões menores com mais frequência do que a documentação sugere. O que a
 * conferência mudou em relação ao que "todo mundo escreve":
 *
 *  - `GET /instance/connectionState/{nome}` devolve SÓ
 *    `{ instance: { instanceName, state } }`. Não existe `owner` nem `number`
 *    nessa resposta na 2.3.7 (instance.controller.ts:393). Quem sabe o número
 *    pareado é `GET /instance/fetchInstances`, no campo `ownerJid` — daí a
 *    segunda chamada em `status()`, feita só quando a sessão está aberta.
 *  - `DELETE /instance/logout/{nome}` devolve 400 ("is not connected") quando
 *    a sessão já está fechada (instance.controller.ts:436). Desconectar duas
 *    vezes é operação normal na tela, então 400 aqui é sucesso.
 *  - Instância inexistente devolve 404 em TODAS as rotas com `:instanceName`
 *    (instanceExistsGuard), e nome repetido no create devolve 403
 *    ("already in use", instanceLoggedGuard). Os dois são estados esperados.
 *  - `GET /instance/connect/{nome}` com a sessão já aberta devolve
 *    `{ instance: {...} }` SEM QR code, e com a sessão fechada reconecta e
 *    espera 2s antes de responder — o QR pode vir vazio nessa primeira
 *    resposta. A tela trata isso perguntando de novo.
 *
 * A chave (`EVOLUTION_API_KEY`) é global da instalação: quem a tem controla
 * TODAS as instâncias. Por isso este módulo é `server-only` e nunca é
 * importado por componente de cliente — a tela fala com ele por Server Action
 * ou rota interna, nunca por fetch do navegador.
 */

const REQUEST_TIMEOUT_MS = 15_000;

interface EvolutionRequest {
  path: string;
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  /** Códigos que não são erro para esta chamada (ex.: 404 ao checar estado). */
  tolerate?: number[];
  /** Mensagem amigável quando esta chamada específica falha. */
  userMessage?: string;
}

interface EvolutionResponse {
  status: number;
  data: unknown;
}

async function callEvolution(request: EvolutionRequest): Promise<EvolutionResponse> {
  if (!evolutionApiUrl || !evolutionApiKey) {
    throw new WhatsAppProviderError("Evolution API não configurada", {
      retryable: false,
      userMessage: "O WhatsApp ainda não foi configurado neste ambiente.",
    });
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
    // A mensagem técnica carrega o host; ela fica no log, não na tela.
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    throw new WhatsAppProviderError("Evolution API inacessível", {
      retryable: true,
      userMessage: timedOut
        ? "O WhatsApp demorou demais para responder. Não foi possível confirmar o envio."
        : "Não foi possível falar com o WhatsApp agora. Tente de novo em alguns instantes.",
      cause,
    });
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
      {
        retryable,
        userMessage:
          request.userMessage ??
          (response.status === 404
            ? "Esta conexão de WhatsApp não existe mais no servidor. Conecte o número novamente."
            : retryable
              ? "O WhatsApp está instável neste momento. Tente de novo em alguns instantes."
              : "O WhatsApp recusou a operação. Verifique a conexão do número."),
      }
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
    if (message && typeof message === "object") {
      const nested = (message as Record<string, unknown>).message;
      if (typeof nested === "string") return nested.slice(0, 200);
      if (Array.isArray(nested)) return nested.map(String).join("; ").slice(0, 200);
    }
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

/** "5511999999999@s.whatsapp.net" -> "5511999999999" */
function phoneFromJid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.split("@")[0]?.replace(/\D/g, "") ?? "";
  return digits || null;
}

export function createEvolutionProvider(): WhatsAppProvider {
  /**
   * Linha da instância em `fetchInstances`. É a única resposta da 2.3.7 que
   * traz `ownerJid`; `connectionState` não traz.
   */
  async function fetchInstance(instanceName: string): Promise<Record<string, unknown> | null> {
    const { data } = await callEvolution({
      path: `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
      tolerate: [404],
    });

    // A rota devolve array. Filtrar pelo nome mesmo tendo passado o parâmetro
    // é barato e protege contra a versão que ignora o filtro e devolve tudo —
    // sem isso, um estúdio poderia ler o número pareado de outro.
    const rows = Array.isArray(data) ? data : [data];
    for (const row of rows) {
      if (row && typeof row === "object" && (row as Record<string, unknown>).name === instanceName) {
        return row as Record<string, unknown>;
      }
    }
    return null;
  }

  return {
    name: "evolution",

    async ensureInstance(instanceName: string): Promise<void> {
      // 403 = "already in use" (instanceLoggedGuard). Como o objetivo é
      // "garantir que existe", isso é sucesso aqui — do contrário duas abas do
      // painel criariam uma corrida boba. 409 fica tolerado por segurança
      // contra variação de versão.
      await callEvolution({
        path: "/instance/create",
        method: "POST",
        body: {
          instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        },
        tolerate: [403, 409],
        userMessage: "Não foi possível preparar a conexão no servidor de WhatsApp.",
      });
    },

    async connect(instanceName: string): Promise<ProviderPairing> {
      const { data } = await callEvolution({
        path: `/instance/connect/${encodeURIComponent(instanceName)}`,
        userMessage: "Não foi possível gerar o QR code agora. Tente de novo.",
      });

      // Com a sessão já aberta a resposta é `{ instance: {...} }`, sem QR — e
      // isso não é erro: é "já está conectado". Com a sessão fechada vem
      // `{ pairingCode, code, base64, count }`, e `base64` chega como data URL
      // completa (qrcode.toDataURL), por isso o prefixo é removido.
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
      const state = mapState(typeof raw === "string" ? raw : null);

      // Só vale a segunda chamada quando há número para descobrir. Com a
      // sessão fechada não existe `ownerJid`, e o disparador roda isso uma vez
      // por estúdio a cada execução — não é lugar de gastar requisição à toa.
      let phone: string | null = null;
      if (state === "conectado") {
        try {
          const row = await fetchInstance(instanceName);
          phone = phoneFromJid(row?.ownerJid) ?? phoneFromJid(row?.number);
        } catch {
          // Saber o número é conveniência da tela; não saber não muda o fato
          // de a sessão estar aberta. Degradar aqui é melhor que reportar
          // "erro" numa conexão que está funcionando.
        }
      }

      return { state, phone, error: null };
    },

    async logout(instanceName: string): Promise<void> {
      // 400 = "is not connected": a sessão já estava fechada, que é exatamente
      // o resultado pedido. 404 = instância nem existe, idem.
      await callEvolution({
        path: `/instance/logout/${encodeURIComponent(instanceName)}`,
        method: "DELETE",
        tolerate: [400, 404],
      });
    },

    async deleteInstance(instanceName: string): Promise<void> {
      // A própria rota desconecta antes de apagar quando o estado é
      // connecting/open (instance.controller.ts:452). 404 é sucesso: o alvo da
      // operação é "não existir mais".
      //
      // MEDIDO NA VPS: o 200 aqui é ACEITE, não conclusão. A 2.3.7 emite
      // `remove.instance` e responde SUCCESS na hora; a remoção acontece no
      // listener. Quando a sessão já está fechada, a instância não está mais
      // no mapa vivo e o listener não tem o que remover — a linha fica
      // pendurada no banco da Evolution indefinidamente.
      //
      // Isso NÃO afeta a exclusão do ponto de vista do produto, e é por dois
      // motivos: a sessão fica encerrada (é o que interessa), e reconectar
      // depois funciona porque `ensureInstance` trata o 403 "already in use"
      // como sucesso e o `connect` seguinte gera um QR novo — caminho
      // verificado na instância real. O estado que a tela mostra é o da NOSSA
      // tabela, que a action zera.
      await callEvolution({
        path: `/instance/delete/${encodeURIComponent(instanceName)}`,
        method: "DELETE",
        tolerate: [400, 404],
        userMessage: "Não foi possível remover a conexão no servidor de WhatsApp.",
      });
    },

    async setWebhook({ instanceName, url, secret }: SetWebhookInput): Promise<void> {
      // `POST /webhook/set/{nome}` faz upsert no gateway (webhook.controller.ts),
      // então chamar a cada conexão é seguro e mantém a URL em dia quando o
      // domínio do app muda.
      //
      // O segredo vai em `headers`, que a Evolution reenvia em toda entrega —
      // é o que permite ao receptor recusar chamada de terceiro. Não usamos
      // `jwt_key` (que a Evolution converteria em Bearer JWT) porque isso
      // exigiria validar assinatura com a mesma chave global do gateway.
      //
      // `byEvents: false` mantém uma URL só; com `true` a Evolution acrescenta
      // /connection-update ao caminho e cada evento vira uma rota diferente.
      await callEvolution({
        path: `/webhook/set/${encodeURIComponent(instanceName)}`,
        method: "POST",
        body: {
          webhook: {
            enabled: true,
            url,
            headers: { [WEBHOOK_SECRET_HEADER]: secret, "Content-Type": "application/json" },
            byEvents: false,
            base64: false,
            events: [...EVOLUTION_WEBHOOK_EVENTS],
          },
        },
        userMessage: "A conexão foi criada, mas o aviso automático de status não pôde ser ligado.",
      });
    },

    async checkNumbers(instanceName: string, numbers: string[]): Promise<Map<string, boolean>> {
      const result = new Map<string, boolean>();
      if (numbers.length === 0) return result;

      const { data } = await callEvolution({
        path: `/chat/whatsappNumbers/${encodeURIComponent(instanceName)}`,
        method: "POST",
        body: { numbers },
        userMessage: "Não foi possível verificar o número no WhatsApp.",
      });

      // Resposta: [{ exists, jid, number }]. Casar pelo `number` devolvido e,
      // como reserva, pelos dígitos do `jid` — a Evolution às vezes normaliza
      // o número (nono dígito de celular) e devolve diferente do que foi
      // consultado.
      if (Array.isArray(data)) {
        for (const row of data) {
          if (!row || typeof row !== "object") continue;
          const record = row as Record<string, unknown>;
          const exists = record.exists === true;
          const asked = typeof record.number === "string" ? record.number.replace(/\D/g, "") : null;
          const fromJid = phoneFromJid(record.jid);
          if (asked) result.set(asked, exists);
          if (fromJid) result.set(fromJid, exists);
        }
      }
      return result;
    },

    async sendText({ instanceName, toPhone, body }: SendTextInput) {
      // SendTextDto na 2.3.7 é `{ number, text }` (sendMessage.dto.ts). A v1
      // usava `{ number, textMessage: { text } }` — é o erro mais comum ao
      // copiar exemplo antigo, e falha em silêncio com 400.
      const { data } = await callEvolution({
        path: `/message/sendText/${encodeURIComponent(instanceName)}`,
        method: "POST",
        body: { number: toPhone, text: body },
        userMessage: "O WhatsApp não aceitou a mensagem. Verifique o número e tente de novo.",
      });

      const id = pick(data, "key", "id");
      return { providerMessageId: typeof id === "string" ? id : null };
    },
  };
}

/** Estados da Evolution → vocabulário do nosso enum `whatsapp_connection_status`. */
export function mapState(state: string | null): ProviderStatus["state"] {
  switch (state) {
    case "open":
      return "conectado";
    case "connecting":
      return "conectando";
    case "close":
    case "closed":
      return "desconectado";
    // `refused` é o QR estourando o limite de tentativas: a sessão não vai
    // abrir sozinha, e chamar isso de "desconectado" faria a tela sugerir
    // esperar quando o certo é gerar um código novo.
    case "refused":
      return "erro";
    default:
      return state ? "erro" : "desconectado";
  }
}
