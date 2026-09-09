import "server-only";

/**
 * Contrato do gateway de WhatsApp.
 *
 * Existe uma implementação (Evolution API, self-hosted) e a interface é
 * pequena de propósito: nenhuma das operações é específica da Evolution.
 * Trocar por um gateway hospedado no futuro é escrever outro arquivo neste
 * diretório e mudar a linha do `getWhatsAppProvider` — nem o disparador, nem a
 * tela de conexão, nem a rota de envio precisam saber quem está do outro lado.
 * É esta indireção que a seção 31 do plano pede: o frontend fala
 * `POST /api/whatsapp/send`, nunca `POST <ip>:8080/message/sendText/...`.
 *
 * O que NÃO está aqui, de propósito: listar conversas, ler contatos, baixar
 * histórico. O escopo decidido é envio (ver DECISIONS.md) — e o webhook existe
 * para manter o ESTADO DA CONEXÃO em dia, não para trazer a caixa de entrada
 * das clientes para dentro da nossa infraestrutura.
 */

export type ProviderConnectionState = "conectado" | "conectando" | "desconectado" | "erro";

export interface ProviderStatus {
  state: ProviderConnectionState;
  /** Número pareado, só dígitos, quando o gateway informa. */
  phone: string | null;
  /** Mensagem legível quando `state` é "erro". */
  error: string | null;
}

export interface ProviderPairing {
  /** PNG em base64 (sem o prefixo `data:`) para exibir como QR code. */
  qrCodeBase64: string | null;
  /** Código de pareamento por número, quando o gateway oferece. */
  pairingCode: string | null;
}

export interface SendTextInput {
  instanceName: string;
  /** E.164 sem "+", como está gravado no banco. */
  toPhone: string;
  body: string;
}

export interface SetWebhookInput {
  instanceName: string;
  url: string;
  /** Vai como header em toda entrega; é o que autentica a chamada no app. */
  secret: string;
}

export interface WhatsAppProvider {
  readonly name: string;
  /** Cria a instância se ainda não existir. Idempotente. */
  ensureInstance(instanceName: string): Promise<void>;
  /** Abre (ou reabre) a sessão e devolve o material de pareamento. */
  connect(instanceName: string): Promise<ProviderPairing>;
  status(instanceName: string): Promise<ProviderStatus>;
  /** Encerra a sessão mantendo a instância. Idempotente. */
  logout(instanceName: string): Promise<void>;
  /** Apaga a instância no gateway. Idempotente — some com a sessão também. */
  deleteInstance(instanceName: string): Promise<void>;
  /** Registra o webhook da instância. Idempotente (upsert no gateway). */
  setWebhook(input: SetWebhookInput): Promise<void>;
  /**
   * Diz quais dos números existem no WhatsApp.
   * Chave = número consultado (só dígitos), valor = existe ou não.
   */
  checkNumbers(instanceName: string, numbers: string[]): Promise<Map<string, boolean>>;
  sendText(input: SendTextInput): Promise<{ providerMessageId: string | null }>;
}

export const evolutionApiUrl = process.env.EVOLUTION_API_URL;
export const evolutionApiKey = process.env.EVOLUTION_API_KEY;

/**
 * Prefixo do nome da instância (seção 4 do plano). Fica no ambiente para que
 * duas instalações do sistema possam dividir a MESMA Evolution sem colidir
 * nome de instância — o nome é único por instalação do gateway, não por app.
 */
export const evolutionInstancePrefix = process.env.EVOLUTION_INSTANCE_PREFIX?.trim() || "promatic";

export const isWhatsAppProviderConfigured = Boolean(evolutionApiUrl && evolutionApiKey);

/**
 * Erro de gateway com a distinção que importa para o disparador: falha
 * temporária (rede, 5xx, sessão caída) merece nova tentativa; falha
 * permanente (número inválido, instância inexistente) não — reenviar só
 * gastaria tentativa e atrasaria a fila.
 *
 * `userMessage` é o que pode aparecer na tela. A `message` técnica vai para o
 * log do servidor e NUNCA para o navegador: a seção 28 do plano pede mensagem
 * amigável, e um "ECONNREFUSED 203.0.113.10:8080" na interface entrega
 * endereço de infraestrutura para quem não deveria vê-lo.
 */
export class WhatsAppProviderError extends Error {
  readonly retryable: boolean;
  readonly userMessage: string;

  constructor(
    message: string,
    options: { retryable: boolean; userMessage?: string; cause?: unknown }
  ) {
    super(message, { cause: options.cause });
    this.name = "WhatsAppProviderError";
    this.retryable = options.retryable;
    this.userMessage =
      options.userMessage ??
      (options.retryable
        ? "O WhatsApp não respondeu agora. Tente de novo em alguns instantes."
        : "Não foi possível concluir a operação no WhatsApp.");
  }
}

