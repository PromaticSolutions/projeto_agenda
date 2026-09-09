"use client";

import { Clock3 } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { track } from "@/lib/analytics";

/**
 * "Para quem é" — e, ao trocar de perfil, a demonstração troca junto.
 *
 * A versão anterior era uma fila de onze chips: informava, mas não mostrava
 * nada. Aqui cada perfil abre a MESMA tela do produto configurada como aquele
 * negócio configuraria — os procedimentos, as durações e os valores mudam,
 * porque é isso que muda de verdade entre uma barbearia e um studio de cílios.
 *
 * O que NÃO muda é o argumento: a duração de cada procedimento é o que
 * permite ao sistema calcular o encaixe (ver `lib/availability.ts`), e a
 * última linha de cada painel mostra exatamente isso acontecendo.
 *
 * Os valores são EXEMPLOS de configuração, e estão rotulados como tal. Não
 * são preço médio de mercado, nem pesquisa: seria número inventado, e a
 * página inteira perde crédito por um dado desses.
 *
 * "Equipe" ficou DE FORA de propósito: hoje o Timely trabalha com uma agenda
 * por conta (não há tabela de staff no banco), e uma aba prometendo divisão
 * entre profissionais viraria cadastro frustrado no primeiro dia. A seção de
 * dúvidas diz isso com todas as letras.
 */

const PROFILES = [
  {
    value: "autonoma",
    tab: "Autônoma(o)",
    title: "Você, sozinha, atendendo onde faz sentido",
    text: "Em casa, em espaço compartilhado ou atendendo a domicílio — uma agenda, os seus procedimentos, o seu link.",
    services: [
      ["Design de sobrancelhas", "40 min", "R$ 60,00", "var(--violet-600)"],
      ["Design com henna", "50 min", "R$ 85,00", "var(--magenta)"],
      ["Manicure", "60 min", "R$ 45,00", "#0f766e"],
      ["Pé e mão", "90 min", "R$ 70,00", "#b45309"],
    ],
    gap: ["16:20", "Design de sobrancelhas", "40 min"],
  },
  {
    value: "salao",
    tab: "Salão de beleza",
    title: "Procedimentos longos, sem buraco na agenda",
    text: "Uma coloração de duas horas não pode ser tratada como uma escova de quarenta minutos — e não é.",
    services: [
      ["Escova", "45 min", "R$ 55,00", "var(--violet-600)"],
      ["Corte + finalização", "60 min", "R$ 90,00", "var(--magenta)"],
      ["Hidratação", "60 min", "R$ 120,00", "#0f766e"],
      ["Coloração", "120 min", "R$ 180,00", "#b45309"],
    ],
    gap: ["15:00", "Escova", "45 min"],
  },
  {
    value: "barbearia",
    tab: "Barbearia",
    title: "Muito atendimento curto, um atrás do outro",
    text: "Quando o dia é feito de encaixes de trinta minutos, cada horário mal aproveitado aparece no fim do mês.",
    services: [
      ["Pezinho", "15 min", "R$ 20,00", "var(--violet-600)"],
      ["Barba", "30 min", "R$ 35,00", "var(--magenta)"],
      ["Corte", "40 min", "R$ 50,00", "#0f766e"],
      ["Corte + barba", "70 min", "R$ 75,00", "#b45309"],
    ],
    gap: ["17:30", "Barba", "30 min"],
  },
  {
    value: "studio",
    tab: "Studio",
    title: "Sessões longas e retorno marcado na hora",
    text: "Cílios, estética, micropigmentação: procedimento demorado, manutenção com data — e o histórico da cliente sempre à mão.",
    services: [
      ["Limpeza de pele", "60 min", "R$ 140,00", "var(--violet-600)"],
      ["Manutenção de cílios", "90 min", "R$ 120,00", "var(--magenta)"],
      ["Extensão de cílios", "120 min", "R$ 180,00", "#0f766e"],
      ["Micropigmentação", "150 min", "R$ 450,00", "#b45309"],
    ],
    gap: ["14:00", "Limpeza de pele", "60 min"],
  },
];

