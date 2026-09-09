/**
 * Consentimento de cookies — o núcleo, compartilhado por cliente e servidor.
 *
 * O QUE ESTE SITE GUARDA HOJE, conferido no navegador e não presumido: nada
 * antes de entrar. A landing, a página pública de agendamento e a tela de
 * login não escrevem cookie nenhum. Os cookies de sessão do Supabase Auth
 * nascem no `proxy.ts` depois do login e são estritamente necessários — eles
 * não dependem de consentimento, só de transparência, e é por isso que a
 * categoria `necessary` aqui é sempre `true` e não tem como ser desligada.
 *
 * Nenhuma ferramenta de analytics está instalada (ver `lib/analytics.ts`).
 * A categoria `analytics` existe mesmo assim, e nasce `false`: ela é o lugar
 * onde o provedor futuro será ligado, e ter a estrutura pronta agora é o que
 * evita ter que refazer banner, cookie e gate quando alguém escolher um. O
 * que o gate impede hoje é o `CustomEvent` de instrumentação sair sem
 * autorização — de modo que o provedor nasça sem receber dado de quem recusou.
 *
 * COOKIE, NÃO `localStorage`: a decisão precisa ser legível em Server
 * Component e no SSR, e `localStorage` não existe no servidor. Ele é
 * estritamente necessário — é o registro de uma preferência que a pessoa
 * pediu — e por isso não depende do próprio consentimento.
 *
 * A leitura no SERVIDOR mora em `lib/consent-server.ts`. Não dá para ficar
 * aqui: `next/headers` lança fora do runtime de servidor, e este arquivo é
 * importado pelo banner, que é Client Component. Separar é o que permite os
 * dois lados compartilharem `parseConsent`/`serializeConsent` sem arrastar
 * `next/headers` para o bundle do navegador.
 */

/**
 * Versão da política vigente. TEM QUE BATER com a data de vigência exibida em
 * `/politica-de-privacidade` — é ela que decide se a pessoa precisa ser
 * perguntada de novo. Mudou o texto da política de forma relevante, sobe a
 * versão aqui e o banner volta para todo mundo.
 */
export const POLICY_VERSION = "2026-09";

export const CONSENT_COOKIE = "timely_consent";

/**
 * Seis meses. O gatilho principal para reperguntar é a versão da política, não
 * o calendário; este prazo é a rede de segurança para o caso de a política
 * ficar anos sem mudar, e é curto de propósito — consentimento envelhece.
 */
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

/** As categorias. `necessary` não é opcional e está aqui só para ser dita. */
export type ConsentCategories = {
  necessary: true;
  analytics: boolean;
};

export type ConsentRecord = ConsentCategories & {
  policyVersion: string;
  updatedAt: string;
};

/**
 * Valor devolvido pelos instantâneos quando ainda não dá para saber o que o
 * navegador guardou — o servidor, e o primeiro quadro da hidratação. É
 * diferente de "não existe cookie": ver a nota em `cookie-consent-banner.tsx`.
 * Não colide com um cookie real, que é JSON percent-encoded e começa em `%7B`.
 */
export const CONSENT_UNKNOWN = "desconhecido";

/** Disparado quando a escolha muda, para quem já está na página reagir. */
export const CONSENT_EVENT = "timely:consent";

export function makeConsent(analytics: boolean): ConsentRecord {
  return {
    necessary: true,
    analytics,
    policyVersion: POLICY_VERSION,
    updatedAt: new Date().toISOString(),
  };
}

export function serializeConsent(record: ConsentRecord): string {
  // Percent-encode porque `;` e `,` são separadores de cookie e o JSON
  // carregaria os dois na primeira vez que alguém acrescentar um campo.
  return encodeURIComponent(JSON.stringify(record));
}

/**
 * Lê o valor cru do cookie. Devolve `null` para qualquer coisa que não seja um
 * registro íntegro — cookie truncado, JSON de outra versão do app, alguém
 * editando o valor à mão. Registro corrompido vira "nunca respondeu", que é o
 * lado seguro: pergunta de novo em vez de assumir autorização.
 */
