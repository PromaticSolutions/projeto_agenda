"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

/**
 * Aparição no scroll, com o mínimo de JavaScript.
 *
 * Um IntersectionObserver por elemento, que se DESLIGA depois de disparar —
 * animação de entrada acontece uma vez, e manter dezenas de observers vivos
 * durante todo o scroll é custo sem retorno numa página que precisa ser
 * rápida no celular.
 *
 * O movimento é `opacity` + `translateY`, as duas propriedades que o
 * compositor resolve na GPU sem recalcular layout. Nada de `top`, `height` ou
 * `margin` animados.
 *
 * Com `prefers-reduced-motion` o conteúdo nasce visível, e isso é resolvido
 * em CSS (`motion-reduce:opacity-100`), não em JavaScript: quem pediu menos
 * movimento não deve depender de um observer disparar para ler a página.
 *
 * O estado inicial é `opacity-0`, então sem JavaScript o texto ficaria
 * invisível — por isso a página tem uma regra `<noscript>` que força a
 * visibilidade. Ver src/app/page.tsx.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  /** Quando informado, dispara `section_view` na primeira vez que entra. */
  sectionName,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  sectionName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Sem tratamento especial para reduced-motion aqui: quem pediu menos
    // movimento já recebe o conteúdo visível por CSS
    // (`motion-reduce:opacity-100`), então o observer serve só para marcar o
    // estado e disparar o evento — nos dois casos.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setShown(true);
          if (sectionName) track("section_view", { section: sectionName });
          observer.disconnect();
        }
      },
      // 12% já dentro da viewport: dispara quando o bloco começou a aparecer
      // de verdade, sem esperar ele inteiro (o que atrasaria seções altas).
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [sectionName]);

  return (
    <div
      ref={ref}
      data-shown={shown || undefined}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "translate-y-4 opacity-0 transition-[opacity,transform] duration-700 ease-out",
        "data-shown:translate-y-0 data-shown:opacity-100",
        "motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
        className
      )}
    >
      {children}
    </div>
  );
}
