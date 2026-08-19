import { AuthParticles } from "@/components/auth/auth-particles";
import { AuthShowcasePanel } from "@/components/auth/brand-mark";

/**
 * Moldura comum das telas de autenticação: superfície escura, campo de
 * partículas ao fundo e, em telas largas, o painel de apresentação à esquerda.
 *
 * As partículas ficam numa ÚNICA camada no nível do shell, e não uma por
 * coluna: assim elas atravessam a tela inteira, sem emenda visível na divisa
 * entre o painel e o formulário.
 */
export function AuthShell({
  children,
  showcase = true,
}: {
  children: React.ReactNode;
  /** Telas curtas (recuperar/redefinir senha) dispensam o painel lateral. */
  showcase?: boolean;
}) {
  return (
    <div className="relative flex flex-1 overflow-hidden bg-plum-900 text-blush-50">
      <AuthParticles count={70} />

      <div className="relative z-10 flex flex-1 lg:grid lg:grid-cols-2">
        {showcase && <AuthShowcasePanel className="hidden lg:flex" />}
        <div className="flex flex-1 flex-col items-center justify-center gap-7 px-4 py-14 sm:px-6 lg:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Superfície do formulário: translúcida de propósito, para as partículas
 *  continuarem visíveis por trás sem prejudicar a leitura do conteúdo. */
export const AUTH_CARD_CLASS =
  "w-full max-w-sm overflow-hidden rounded-lg border border-white/12 bg-white/[0.04] backdrop-blur-md";
