import { cn } from "@/lib/utils";

/**
 * Nota de margem das composições do hero.
 *
 * Era um selo flutuante, pendurado no canto do cartão e balançando — o
 * elemento que mais denunciava a página como "feita no molde". Virou o que
 * uma agenda de papel tem de verdade: a anotação ao pé da página, em linha,
 * sem sombra e sem movimento contínuo.
 *
 * Sempre montada: aparecer é só `opacity`, que o compositor resolve sozinho.
 * O espaço fica reservado mesmo invisível, então a nota que chega no fim da
 * sequência não empurra nada.
 */
export function Seal({
  shown,
  className,
  children,
}: {
  shown: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      aria-hidden
      className={cn(
        "mt-3 mr-5 inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground",
        "transition-opacity duration-500 ease-out motion-reduce:transition-none",
        "[&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-[var(--mark)]",
        shown ? "opacity-100" : "opacity-0",
        className
      )}
    >
      {children}
    </p>
  );
}
