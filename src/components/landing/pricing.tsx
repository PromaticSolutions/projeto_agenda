import { Check } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { SignupButton } from "@/components/landing/signup-cta";
import { cn } from "@/lib/utils";

/**
 * Preço — os dois momentos do mesmo plano, lado a lado.
 *
 * Não são dois planos: é o mesmo Timely completo, primeiro grátis e depois
 * pago. Mostrar os dois cartões responde de uma vez "quanto custa?" e "vou
 * pagar agora?", e os DOIS botões levam ao cadastro — não existe escolha a
 * fazer aqui, só a mesma porta vista pelos dois lados.
 *
 * O cartão do teste é o destacado: é a oferta de entrada, a que a pessoa
 * aceita hoje. O preço mensal fica visível e sem letra miúda, porque
 * esconder o valor é o que faz alguém sair para procurar em outro lugar.
 *
 * ATENÇÃO: o cadastro hoje não cria sozinho uma assinatura em teste — a
 * cobrança é lançada pelo /superadmin. A oferta daqui é a condição comercial;
 * se o fluxo de cobrança mudar, estes valores mudam junto.
 */

export const MONTHLY_PRICE = "R$ 39,90";
export const TRIAL_DAYS = 30;

const INCLUDED = [
  "Acesso completo ao Timely",
  "Todos os recursos incluídos",
  "Sem cartão de crédito para começar",
  "Sem fidelidade",
  "Cancele quando quiser",
];

export function Pricing() {
  return (
    <section id="preco" className="scroll-mt-16 border-b border-foreground/15 bg-background py-24 sm:py-32">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <Reveal sectionName="preco" className="mx-auto max-w-2xl">
          <SectionHeading
            align="center"
            time="16:00"
            eyebrow="Preço"
            lead="Comece grátis."
            trail="Sem compromisso."
          />
          <p className="mt-5 text-center text-[1.0625rem] leading-7 text-muted-foreground">
            Experimente o Timely por um mês completo e descubra uma forma mais
            simples de organizar o seu negócio.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-2 md:items-stretch">
          <PlanCard
            featured
            badge="Comece por aqui"
            name="Teste grátis"
            price="R$ 0"
            period={`por ${TRIAL_DAYS} dias`}
            description="O Timely completo, do primeiro dia. Sem cartão de crédito."
            cta="Começar meus 30 dias grátis"
            from="preco_teste"
          />
          <PlanCard
            delay={90}
            name="Timely"
            price={MONTHLY_PRICE}
            period="por mês"
            description={`Depois dos ${TRIAL_DAYS} dias, se você quiser continuar.`}
            cta="Começar grátis"
            from="preco_mensal"
          />
        </div>

        <Reveal>
          <p className="time-label mt-8 text-center">
            Você só começa a pagar depois do período gratuito.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function PlanCard({
  featured = false,
  badge,
  name,
  price,
  period,
  description,
  cta,
  from,
  delay,
}: {
  featured?: boolean;
  badge?: string;
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  from: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      {/* Dois cartões elevados, soltos do fundo. O teste é o invertido —
          tinta com letra de papel — e é o destaque da oferta. */}
      <div
        className={cn(
          "card-elevated flex h-full flex-col rounded-2xl p-7 sm:p-10",
          featured
            ? "border border-foreground bg-foreground text-background"
            : "border border-border bg-card text-foreground"
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-semibold">{name}</h3>
          {badge && (
            <span className="rounded-full bg-background/15 px-2.5 py-1 text-xs font-semibold text-background">
              {badge}
            </span>
          )}
        </div>

        <p className="mt-8 flex items-baseline gap-3">
          <span className="text-[3rem] leading-none font-semibold tracking-[-0.03em] tabular-nums">
            {price}
          </span>
          <span className={featured ? "text-background/70" : "text-muted-foreground"}>{period}</span>
        </p>
        <p className={cn("mt-4 text-[0.9375rem] leading-6", featured ? "text-background/75" : "text-muted-foreground")}>
          {description}
        </p>

        <ul className={cn("mt-8 border-t", featured ? "border-background/20" : "border-border")}>
          {INCLUDED.map((item) => (
            <li
              key={item}
              className={cn(
                "flex items-baseline gap-3 border-b py-3 text-[0.9375rem] leading-6",
                featured ? "border-background/20" : "border-border"
              )}
            >
              <Check
                className={cn("size-3.5 shrink-0 translate-y-0.5", featured ? "text-[#c4b0fb]" : "text-[var(--mark)]")}
                strokeWidth={2.5}
                aria-hidden
              />
              {item}
            </li>
          ))}
        </ul>

        {/* `mt-auto` no invólucro: os dois botões alinham na mesma linha
            mesmo quando uma descrição quebra em duas linhas e a outra não. */}
        <div className="mt-auto pt-9">
          {/* No bloco invertido o botão é de papel sobre tinta — com as cores
              do tema, e não o `tone="light"` fixo, porque no escuro a tinta
              vira clara e o botão claro sumiria nela. */}
          <SignupButton
            from={from}
            className={cn("w-full", featured && "bg-background text-foreground")}
          >
            {cta}
          </SignupButton>
        </div>
      </div>
    </Reveal>
  );
}
