"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CONSENT_UNKNOWN,
  clearConsent,
  consentServerSnapshot,
  consentSnapshot,
  isConsentCurrent,
  parseConsent,
  subscribeConsent,
  writeConsent,
} from "@/lib/consent";
import { cn } from "@/lib/utils";

/**
 * Aviso de cookies.
 *
 * FLUTUANTE, NÃO BLOQUEANTE. Um modal que trava a página até alguém clicar
 * irrita quem chegou para ler e, por coagir o clique, enfraquece justamente o
 * consentimento que diz coletar. Pior ainda no fluxo público de agendamento,
 * onde a pessoa chegou por um link para marcar um horário: qualquer coisa
 * entre ela e o botão de confirmar é abandono. Este cartão fica no canto e a
 * página segue utilizável.
 *
 * UMA AÇÃO SÓ, e isso é honestidade, não atalho. Não existe cookie de
 * rastreamento neste site hoje: o "Aceitar" grava `analytics: false`, porque
 * não há analytics para autorizar. Oferecer "recusar" ao lado sugeriria que
 * existe algo sendo recusado — teatro de consentimento, que é o oposto do que
 * a LGPD pede. Quando um provedor for ligado, a categoria `analytics` já
 * existe em `lib/consent.ts` e este cartão ganha o segundo botão sem que
 * cookie, gate ou política precisem ser refeitos.
 *
 * Some quando existe decisão VIGENTE. Subir a `POLICY_VERSION` faz ele voltar
 * para todo mundo, que é o gatilho de repergunta.
 */
export function CookieConsentBanner() {
  const raw = useSyncExternalStore(subscribeConsent, consentSnapshot, consentServerSnapshot);
  const [leaving, setLeaving] = useState(false);

  // O instantâneo é a string crua (ver a nota em `lib/consent.ts`); o parse
  // fica aqui, memorizado, para não recriar o objeto a cada render.
  const record = useMemo(() => parseConsent(raw), [raw]);

  const accept = useCallback(() => {
    /* Sai animando: gravar o cookie e desmontar no mesmo quadro faria o cartão
       sumir sem que o clique tivesse tido resposta visível. */
    setLeaving(true);
    window.setTimeout(() => {
      writeConsent(false);
      setLeaving(false);
    }, 220);
  }, []);

  /* `CONSENT_UNKNOWN` é o servidor e o primeiro quadro da hidratação, e é
     DIFERENTE de "não existe cookie". Sem essa distinção o cartão entraria no
     HTML de toda visita — inclusive de quem respondeu meses atrás — para ser
     escondido na hidratação, piscando em cada carregamento. */
  if (raw === CONSENT_UNKNOWN || isConsentCurrent(record)) return null;

  return (
    <Card
      role="region"
      aria-label="Aviso de cookies"
      className={cn(
        /* Canto inferior DIREITO em tela larga. O centro é onde mora a
           composição do produto no hero; a esquerda, no painel, é a barra de
           navegação. Sobra a direita, que em toda tela do sistema é área de
           conteúdo — o cartão cobre texto por alguns segundos, nunca um
           controle. No celular ocupa a largura, onde não existe canto que
           sobre. */
        "fixed right-4 bottom-4 left-4 z-[60] gap-0 py-4 shadow-2xl shadow-black/20",
        "bg-card/95 backdrop-blur-md sm:left-auto sm:max-w-sm",
        "transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
        leaving ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
      )}
    >
      <CardContent className="flex gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <Cookie className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">Sobre os cookies</p>
          {/* Curto e específico. Ninguém lê política em banner, e o que
              importa aqui cabe em duas linhas: o que existe (sessão) e o que
              não existe (rastreamento). */}
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Usamos apenas o essencial: o cookie que mantém você conectada depois
            de entrar. Não há cookies de rastreamento nem de publicidade.
          </p>

          <div className="mt-3.5 flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={accept}>
              Aceitar
            </Button>
            <Link
              href="/politica-de-privacidade"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Política de Privacidade
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * O caminho de volta, no rodapé. Poder rever a decisão com a mesma facilidade
 * com que ela foi dada é parte do que a LGPD pede — e é por aqui que o modal
 * de preferências vai ser aberto quando existir mais de uma categoria para
 * escolher. Some enquanto o aviso está na tela: reabrir o que já está aberto
 * não faz nada.
 */
export function CookiePreferencesButton({ className }: { className?: string }) {
  const raw = useSyncExternalStore(subscribeConsent, consentSnapshot, consentServerSnapshot);
  const record = useMemo(() => parseConsent(raw), [raw]);

  if (raw === CONSENT_UNKNOWN || !isConsentCurrent(record)) return null;

  return (
    <button
      type="button"
      onClick={clearConsent}
      className={cn("text-muted-foreground hover:text-foreground", className)}
    >
      Cookies
    </button>
  );
}
