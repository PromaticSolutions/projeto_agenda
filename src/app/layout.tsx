import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

/**
 * Par tipográfico do sistema. Substituiu Plus Jakarta Sans + Fraunces: a
 * primeira é a fonte-assinatura de dashboard gerado por IA e a segunda é uma
 * display com eixos SOFT/WONK (literalmente "torto"), incompatível com a
 * leitura de "software profissional de gestão" pedida.
 *
 * IBM Plex Sans é um grotesco corporativo desenhado para interface densa:
 * altura-x alta, dígitos de largura constante e formas sóbrias. É variável no
 * Google Fonts, então dispensa lista de pesos.
 */
const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

/** IBM Plex Mono não é variável — os pesos precisam ser declarados. Usada
 *  para dado tabular (horários, valores, identificadores). */
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agenda Online — Promatic Solutions",
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
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
