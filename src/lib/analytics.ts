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
 */

export type LandingEvent =
  | "landing_view"
  | "hero_cta_click"
  | "login_click"
  | "signup_click"
  | "section_view"
  | "simulator_interaction"
  | "whatsapp_demo_interaction"
  | "form_started"
  | "form_step_completed"
  | "form_completed"
  | "lead_submitted";

export const ANALYTICS_EVENT_NAME = "timely:analytics";

export function track(event: LandingEvent, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;

  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", event, props ?? {});
  }

  window.dispatchEvent(
    new CustomEvent(ANALYTICS_EVENT_NAME, { detail: { event, ...props } })
  );
}
