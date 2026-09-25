import type { Metadata } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import "./globals.css";

/**
 * Tipografia do sistema: UMA família, Plus Jakarta Sans, em tudo — título,
 * corpo, botão, tabela.
 *
 * Já foram três vozes: Nunito Sans no corpo, Playfair Display (serifa de alto
 * contraste) nos títulos e Jakarta só na landing. Lado a lado, o painel
 * parecia montado com peças de lugares diferentes, e a Playfair em título
 * grande virava ruído — hastes finíssimas e terminais cheios de desenho
 * disputando atenção com o conteúdo. Uma família só deixa a hierarquia por
 * conta de peso e tamanho, que é o que uma interface de trabalho precisa.
 *
 * Jakarta é um grotesco geométrico com altura-x generosa: segura título
 * grande em semibold com tracking fechado e continua legível em 12px numa
 * tabela. É variável no Google Fonts, então dispensa lista de pesos.
 */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

/**
 * IBM Plex Mono sobreviveu à troca, e com um papel bem menor: agora só
 * IDENTIFICADOR — nome de instância do WhatsApp, slug do link público, chave.
 * Horário e valor saíram do mono e viraram `tabular-nums` no corpo, que alinha
 * a coluna sem o ar de terminal. Não é variável; os pesos vão declarados.
 */
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Timely — Promatic Solutions",
  description: "Sistema de agendamento online para negócios de horário marcado.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${jakarta.variable} ${ibmPlexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <Toaster position="top-center" richColors />
          {/* No layout RAIZ, e não na landing: o aviso é do site inteiro. Quem
              chega direto num link público de agendamento ou na tela de login
              vê o mesmo cartão, e a escolha feita ali vale para tudo. */}
          <CookieConsentBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