export function parseConsent(raw: string | null | undefined): ConsentRecord | null {
  if (!raw || raw === CONSENT_UNKNOWN) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (typeof parsed !== "object" || parsed === null) return null;
    const value = parsed as Record<string, unknown>;
    if (typeof value.analytics !== "boolean") return null;
    if (typeof value.policyVersion !== "string" || !value.policyVersion) return null;
    if (typeof value.updatedAt !== "string" || !value.updatedAt) return null;
    return {
      // `necessary` é sempre true por definição: o que estiver gravado no
      // cookie não pode desligar a sessão de login.
      necessary: true,
      analytics: value.analytics,
      policyVersion: value.policyVersion,
      updatedAt: value.updatedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Se a decisão guardada ainda vale para a política vigente. Comparação por
 * IGUALDADE, não por ordem: versões são rótulos ("2026-09"), e comparar com
 * `<` daria a resposta errada no dia em que o formato mudar. Qualquer
 * divergência manda perguntar de novo, que é o comportamento seguro.
 */
export function isConsentCurrent(record: ConsentRecord | null): boolean {
  return record !== null && record.policyVersion === POLICY_VERSION;
}

/** Se a categoria pode rodar. Sem decisão vigente, nada além do necessário. */
export function allows(record: ConsentRecord | null, category: keyof ConsentCategories): boolean {
  if (category === "necessary") return true;
  return isConsentCurrent(record) && record!.analytics;
}

/* --- Lado do cliente ------------------------------------------------------- */

/** Valor cru do cookie neste navegador; string vazia quando não existe. */
export function readConsentCookie(): string {
  if (typeof document === "undefined") return CONSENT_UNKNOWN;
  try {
    const row = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
    return row ? row.slice(CONSENT_COOKIE.length + 1) : "";
  } catch {
    // Navegador com cookies bloqueados: sem decisão registrada. O aviso
    // reaparece, que é o correto — não há onde guardar.
    return "";
  }
}

export function readConsent(): ConsentRecord | null {
  return parseConsent(readConsentCookie());
}

export function writeConsent(analytics: boolean): ConsentRecord {
  const record = makeConsent(analytics);
  if (typeof document !== "undefined") {
    try {
      // Sem `Secure` em http: em produção o site é https e o navegador já
      // trata o cookie como seguro pelo esquema da página.
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie =
        `${CONSENT_COOKIE}=${serializeConsent(record)}` +
        `; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
    } catch {
      // Sem onde gravar, a escolha vale só para esta navegação — o evento
      // abaixo ainda faz a interface responder ao clique.
    }
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: record }));
  }
  return record;
}

/** Apaga a decisão e devolve o aviso ao estado da primeira visita. */
export function clearConsent(): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${CONSENT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch {
    // Não há cookie para apagar; nada a fazer.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT));
}

/** Atalho do gate de `lib/analytics.ts`. */
export function analyticsAllowed(): boolean {
  return allows(readConsent(), "analytics");
}

/* --- Ligação com o React ---------------------------------------------------
   `useSyncExternalStore` é a porta certa para estado que vive fora do React —
   e o cookie é. A alternativa (`useState` + `useEffect` marcando "montou")
   gera o render em cascata que o compilador do React 19 aponta como erro.

   O instantâneo devolve a STRING crua, não o registro já parseado: o hook
   compara por identidade, e um objeto novo a cada leitura seria um laço
   infinito de render. Quem consome parseia com `useMemo`. */

export function subscribeConsent(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CONSENT_EVENT, onChange);
  // Outra aba do mesmo site: `storage` não dispara para cookie, e voltar para
  // esta aba é o momento em que a divergência apareceria.
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("focus", onChange);
  };
}

export function consentSnapshot(): string {
  return readConsentCookie();
}

export function consentServerSnapshot(): string {
  return CONSENT_UNKNOWN;
}
