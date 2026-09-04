import { AuthParticles } from "@/components/auth/auth-particles";
import { AuthShowcasePanel } from "@/components/auth/brand-mark";
import { GlassKnotBackdrop } from "@/components/auth/glass-knot";

/**
 * Moldura comum das telas de autenticação: superfície escura, a marca em
 * vidro girando ao fundo, campo de partículas por cima dela e, em telas
 * largas, o painel de apresentação à esquerda.
 *
 * O fundo 3D e as partículas ficam numa ÚNICA camada no nível do shell, e não
 * uma por coluna: assim atravessam a tela inteira, sem emenda visível na
 * divisa entre o painel e o formulário.
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
      {/* Ordem importa: o nó pinta o próprio plum de fundo (é opaco, para o
          vidro ter o que refratar), então precisa vir ANTES das partículas. */}
      <GlassKnotBackdrop />
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

/**
 * Assinatura discreta abaixo do cartão.
 *
 * Existe sobretudo no celular, onde a coluna de apresentação não aparece e o
 * formulário ficaria flutuando sem nada que diga de quem é o sistema. Em tela
 * larga ela repete, em miniatura, o que o rodapé da coluna já diz — repetição
 * barata, e o alinhamento vertical do cartão fica melhor com ela do que sem.
 */
export function AuthFooter() {
  return (
    <p className="text-xs text-blush-50/45">
      Timely <span aria-hidden>·</span> Promatic Solutions
    </p>
  );
}

/** Superfície do formulário: translúcida de propósito, para as partículas
 *  continuarem visíveis por trás sem prejudicar a leitura do conteúdo. */
export const AUTH_CARD_CLASS =
  "w-full max-w-sm overflow-hidden rounded-lg border border-white/12 bg-white/[0.04] backdrop-blur-md";
