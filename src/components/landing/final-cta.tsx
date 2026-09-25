import { Reveal } from "@/components/landing/reveal";
import { SignupButton, TrialTerms } from "@/components/landing/signup-cta";
import { SectionMark } from "@/components/landing/section-heading";

/**
 * O fecho: uma frase com o destaque na cor da marca, uma linha e UM botão.
 *
 * Vem por último de propósito — quem chegou até aqui já leu as respostas e
 * só precisa da porta. Por isso não repete argumento nenhum e não oferece
 * segunda ação: o convite para falar com o time já ficou para trás, discreto,
 * para quem precisava dele.
 */
export function FinalCta() {
  return (
    // O fim do expediente: a única faixa escura que fecha a página, e a última
    // linha da agenda do dia.
    <section className="band-dark bg-plum-900 py-24 text-blush-50 sm:py-36">
      <Reveal className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 text-center sm:px-6">
        <SectionMark time="19:00" label="Fim do expediente" tone="dark" align="center" />
        <h2 className="mt-7 text-[2.25rem] leading-[1.08] text-balance sm:text-[3.5rem]">
          Comece agora. <em>Seu link no ar ainda hoje.</em>
        </h2>
        <p className="mt-7 max-w-xl text-[1.0625rem] leading-7 text-blush-50/75">
          Crie a conta, cadastre seus procedimentos e horários e compartilhe o
          link. O lembrete no WhatsApp faz o resto.
        </p>
        <SignupButton from="final" tone="light" className="mt-10">
          Começar grátis
        </SignupButton>
        <TrialTerms tone="light" className="mt-6 justify-center" />
      </Reveal>
    </section>
  );
}
