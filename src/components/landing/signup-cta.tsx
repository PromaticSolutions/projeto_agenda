"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

/**
 * A ação principal da landing: criar a conta.
 *
 * Toda chamada da página passa por aqui — hero, meio, preço, fecho — e todas
 * levam para o MESMO lugar, /signup. O texto muda conforme o momento da
 * leitura ("Começar grátis", "Quero experimentar", "Começar agora"); o destino
 * não. Duas ações disputando a atenção é o que faz a pessoa não tomar nenhuma.
 *
 * `from` vai para o evento de clique: é o que diz QUAL chamada converteu.
 *
 * `tone="light"` é o botão claro das faixas plum. A cor do rótulo é
 * `text-[var(--plum-900)]` e não `text-plum-900`, que o globals.css redefine
 * para a cor de texto do tema — no escuro ela é clara e sumia no botão.
 */
export function SignupButton({
  from,
  children = "Começar grátis",
  tone = "primary",
  className,
}: {
  from: string;
  children?: React.ReactNode;
  tone?: "primary" | "light";
  className?: string;
}) {
  return (
    <Button
      size="lg"
      nativeButton={false}
      onClick={() => track("signup_click", { from })}
      render={<Link href="/signup" />}
      // Botão de tinta: o preto-vinho do papel, não o violeta de sistema — na
      // landing a cor forte é reservada ao destaque dos títulos. Mais alto que
      // o `lg` do painel porque aqui ele é o alvo da página, não uma ação
      // entre várias.
      className={cn(
        "h-12 gap-2 rounded-md px-5 text-[0.9375rem] has-data-[icon=inline-end]:pr-4",
        tone === "light"
          ? "bg-blush-50 text-[var(--plum-900)] hover:bg-white"
          : "bg-foreground text-background hover:bg-[var(--violet-600)] hover:text-white",
        className
      )}
    >
      {children}{" "}
      <ArrowRight className="size-4 transition-transform duration-200 group-hover/button:translate-x-0.5 motion-reduce:transition-none" />
    </Button>
  );
}

/**
 * As condições da oferta, logo abaixo do botão. É a resposta às três
 * perguntas que travam o clique — "quanto custa?", "vão me cobrar?", "fico
 * preso?" — no lugar exato em que elas aparecem.
 */
export const TRIAL_TERMS = ["30 dias grátis", "Sem cartão de crédito", "Cancele quando quiser"];

export function TrialTerms({
  tone = "default",
  className,
}: {
  tone?: "default" | "light";
  className?: string;
}) {
  return (
    // Separadas por ponto médio, em mono: é nota de rodapé da oferta, não
    // uma lista de benefícios com check verde.
    <ul
      className={cn(
        "time-label flex flex-wrap items-center gap-x-2.5 gap-y-1",
        tone === "light" && "text-blush-50/70",
        className
      )}
    >
      {TRIAL_TERMS.map((term, i) => (
        <li key={term} className="flex items-center gap-2.5">
          {i > 0 && <span aria-hidden>·</span>}
          {term}
        </li>
      ))}
    </ul>
  );
}
