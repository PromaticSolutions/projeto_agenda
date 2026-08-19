import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * A marca do Timely em imagem estática, para uso fora das telas de
 * autenticação.
 *
 * É o mesmo nó de vidro de `components/auth/glass-knot.tsx`, mas renderizado
 * uma vez e salvo como PNG. Nas telas de auth a peça gira ao vivo em WebGL
 * porque ali ela é o assunto; dentro do painel e na página de agendamento ela
 * é só identificação, e não vale um contexto gráfico por página numa
 * ferramenta de trabalho que fica aberta o dia inteiro.
 *
 * Para regerar o PNG, veja a pose estática usada em `prefers-reduced-motion`.
 */
export function SystemLogo({
  className,
  size = 40,
}: {
  className?: string;
  /** Lado em pixels do arquivo pedido ao otimizador. O tamanho na tela é do
   *  CSS — passe o dobro do exibido para a imagem não sair mole em telas
   *  de alta densidade. */
  size?: number;
}) {
  return (
    <Image
      src="/brand/logo.png"
      alt="Timely"
      width={size}
      height={size}
      className={cn("block object-contain", className)}
    />
  );
}
