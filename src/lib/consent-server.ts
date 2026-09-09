import "server-only";
import { cookies } from "next/headers";
import {
  CONSENT_COOKIE,
  allows,
  isConsentCurrent,
  parseConsent,
  type ConsentCategories,
  type ConsentRecord,
} from "@/lib/consent";

/**
 * Leitura do consentimento no SERVIDOR.
 *
 * Mora num arquivo separado de `lib/consent.ts` por um motivo mecânico: este
 * importa `next/headers`, que lança fora do runtime de servidor, e o núcleo é
 * importado pelo banner, que é Client Component. Se os dois estivessem no
 * mesmo módulo, o bundle do navegador arrastaria `next/headers` junto e a
 * página quebraria na hidratação. O que os dois lados compartilham —
 * `parseConsent`, as categorias, a versão da política — continua num lugar só.
 *
 * `cookies()` é assíncrono desde o Next 15 e marca a rota como dinâmica. Por
 * isso NADA na landing chama isto hoje: ela é estática (`○` no build) e ler
 * cookie ali custaria a pré-renderização inteira para decidir um banner que o
 * cliente já resolve sozinho. Existe para quando alguma decisão de servidor
 * precisar do consentimento — injetar o script de um provedor no `<head>`, por
 * exemplo, que é exatamente o caso em que fazer isso no cliente vaza.
 */
export async function readConsentServer(): Promise<ConsentRecord | null> {
  const store = await cookies();
  return parseConsent(store.get(CONSENT_COOKIE)?.value);
}

/** Se a categoria pode rodar, do ponto de vista do servidor. */
export async function serverAllows(category: keyof ConsentCategories): Promise<boolean> {
  return allows(await readConsentServer(), category);
}

/** Se ainda falta perguntar (nunca respondeu, ou a política mudou de versão). */
export async function needsConsentServer(): Promise<boolean> {
  return !isConsentCurrent(await readConsentServer());
}