export function Audience() {
  return (
    <section id="para-quem" className="scroll-mt-16 border-b border-border bg-muted/40 py-20 sm:py-24">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <Reveal sectionName="para_quem" className="max-w-2xl">
          <p className="section-label text-primary">Para quem é</p>
          <h2 className="mt-3 text-[2rem] leading-[1.12] font-semibold text-balance text-foreground sm:text-[2.5rem]">
            Feito para quem vive de horários.
          </h2>
        </Reveal>

        <Reveal delay={80} className="mt-10">
          <Tabs
            defaultValue={PROFILES[0].value}
            onValueChange={(value) => track("product_demo_interaction", { profile: value })}
          >
            {/* Rolagem horizontal no celular em vez de quebra em duas linhas:
                quatro abas empilhadas roubariam a altura da demonstração, que
                é o que a seção veio mostrar. */}
            {/* `flex-wrap`, e NÃO uma faixa rolável: o indicador da aba ativa
                é um `after` posicionado em `bottom-[-5px]`, e declarar
                `overflow-x` faria o eixo Y deixar de ser `visible` (regra do
                CSS) — o navegador então cortava o sublinhado e ainda punha
                uma barra de rolagem vertical de 10px ao lado das abas.
                Com quatro rótulos curtos, quebrar em duas linhas no celular
                custa menos que uma rolagem lateral que ninguém descobre.
                `pb-2` reserva a faixa onde o sublinhado é desenhado. */}
            <TabsList
              variant="line"
              // `h-auto!` com `!`: a altura fixa do componente vem de
              // `group-data-horizontal/tabs:h-8`, uma variante que ganha de um
              // `h-auto` simples por especificidade — e com as abas em duas
              // linhas no celular a caixa continuava com 32px, deixando a
              // segunda linha por cima do título da demonstração.
              className="h-auto! w-full max-w-full flex-wrap justify-start gap-x-1 gap-y-1.5 px-0 pt-0 pb-2"
            >
              {PROFILES.map((profile) => (
                <TabsTrigger
                  key={profile.value}
                  value={profile.value}
                  className="h-auto flex-none px-4 py-2.5 text-[0.9375rem]"
                >
                  {profile.tab}
                </TabsTrigger>
              ))}
            </TabsList>

            {PROFILES.map((profile) => (
              <TabsContent key={profile.value} value={profile.value} className="pt-8">
                <div className="grid gap-7 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-12">
                  <div>
                    <h3 className="text-[1.375rem] leading-snug font-semibold tracking-tight text-balance text-foreground sm:text-[1.5rem]">
                      {profile.title}
                    </h3>
                    <p className="mt-3 text-[1.0625rem] leading-7 text-muted-foreground">
                      {profile.text}
                    </p>
                  </div>

                  <div className="panel overflow-hidden">
                    <header className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
                      <p className="section-label text-muted-foreground">
                        Exemplo de configuração
                      </p>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        duração · valor
                      </span>
                    </header>

                    <ol className="divide-y divide-border">
                      {profile.services.map(([name, duration, price, color]) => (
                        <li key={name} className="flex items-center gap-3 px-4 py-3">
                          <span
                            aria-hidden
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                            {name}
                          </span>
                          <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                            {duration}
                          </span>
                          <span className="w-20 shrink-0 text-right tabular-nums text-sm text-foreground">
                            {price}
                          </span>
                        </li>
                      ))}
                    </ol>

                    {/* É aqui que a duração deixa de ser enfeite: ela é o que
                        o sistema usa para dizer o que cabe no buraco. */}
                    <footer className="flex items-center gap-2.5 border-t border-border bg-muted/50 px-4 py-3">
                      <Clock3 className="size-4 shrink-0 text-primary" aria-hidden />
                      <p className="text-sm text-muted-foreground">
                        Livre às{" "}
                        <span className="tabular-nums text-foreground">{profile.gap[0]}</span> — cabe{" "}
                        <span className="text-foreground">{profile.gap[1]}</span> ({profile.gap[2]})
                      </p>
                    </footer>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </Reveal>

        <Reveal delay={140}>
          <p className="mt-8 text-sm leading-6 text-muted-foreground">
            Hoje o Timely trabalha com uma agenda por conta. Se o seu espaço
            tem várias pessoas atendendo em paralelo, essa divisão ainda não
            existe no sistema.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
