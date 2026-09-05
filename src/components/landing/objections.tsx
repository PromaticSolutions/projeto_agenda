import { Reveal } from "@/components/landing/reveal";

/**
 * Objeções.
 *
 * Cada resposta foi conferida contra o código, e duas delas dizem "não" ou
 * "ainda não" de propósito:
 *
 *  - múltiplos profissionais: não existe cadastro de equipe no banco (nenhuma
 *    tabela de staff em supabase/migrations). Prometer isso aqui geraria um
 *    cadastro frustrado no primeiro dia de uso;
 *  - responder mensagem: o produto ENVIA, não recebe (ver DECISIONS.md). A
 *    conversa continua sendo sua.
 *
 * `<details>` nativo em vez de acordeão em JavaScript: abre sem hidratação,
 * é acessível por teclado de graça, e o conteúdo fica no HTML — o que também
 * significa que buscador e leitor de tela encontram as respostas.
 */

const FAQ = [
  {
    q: "Preciso entender de tecnologia?",
    a: "Não. Você cadastra seus procedimentos e horários uma vez, e o resto acontece sozinho. A proposta é justamente tirar trabalho da sua rotina, não acrescentar.",
  },
  {
    q: "Funciona para quem trabalha sozinho?",
    a: "Sim, e é o caso mais direto: uma agenda, os seus procedimentos, os seus horários. Não precisa ter espaço próprio nem equipe.",
  },
  {
    q: "Minhas clientes precisam baixar alguma coisa?",
    a: "Não. Elas abrem o seu link, escolhem o horário e informam nome e telefone. Sem cadastro, sem senha, sem aplicativo.",
  },
  {
    q: "Posso continuar usando o meu WhatsApp?",
    a: "É exatamente assim que funciona. Você conecta o seu próprio número lendo um QR code, e os lembretes saem por ele, com o seu nome. Quando a cliente responde, a conversa chega para você — o Timely envia, não responde por você.",
  },
  {
    q: "Dá para gerenciar vários profissionais?",
    a: "Ainda não. Hoje o Timely trabalha com uma agenda por conta. Se o seu espaço tem várias pessoas atendendo em paralelo, essa divisão não existe no sistema.",
  },
  {
    q: "Meus dados ficam seguros?",
    a: "Cada conta só alcança os próprios dados, e isso é imposto no banco — não apenas na tela. Todo o tráfego é por conexão segura.",
  },
];

export function Objections() {
  return (
    <section id="duvidas" className="scroll-mt-16 border-b border-border bg-muted/40 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <Reveal sectionName="duvidas">
          <p className="section-label text-primary">Dúvidas</p>
          <h2 className="mt-3 text-[2rem] leading-[1.15] font-semibold tracking-tight text-balance text-foreground sm:text-[2.5rem]">
            O que costumam perguntar antes de começar.
          </h2>
        </Reveal>

        <div className="mt-10 flex flex-col gap-3">
          {FAQ.map(({ q, a }, i) => (
            <Reveal key={q} delay={i * 40}>
              <details className="panel group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  {q}
                  <span
                    aria-hidden
                    className="relative size-4 shrink-0 text-muted-foreground"
                  >
                    <span className="absolute top-1/2 left-0 h-px w-4 -translate-y-1/2 bg-current" />
                    <span className="absolute top-1/2 left-0 h-px w-4 -translate-y-1/2 rotate-90 bg-current transition-transform duration-200 group-open:rotate-0" />
                  </span>
                </summary>
                <p className="mt-3 text-[0.9375rem] leading-6 text-muted-foreground">{a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
