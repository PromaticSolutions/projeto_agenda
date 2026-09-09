import type { Metadata } from "next";
import { IBM_Plex_Mono, Nunito_Sans, Playfair_Display } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import "./globals.css";

/**
 * Par tipográfico do sistema.
 *
 * Substituiu IBM Plex Sans, que era um grotesco corporativo escolhido para ler
 * como "software profissional de gestão". A leitura estava correta e era o
 * problema: quem contrata o Timely trabalha com estética, e a página inteira
 * soava como ferramenta de TI. A decisão anterior está no DECISIONS.md e foi
 * revertida de propósito.
 *
 * Playfair Display nos títulos é a voz editorial que o setor reconhece — a
 * serifa de alto contraste de revista e de vitrine de salão. Só em corpo
 * grande: abaixo de ~1.25rem o contraste entre hastes finas e grossas começa a
 * quebrar, e por isso ela NÃO desce para rótulo, tabela ou botão.
 *
 * Nunito Sans no corpo é humanista de terminações arredondadas: mantém a
 * altura-x alta que uma interface densa precisa, sem a rigidez do grotesco.
 * As duas são variáveis no Google Fonts, então dispensam lista de pesos.
 */
const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
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
      className={`${nunitoSans.variable} ${playfairDisplay.variable} ${ibmPlexMono.variable} h-full antialiased`}
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
