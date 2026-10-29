import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cifra das chaves de API do agente (AES-256-GCM).
 *
 * A chave de cifragem vem de `AGENT_ENCRYPTION_KEY` quando existe. Sem ela, é
 * derivada da service_role do Supabase — que já é o segredo mais sensível do
 * app, então não piora nada e evita mais uma variável para configurar. Quem
 * definir `AGENT_ENCRYPTION_KEY` depois precisa salvar as chaves de novo: as
 * antigas foram cifradas com a derivada.
 *
 * Formato guardado: `v1:<iv>:<tag>:<cifrado>`, tudo em base64.
 */

function encryptionKey(): Buffer {
  const secret = process.env.AGENT_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Sem segredo para cifrar as chaves do agente");
  return createHash("sha256").update(`timely-agent:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, data] = stored.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Chave guardada em formato desconhecido");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

/** Os quatro últimos caracteres — o que a tela mostra para reconhecer a chave. */
export function lastFour(plain: string): string {
  return plain.trim().slice(-4);
}
