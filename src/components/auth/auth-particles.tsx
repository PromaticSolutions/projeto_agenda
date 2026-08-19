import { cn } from "@/lib/utils";

/**
 * Campo de partículas flutuantes do fundo das telas de autenticação.
 *
 * Os valores são DETERMINÍSTICOS, derivados do índice por uma hash barata, e
 * não de `Math.random()`. O componente renderiza no servidor: se cada posição
 * fosse sorteada, o HTML do servidor não bateria com o do cliente e o React
 * descartaria a árvore inteira na hidratação, com aviso no console.
 *
 * Não há JavaScript em execução — o movimento é 100% CSS (ver
 * `auth-particle` em globals.css), então o custo em runtime é do compositor.
 */

/**
 * Hash inteiro → fração em [0, 1). Os multiplicadores primos espalham índices
 * vizinhos por regiões distantes do intervalo; sem isso as partículas sairiam
 * enfileiradas, porque o índice cresce de um em um.
 */
function pseudoRandom(index: number, seed: number): number {
  const x = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function lerp(t: number, min: number, max: number): number {
  return min + t * (max - min);
}

interface AuthParticlesProps {
  /** Quantidade de pontos. O padrão já é denso; acima de ~120 o ganho visual
   *  some e o número de camadas do compositor começa a pesar em telas fracas. */
  count?: number;
  className?: string;
}

export function AuthParticles({ count = 70, className }: AuthParticlesProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden text-white",
        className
      )}
    >
      {Array.from({ length: count }, (_, i) => {
        // Cada característica usa uma semente diferente para não correlacionar
        // tamanho com posição (partículas grandes só à esquerda, por exemplo).
        const left = pseudoRandom(i, 1);
        const top = pseudoRandom(i, 2);
        const size = lerp(pseudoRandom(i, 3), 2, 6);
        const opacity = lerp(pseudoRandom(i, 4), 0.1, 0.42);
        const duration = lerp(pseudoRandom(i, 5), 14, 34);
        const fadeDuration = lerp(pseudoRandom(i, 6), 6, 15);
        const delay = -lerp(pseudoRandom(i, 7), 0, 30);
        const driftX = lerp(pseudoRandom(i, 8), -26, 26);
        const driftY = lerp(pseudoRandom(i, 9), 10, 42);

        return (
          <span
            key={i}
            className="auth-particle"
            style={
              {
                left: `${(left * 100).toFixed(3)}%`,
                top: `${(top * 100).toFixed(3)}%`,
                width: `${size.toFixed(2)}px`,
                height: `${size.toFixed(2)}px`,
                "--p-opacity": opacity.toFixed(3),
                "--p-duration": `${duration.toFixed(2)}s`,
                "--p-fade-duration": `${fadeDuration.toFixed(2)}s`,
                "--p-delay": `${delay.toFixed(2)}s`,
                "--p-dx": `${driftX.toFixed(2)}px`,
                "--p-dy": `${driftY.toFixed(2)}px`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
