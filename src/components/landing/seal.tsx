import { cn } from "@/lib/utils";

/**
 * Selo flutuante das composições do hero.
 *
 * Sempre montado, nunca desmontado: aparecer é `opacity` + `translate`, as
 * duas propriedades que o compositor resolve sozinho. Trocar isso por
 * montagem condicional faria o navegador recalcular layout a cada passo.
 *
 * Mora num arquivo próprio porque os três slides do carrossel usam o mesmo
 * objeto — e é ele que dá unidade visual entre a agenda, o celular e o painel
 * de números, que por dentro não têm nada em comum.
 */
export function Seal({
  shown,
  className,
  style,
  children,
}: {
  shown: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        "absolute items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur-sm",
        "transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}
