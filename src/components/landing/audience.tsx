import { Reveal } from "@/components/landing/reveal";

/**
 * "Para quem é."
 *
 * Chips em vez de cards com ícone: são onze perfis, e onze cards ilustrados
 * viram uma parede que ninguém lê. Em chip a pessoa varre a lista e encontra
 * o seu em um segundo — que é a única coisa que esta seção precisa entregar.
 *
 * A linha final é importante: o produto atende UMA agenda por conta hoje
 * (não há cadastro de equipe no sistema), e dizer isso aqui evita que um
 * salão com cinco profissionais se cadastre esperando cinco agendas.
 */

const AUDIENCE = [
  "Salão de beleza",
  "Cabeleireiro(a)",
  "Barbeiro(a)",
  "Manicure",
  "Nail designer",
  "Lash designer",
  "Designer de sobrancelhas",
  "Esteticista",
  "Maquiador(a)",
  "Depilação",
  "Estúdio de beleza",
];

export function Audience() {
  return (
    <section className="border-b border-border bg-muted/40 py-20 sm:py-24">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <Reveal sectionName="para_quem">
          <h2 className="max-w-2xl text-[2rem] leading-[1.12] font-semibold tracking-tight text-balance text-foreground sm:text-[2.5rem]">
            Feito para quem vive de horários.
          </h2>
        </Reveal>

        <Reveal delay={80} className="mt-9">
          <ul className="flex flex-wrap gap-2.5">
            {AUDIENCE.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-[0.9375rem] text-foreground transition-colors hover:border-primary/45 hover:text-primary"
              >
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
