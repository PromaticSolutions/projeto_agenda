/**
 * Instrumentação de eventos da landing.
 *
 * O projeto NÃO tem analytics instalado — conferido em package.json e no
 * código. Então esta função deliberadamente não instala nada: ela marca os
 * pontos de medição no código e despacha um `CustomEvent` no `window`.
 *
 * Por que assim, em vez de já plugar um provedor: escolher ferramenta de
 * analytics é decisão de produto (custo, LGPD, onde o dado fica), não algo
 * para um arquivo de landing resolver por conta. Com os pontos já marcados,
 * ligar o que for escolhido depois é um `addEventListener` num lugar só —
 * enquanto instrumentar 12 seções depois seria varrer a landing inteira de
 * novo.
 *
 * Em desenvolvimento imprime no console, para dar para conferir que o evento
 * dispara na hora certa.
 *
 * O DESPACHO DEPENDE DA CATEGORIA `analytics` DO CONSENTIMENTO
 * (`lib/consent.ts`), que hoje é sempre `false` — não há provedor ligado, e
 * portanto não há o que autorizar. Na prática o `CustomEvent` não sai, e é
 * assim que deve ser: a instrumentação fica marcada, inerte, até alguém
 * escolher uma ferramenta E o banner passar a oferecer a categoria.
 *
 * Fazer o corte AQUI, e não no provedor que vier depois, é o que garante que
 * ligar uma ferramenta nova continue sendo um `addEventListener` num lugar só:
 * ela nunca vai receber evento de quem não autorizou, sem precisar saber que
 * consentimento existe.
 *
 * O aviso do console em desenvolvimento fica FORA do corte, para dar para
 * conferir a instrumentação sem ter que aceitar cookies a cada recarga.
 */

import { analyticsAllowed } from "@/lib/consent";

export type LandingEvent =
  | "landing_view"
  | "hero_cta_click"
  | "login_click"
  | "signup_click"
  | "section_view"
  | "simulator_interaction"
  // Troca de perfil nas abas de "para quem é": diz qual público a pessoa
  // foi conferir, que é o sinal mais barato de segmentação que a página dá.
  | "product_demo_interaction"
  | "whatsapp_demo_interaction"
  | "form_started"
  | "form_step_completed"
  | "form_completed"
  | "lead_submitted";

export const ANALYTICS_EVENT_NAME = "timely:analytics";

export function track(event: LandingEvent, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;

  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", event, props ?? {}, analyticsAllowed() ? "" : "(não despachado: sem consentimento)");
  }

  if (!analyticsAllowed()) return;

  window.dispatchEvent(
    new CustomEvent(ANALYTICS_EVENT_NAME, { detail: { event, ...props } })
  );
}
