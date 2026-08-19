import "server-only";

/**
 * Contrato do gateway de WhatsApp.
 *
 * Existe uma implementação (Evolution API, self-hosted) e a interface é
 * pequena de propósito: cinco operações, nenhuma delas específica da
 * Evolution. Trocar por um gateway hospedado no futuro é escrever outro
 * arquivo neste diretório e mudar a linha do `getWhatsAppProvider` — nem o
 * disparador nem a tela de conexão precisam saber quem está do outro lado.
 *
 * O que NÃO está aqui, também de propósito: receber mensagem, listar
 * conversas, ler contatos. O escopo decidido é só envio (ver DECISIONS.md);
 * uma interface que já previsse caixa de entrada seria interface para um
 * produto que ninguém pediu ainda.
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

export interface WhatsAppProvider {
  readonly name: string;
  /** Cria a instância se ainda não existir. Idempotente. */
  ensureInstance(instanceName: string): Promise<void>;
  /** Abre (ou reabre) a sessão e devolve o material de pareamento. */
  connect(instanceName: string): Promise<ProviderPairing>;
  status(instanceName: string): Promise<ProviderStatus>;
  logout(instanceName: string): Promise<void>;
  sendText(input: SendTextInput): Promise<{ providerMessageId: string | null }>;
}

export const evolutionApiUrl = process.env.EVOLUTION_API_URL;
export const evolutionApiKey = process.env.EVOLUTION_API_KEY;

export const isWhatsAppProviderConfigured = Boolean(evolutionApiUrl && evolutionApiKey);

/**
 * Erro de gateway com a distinção que importa para o disparador: falha
 * temporária (rede, 5xx, sessão caída) merece nova tentativa; falha
 * permanente (número inválido, instância inexistente) não — reenviar só
 * gastaria tentativa e atrasaria a fila.
 */
export class WhatsAppProviderError extends Error {
  readonly retryable: boolean;

  constructor(message: string, options: { retryable: boolean; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.name = "WhatsAppProviderError";
    this.retryable = options.retryable;
  }
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

/** Nome da instância de um estúdio na Evolution. Estável e sem dado pessoal. */
export function instanceNameForStudio(studioId: string): string {
  return `estudio-${studioId}`;
}
