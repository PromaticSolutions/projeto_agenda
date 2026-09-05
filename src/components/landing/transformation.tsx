import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { cn } from "@/lib/utils";

/**
 * Antes → Timely → Depois, em três tempos.
 *
 * A versão anterior comparava duas listas de seis itens cada. Virou três
 * colunas de três palavras: o valor desta seção é o CONTRASTE, e contraste se
 * lê em um relance — doze linhas de texto o transformam em leitura.
 *
 * A coluna do meio é a única com cor e peso: é a que responde "e o que muda?".
 */

const BEATS = [
  {
    label: "Antes",
    items: ["WhatsApp lotado", "Caderno e planilha", "Confirmação na mão", "Horários espalhados"],
    tone: "before" as const,
  },
  {
    label: "Com o Timely",
    items: ["Uma agenda só", "Clientes e procedimentos", "Lembrete automático", "Seu link público"],
    tone: "now" as const,
  },
  {
    label: "Depois",
    items: ["Mais controle", "Mais tempo", "Menos esquecimento", "Rotina previsível"],
    tone: "after" as const,
  },
];

export function Transformation() {
  return (
    <section className="border-b border-border bg-muted/40 py-20 sm:py-24">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:gap-3">
          {BEATS.map((beat, i) => (
            <Reveal key={beat.label} delay={i * 110} className="contents">
              <>
                <div
                  className={cn(
                    "flex flex-col rounded-xl border p-6",
                    beat.tone === "now"
                      ? "border-primary/35 bg-card shadow-[var(--shadow-lift)]"
                      : "border-border bg-transparent"
                  )}
                >
                  <p
                    className={cn(
                      "section-label",
                      beat.tone === "now" ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {beat.label}
                  </p>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {beat.items.map((item) => (
                      <li
                        key={item}
                        className={cn(
                          "text-[0.9375rem] leading-6",
                          beat.tone === "now"
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* As setas só existem no desktop, onde há eixo horizontal
                    para elas apontarem. Empilhado, a ordem já é a leitura. */}
                {i < BEATS.length - 1 && (
                  <div className="hidden items-center justify-center lg:flex">
                    <ArrowRight className="size-5 text-muted-foreground/50" aria-hidden />
                  </div>
                )}
              </>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