/** Mensagem segura para exibir a partir de qualquer falha de envio/conexão. */
export function friendlyProviderError(cause: unknown): string {
  if (cause instanceof WhatsAppProviderError) return cause.userMessage;
  return "Não foi possível falar com o WhatsApp agora. Tente de novo em alguns instantes.";
}

/**
 * Devolve o gateway configurado, ou `null` quando não há nenhum.
 *
 * Devolver `null` em vez de um dublê que finge enviar é deliberado: um dublê
 * marcaria mensagens como "enviado" sem que ninguém recebesse nada, e o
 * histórico passaria a mentir. Sem gateway, o planejador continua enfileirando
 * normalmente (dá para ver a fila crescer) e o disparador não envia nada.
 */
export async function getWhatsAppProvider(): Promise<WhatsAppProvider | null> {
  if (!isWhatsAppProviderConfigured) return null;
  const { createEvolutionProvider } = await import("@/lib/whatsapp/evolution");
  return createEvolutionProvider();
}

/**
 * Nome da instância de um estúdio no gateway.
 *
 * Derivado do ID do estúdio, e é isso que amarra a sessão ao inquilino: o nome
 * NUNCA chega por parâmetro do cliente. Aceitá-lo do formulário seria entregar
 * a sessão de um salão a quem trocasse o valor no navegador (seção 6).
 *
 * Não há UUID aleatório no nome (o plano sugere na seção 10) porque aqui é uma
 * conexão por estúdio: um nome derivado é reencontrável sem consultar o banco,
 * o que torna `ensureInstance` idempotente de graça. Estável entre deploys,
 * e sem nome de pessoa nem telefone dentro.
 */
export function instanceNameForStudio(studioId: string): string {
  return `${evolutionInstancePrefix}_${studioId}`;
}

/**
 * A instância da PRÓPRIA plataforma — a que envia os avisos que não pertencem
 * a estúdio nenhum (lead novo na landing). Nome fixo pelo mesmo motivo do
 * derivado acima: reencontrável sem consultar o banco, estável entre deploys.
 *
 * O sufixo é uma palavra, não um UUID, para não haver a menor chance de colidir
 * com o nome de um estúdio — id de estúdio é UUID, e "plataforma" não é.
 */
export function instanceNameForPlatform(): string {
  return `${evolutionInstancePrefix}_plataforma`;
}

/**
 * Eventos que o app pede ao gateway.
 *
 * QRCODE_UPDATED + CONNECTION_UPDATE são o que faz a tela mudar de "conectando"
 * para "conectado" sem o dono clicar em nada (seção 13). LOGOUT/REMOVE avisam
 * quando a sessão morre do lado do WhatsApp — aparelho desvinculado no celular,
 * por exemplo — e é o único jeito de a tela saber disso antes do próximo envio.
 *
 * MESSAGES_UPSERT (mensagem recebida) está FORA da assinatura de propósito: o
 * produto só envia, e assinar a caixa de entrada de cada salão traria conversa
 * de cliente para dentro da nossa infraestrutura sem ninguém ter pedido — além
 * de ser volume que não serve a nada hoje. O receptor em
 * /api/webhooks/evolution entende o evento e responde 200 se ele chegar
 * (gateway configurado à mão, por exemplo), então ligar isso no futuro é
 * acrescentar uma linha aqui.
 */
export const EVOLUTION_WEBHOOK_EVENTS = [
  "QRCODE_UPDATED",
  "CONNECTION_UPDATE",
  "LOGOUT_INSTANCE",
  "REMOVE_INSTANCE",
] as const;

export const evolutionWebhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET;

/**
 * Para onde a Evolution deve chamar de volta, ou `null` quando não dá.
 *
 * Quem chama é a VPS, não o navegador — então a URL precisa ser alcançável
 * PELA INTERNET. Em desenvolvimento, NEXT_PUBLIC_SITE_URL é localhost, e
 * registrar isso na Evolution faria a VPS bater na porta 3000 dela mesma e
 * falhar em silêncio a cada evento. Melhor não registrar e dizer isso na
 * tela: o polling da tela de conexão cobre o caso local.
 *
 * Sem segredo também devolve `null`: um webhook aberto é um jeito de
 * qualquer um na internet marcar o WhatsApp de um estúdio como conectado.
 */
export function resolveWebhookTarget(): { url: string; secret: string } | null {
  if (!evolutionWebhookSecret) return null;

  const explicit = process.env.EVOLUTION_WEBHOOK_URL?.trim();
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const raw = explicit || (site ? `${site.replace(/\/+$/, "")}/api/webhooks/evolution` : "");
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.toLowerCase();
  const local =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local");
  if (local) return null;

  return { url: parsed.toString(), secret: evolutionWebhookSecret };
}

/** Header em que o segredo do webhook viaja. */
export const WEBHOOK_SECRET_HEADER = "x-timely-webhook-secret";
