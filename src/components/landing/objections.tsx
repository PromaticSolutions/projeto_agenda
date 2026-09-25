import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { MONTHLY_PRICE, TRIAL_DAYS } from "@/components/landing/pricing";

/**
 * Objeções.
 *
 * Cada resposta foi conferida contra o código, e duas delas dizem "não" ou
 * "ainda não" de propósito:
 *
 *  - múltiplos profissionais: não existe cadastro de equipe no banco (nenhuma
 *    tabela de staff em supabase/migrations). Prometer isso aqui geraria um
 *    cadastro frustrado no primeiro dia de uso;
 *  - responder mensagem: o produto envia e mostra as conversas no painel, mas
 *    não responde sozinho. A conversa continua sendo sua.
 *
 * Teste, preço e cancelamento são a condição comercial definida pelo dono do
 * produto, e vêm das constantes de `pricing.tsx` — a resposta e o cartão de
 * preço nunca divergem.
 *
 * `<details>` nativo em vez de acordeão em JavaScript: abre sem hidratação,
 * é acessível por teclado de graça, e o conteúdo fica no HTML — o que também
 * significa que buscador e leitor de tela encontram as respostas.
 */

const FAQ = [
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. O Timely funciona direto no navegador, no celular ou no computador. Suas clientes também não instalam nada: elas abrem o seu link, escolhem o horário e informam nome e telefone.",
  },
  {
    q: "Tem teste grátis? Preciso cadastrar cartão?",
    a: `Tem: ${TRIAL_DAYS} dias grátis, com acesso completo. Você cria a conta só com e-mail e senha, sem cartão de crédito.`,
  },
  {
    q: "Quanto custa depois do teste?",
    a: `${MONTHLY_PRICE} por mês, com todos os recursos incluídos. Você só começa a pagar depois do período gratuito.`,
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Pode. Não tem fidelidade nem multa: se o Timely não fizer sentido para você, é só cancelar.",
  },
  {
    q: "É difícil de usar?",
    a: "Não. Você cadastra seus procedimentos e horários uma vez e compartilha o link. A partir daí a agenda, o cadastro das clientes e os lembretes acontecem sozinhos.",
  },
  {
    q: "Posso usar pelo celular?",
    a: "Sim. O painel funciona no navegador do celular, para você acompanhar o dia entre um atendimento e outro.",
  },
  {
    q: "Posso continuar usando o meu WhatsApp?",
    a: "É exatamente assim que funciona. Você conecta o seu próprio número lendo um QR code, e os lembretes saem por ele, com o seu nome. Quando a cliente responde, a conversa chega para você, no celular e no painel do Timely. O Timely envia, mas não responde por você.",
  },
  {
    q: "Meus dados ficam seguros?",
    a: "Sim. Cada conta só acessa os próprios dados, e isso é garantido no banco de dados, não só na tela. Toda a conexão é segura, e as suas clientes podem pedir para ver, corrigir ou excluir os dados delas, como pede a LGPD.",
  },
  {
    q: "Para quem o Timely é indicado?",
    a: "Para profissionais e pequenos negócios que trabalham com horário marcado: salões, barbearias, clínicas de estética, studios e profissionais autônomos. Hoje o Timely trabalha com uma agenda por conta, então ainda não divide a agenda entre vários profissionais atendendo ao mesmo tempo.",
  },
];

export function Objections() {
  return (
    <section id="duvidas" className="scroll-mt-16 border-b border-foreground/15 bg-muted py-24 sm:py-32">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-20">
        {/* O título fica parado enquanto as perguntas passam (só no desktop,
            onde há coluna para segurá-lo). */}
        <Reveal sectionName="duvidas" className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading time="17:00" eyebrow="Dúvidas" lead="O que costumam perguntar" trail="antes de começar." />
          <a
            href="#conhecer"
            className="group mt-7 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-foreground underline decoration-foreground/30 underline-offset-[6px] outline-none hover:decoration-[var(--mark)] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Ficou alguma dúvida? Fale com o time
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </a>
        </Reveal>

        <div className="flex flex-col border-t border-foreground/80">
          {FAQ.map(({ q, a }, i) => (
            <Reveal key={q} delay={i * 40}>
              <details className="group border-b border-border py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-baseline gap-5 rounded-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  <span className="time-label w-6 shrink-0 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 text-[1.0625rem] leading-snug font-medium sm:text-[1.125rem]">
                    {q}
                  </span>
                  <span
                    aria-hidden
                    className="relative size-4 shrink-0 text-muted-foreground"
                  >
                    <span className="absolute top-1/2 left-0 h-px w-4 -translate-y-1/2 bg-current" />
                    <span className="absolute top-1/2 left-0 h-px w-4 -translate-y-1/2 rotate-90 bg-current transition-transform duration-200 group-open:rotate-0" />
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl pl-11 text-[0.9375rem] leading-7 text-muted-foreground">{a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
