import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/site-header";
import { Hero } from "@/components/landing/hero";
import { Problem } from "@/components/landing/problem";
import { Solution } from "@/components/landing/solution";
import { WhatsAppDemo } from "@/components/landing/whatsapp-demo";
import { Features } from "@/components/landing/features";
import { Benefits } from "@/components/landing/benefits";
import { CostInteraction } from "@/components/landing/cost-interaction";
import { FeatureList } from "@/components/landing/feature-list";
import { Audience } from "@/components/landing/audience";
import { Pricing } from "@/components/landing/pricing";
import { Objections } from "@/components/landing/objections";
import { ContactForm } from "@/components/landing/contact-form";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/landing-footer";

/**
 * Landing page do Timely.
 *
 * Substituiu o `redirect("/login")` que existia aqui. Pessoa autenticada não
 * é redirecionada: o `proxy.ts` só protege /app, /login e /signup — e quem já
 * tem conta chegando na home provavelmente veio pelo link compartilhado, não
 * querendo entrar. O header tem "Entrar" para isso.
 *
 * A página é um Server Component que compõe as seções. As que precisam de
 * interação ("use client") são as que têm animação de scroll, simulador,
 * carousel e formulário — as demais chegam como HTML, o que mantém o
 * JavaScript da rota proporcional ao que de fato é interativo.
 *
 * UM objetivo: visitante → "Começar grátis" → cadastro. Toda chamada da
 * página leva a /signup (ver `signup-cta.tsx`); o resto existe para ajudar a
 * pessoa a tomar essa decisão.
 *
 * A ordem é a de uma landing de conversão: o que é e para quem (hero) → o
 * problema → como o Timely resolve → o produto de verdade (WhatsApp rodando e
 * as telas) → benefícios → o tempo que ela perde hoje (calculadora) → a
 * lista de funcionalidades → para quem é → preço → objeções → fecho.
 *
 * Prova social ficou DE FORA: ainda não há depoimento, número de uso ou
 * cliente real para mostrar, e inventar seria pior do que não ter. A seção
 * entra entre "para quem é" e "preço" quando houver material de verdade.
 *
 * Chamadas para o cadastro: hero, depois do produto, depois dos benefícios,
 * na calculadora, em "para quem é", nos dois cartões de preço e no fecho.
 *
 * O formulário "falar com o time" continua, discreto, depois das dúvidas:
 * alternativa para quem quer conversar antes de criar a conta, com botão
 * contornado para não disputar com o cadastro. Ele NÃO é uma pesquisa. São
 * cinco campos comerciais; o que o time
 * gostaria de saber sobre o mercado é oferecido depois do envio, opcional, na
 * tela de confirmação — a conversão nunca fica atrás de um questionário.
 */


const DESCRIPTION =
  "Sua agenda funcionando enquanto você atende: as clientes marcam pelo seu link e o lembrete sai sozinho no WhatsApp. Agenda, clientes, procedimentos e valores em um só lugar.";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Timely — agenda online para profissionais e negócios de beleza",
  description: DESCRIPTION,
  // Sobrescreve o título com padrão do layout raiz para esta rota, que é a
  // porta de entrada e precisa do benefício no título, não só da marca.
  metadataBase: new URL(siteUrl),
  alternates: { canonical: "/" },
  keywords: [
    "agenda online",
    "agendamento para salão",
    "lembrete no WhatsApp",
    "agenda para manicure",
    "agenda para barbearia",
  ],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: siteUrl,
    siteName: "Timely",
    title: "Timely — sua agenda funcionando enquanto você atende",
    description: DESCRIPTION,
    images: [
      {
        // A marca do produto, o mesmo arquivo do header e do painel.
        url: "/brand/logo.png",
        width: 256,
        height: 256,
        alt: "Timely",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Timely — sua agenda funcionando enquanto você atende",
    description: DESCRIPTION,
    images: ["/brand/logo.png"],
  },
  // Sem `icons` aqui de propósito: `src/app/favicon.ico` já existe e a
  // convenção de arquivo do Next cuida do ícone. Declarar em metadata
  // SOBRESCREVE o arquivo — e a landing passaria a ter um ícone diferente do
  // resto do sistema.
  robots: { index: true, follow: true },
};

export default function LandingPage() {
  return (
    // `.landing` escopa a paleta de papel (ver o bloco "Landing" no
    // globals.css): nada disso vaza para o painel.
    <div className="landing">
      {/* As seções entram com `opacity-0` e sobem para 1 quando o
          IntersectionObserver dispara. Sem JavaScript, esse estado inicial
          deixaria a página em branco — e é justamente o cenário de um
          rastreador ou de uma conexão que abortou o bundle. Esta regra
          neutraliza o efeito quando não há JS, mostrando tudo. */}
      <noscript>
        <style>{`[class*="opacity-0"]{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      <SiteHeader />

      <main>
        <Hero />
        <Problem />
        <Solution />
        <WhatsAppDemo />
        <Features />
        <Benefits />
        <CostInteraction />
        <FeatureList />
        <Audience />
        <Pricing />
        <Objections />
        <ContactForm />
        <FinalCta />
      </main>

      <LandingFooter />

      {/* Dados estruturados. `SoftwareApplication` é o tipo que descreve o
          produto; nenhum campo aqui afirma nota, número de avaliações ou
          preço — inventar `aggregateRating` é o caminho mais curto para uma
          penalidade manual, além de ser falso. */}
      <script
        type="application/ld+json"
        // O conteúdo é literal e montado no servidor, sem entrada de usuário.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Timely",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            description: DESCRIPTION,
            url: siteUrl,
            inLanguage: "pt-BR",
            publisher: { "@type": "Organization", name: "Promatic Solutions" },
          }),
        }}
      />
    </div>
  );
}
