"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import {
  LEAD_AGENDA_TOOLS,
  LEAD_PAIN_POINTS,
  LEAD_PROFESSIONS,
  LEAD_TEAM_SIZES,
  LEAD_WEEKLY_VOLUMES,
} from "@/lib/validation";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useHoursBand } from "@/components/landing/hours-band";

/**
 * O convite comercial, em etapas — não é pesquisa.
 *
 * A diferença entre um formulário e um questionário não está no número de
 * perguntas: está em quantas delas são OBRIGATÓRIAS. Aqui só duas telas
 * exigem resposta — o perfil e o contato. As quatro do meio seguem adiante
 * vazias se a pessoa não quiser responder, e dizem isso na tela, para ninguém
 * travar procurando o botão de pular.
 *
 * Uma pergunta por tela, com a resposta em botão grande: no celular isso é a
 * diferença entre tocar e digitar. E `answers` é um estado só — voltar uma
 * etapa devolve tudo preenchido, inclusive o texto livre.
 *
 * A faixa calculada lá em cima, na interação de custo, viaja junto sem a
 * pessoa precisar responder de novo — é contexto que ela já deu por vontade
 * própria.
 *
 * Progresso, botões e barra seguem o `onboarding-form.tsx`: quem preencher
 * este formulário e depois criar a conta encontra a mesma mecânica, e não
 * duas ideias diferentes de "formulário em etapas" no mesmo produto.
 */

/** As etapas com progresso. A abertura e a conclusão ficam fora da contagem. */
const STEPS = ["Perfil", "Agenda", "Rotina", "Volume", "Melhorias", "Contato"] as const;
const LAST_STEP = STEPS.length;

type Answers = {
  name: string;
  business_name: string;
  profession: string;
  team_size: string;
  agenda_tools: string[];
  pain_points: string[];
  weekly_volume: string;
  improvement_wish: string;
  phone: string;
  email: string;
  privacy_accepted: boolean;
};

const EMPTY: Answers = {
  name: "",
  business_name: "",
  profession: "",
  team_size: "",
  agenda_tools: [],
  pain_points: [],
  weekly_volume: "",
  improvement_wish: "",
  phone: "",
  email: "",
  privacy_accepted: false,
};

export function ContactForm() {
  // 0 é a abertura; 1..6 são as etapas; a conclusão é `done`.
  const [screen, setScreen] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { band } = useHoursBand();

  // Foco no título a cada troca de tela: sem isso quem navega por teclado
  // continua com o foco num botão que acabou de sair da tela, e quem usa
  // leitor de tela não é avisado de que a pergunta mudou. `preventScroll`
  // porque o cartão já está em tela — rolar aqui só embaralharia a leitura.
  useEffect(() => {
    if (screen === 0) return;
    headingRef.current?.focus({ preventScroll: true });
  }, [screen]);

  function begin() {
    if (startedRef.current) return;
    startedRef.current = true;
    track("form_started");
  }

  function set<K extends keyof Answers>(key: K, value: Answers[K]) {
    begin();
    setError(null);
    setErrorField(null);
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function toggle(key: "agenda_tools" | "pain_points", value: string) {
    const current = answers[key];
    set(key, current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  }

  function goNext() {
    // Validado aqui, e não com o botão desabilitado: um CTA cinza na primeira
    // olhada parece defeito e não diz o que falta. Clicável + mensagem
    // específica converte melhor do que bloqueado + silêncio.
    if (screen === 1 && !answers.profession) {
      setErrorField("profession");
      setError("Escolha o que você faz para continuarmos.");
      return;
    }

    if (screen > 0) track("form_step_completed", { step: STEPS[screen - 1] });
    setError(null);
    setErrorField(null);
    setScreen((current) => Math.min(LAST_STEP, current + 1));
  }

  function goBack() {
    setError(null);
    setErrorField(null);
    setScreen((current) => Math.max(0, current - 1));
  }

  async function submit() {
    setError(null);
    setErrorField(null);

    if (!answers.name.trim()) {
      setErrorField("name");
      setError("Precisamos do seu nome para saber como te chamar.");
      return;
    }
    if (!answers.phone.trim()) {
      setErrorField("phone");
      setError("Informe um WhatsApp para o time entrar em contato.");
      return;
    }
    if (!answers.email.trim()) {
      setErrorField("email");
      setError("Informe um e-mail válido.");
      return;
    }
    if (!answers.privacy_accepted) {
      setErrorField("privacy_accepted");
      setError("Precisamos da sua autorização para entrar em contato.");
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: answers.name,
          business_name: answers.business_name,
          profession: answers.profession,
          phone: answers.phone,
          email: answers.email,
          privacy_accepted: answers.privacy_accepted,
          // Campos de contexto: só viajam quando respondidos. Mandar string
          // vazia faria o Zod recusar o envio inteiro por causa de uma
          // pergunta que era opcional na tela.
          team_size: answers.team_size || undefined,
          agenda_tools: answers.agenda_tools.length > 0 ? answers.agenda_tools : undefined,
          pain_points: answers.pain_points.length > 0 ? answers.pain_points : undefined,
          weekly_volume: answers.weekly_volume || undefined,
          improvement_wish: answers.improvement_wish.trim() || undefined,
          hours_lost_band: band ?? undefined,
          utm: utmFromLocation(),
        }),
      });

      const payload = (await response.json()) as { error?: string; field?: string };
      if (!response.ok) {
        setError(payload.error ?? "Não foi possível enviar. Tente novamente.");
        setErrorField(payload.field ?? null);
        return;
      }

      track("form_completed");
      track("lead_submitted");
      setDone(true);
    } catch {
      setError("Sem conexão agora. Tente novamente em instantes.");
    } finally {
      setSending(false);
    }
  }

  if (done) return <Confirmation />;

  return (
    <section id="conhecer" className="scroll-mt-16 border-b border-border bg-muted/40 py-20 sm:py-24">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <div className="panel overflow-hidden">
          {/* A barra só existe depois da abertura: mostrar "etapa 0 de 6"
              antes de a pessoa aceitar começar transforma o convite em
              formulário logo na primeira olhada. */}
          {screen > 0 && (
            <div className="border-b border-border px-6 pt-6 pb-5 sm:px-9">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>
                  Etapa {screen} de {STEPS.length}
                </span>
                <span>{STEPS[screen - 1]}</span>
              </div>
              <div className="mt-2 flex gap-1.5">
                {STEPS.map((label, i) => (
                  <div
                    key={label}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors duration-300",
                      i < screen ? "bg-cta" : "bg-muted"
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Altura mínima fixa DAS ETAPAS: sem ela o cartão encolhe e cresce
              a cada troca de pergunta, e o botão foge de debaixo do dedo. A
              abertura fica de fora porque tem três linhas de texto — reservar
              24rem ali abriria um vão morto embaixo do convite. */}
          <div
            className={cn(
              "px-6 py-8 sm:px-9 sm:py-10",
              screen > 0 && "min-h-[24rem]"
            )}
          >
            <div
              key={screen}
              className="animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
            >
              {screen === 0 && (
                <div>
                  <p className="section-label text-primary">Conhecer o Timely</p>
                  <Heading ref={headingRef}>Vamos conhecer o seu negócio?</Heading>
                  <p className="mt-4 text-[1.0625rem] leading-7 text-muted-foreground">
                    Queremos entender sua rotina para mostrar como o Timely pode
                    fazer parte dela. São seis perguntas rápidas — e só duas
                    delas precisam de resposta.
                  </p>
                </div>
              )}

              {screen === 1 && (
                <Step
                  ref={headingRef}
                  title="O que você faz?"
                  text="Assim o time chega na conversa já sabendo do seu tipo de atendimento."
                >
                  <Options
                    options={LEAD_PROFESSIONS}
                    value={answers.profession}
                    onPick={(v) => set("profession", v)}
                    invalid={errorField === "profession"}
                  />
                  <p className="mt-7 text-sm font-medium text-foreground">Você trabalha:</p>
                  <Options
                    className="mt-3"
                    options={LEAD_TEAM_SIZES}
                    value={answers.team_size}
                    onPick={(v) => set("team_size", v)}
                  />
                </Step>
              )}

              {screen === 2 && (
                <Step
                  ref={headingRef}
                  title="Onde a sua agenda vive hoje?"
                  text="Pode marcar mais de uma — quase todo mundo marca."
                  optional
                >
                  <Options
                    options={LEAD_AGENDA_TOOLS}
                    value={answers.agenda_tools}
                    onPick={(v) => toggle("agenda_tools", v)}
                    multi
                  />
                </Step>
              )}

              {screen === 3 && (
                <Step
                  ref={headingRef}
                  title="O que mais pesa na sua rotina?"
                  text="Marque o que você reconhece no seu dia."
                  optional
                >
                  <Options
                    options={LEAD_PAIN_POINTS}
                    value={answers.pain_points}
                    onPick={(v) => toggle("pain_points", v)}
                    multi
                  />
                </Step>
              )}

              {screen === 4 && (
                <Step
                  ref={headingRef}
                  title="Quantos atendimentos por semana?"
                  text="Uma estimativa já ajuda."
                  optional
                >
                  <Options
                    options={LEAD_WEEKLY_VOLUMES}
                    value={answers.weekly_volume}
                    onPick={(v) => set("weekly_volume", v)}
                  />
                </Step>
              )}

              {screen === 5 && (
                <Step
                  ref={headingRef}
                  title="O que você gostaria de melhorar?"
                  text="Conte do seu jeito. É o campo que o time mais lê."
                  optional
                >
                  <Textarea
                    id="lead-wish"
                    value={answers.improvement_wish}
                    onChange={(e) => set("improvement_wish", e.target.value)}
                    maxLength={1000}
                    placeholder="Ex.: parar de procurar mensagem antiga para lembrar o horário de alguém"
                    className="min-h-36"
                  />
                </Step>
              )}

              {screen === 6 && (
                <Step
                  ref={headingRef}
                  title="Para onde enviamos o próximo passo?"
                  text="Seus dados ficam com o Timely e não são compartilhados."
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Seu nome" htmlFor="lead-name">
                      <Input
                        id="lead-name"
                        value={answers.name}
                        onChange={(e) => set("name", e.target.value)}
                        autoComplete="name"
                        placeholder="Como podemos te chamar"
                        aria-invalid={errorField === "name" || undefined}
                      />
                    </Field>
                    <Field
                      label="Nome do negócio"
                      htmlFor="lead-business"
                      hint="opcional"
                    >
                      <Input
                        id="lead-business"
                        value={answers.business_name}
                        onChange={(e) => set("business_name", e.target.value)}
                        placeholder="Studio Aurora"
                      />
                    </Field>
                    <Field label="WhatsApp" htmlFor="lead-phone">
                      <PhoneInput
                        id="lead-phone"
                        value={answers.phone}
                        onValueChange={(v) => set("phone", v)}
                        aria-invalid={errorField === "phone" || undefined}
                      />
                    </Field>
                    <Field label="E-mail" htmlFor="lead-email">
                      <Input
                        id="lead-email"
                        type="email"
                        value={answers.email}
                        onChange={(e) => set("email", e.target.value)}
                        autoComplete="email"
                        placeholder="voce@exemplo.com"
                        aria-invalid={errorField === "email" || undefined}
                      />
                    </Field>
                  </div>

                  {/* Consentimento explícito e ANTES do botão — não uma nota em
                      corpo 10 depois dele. */}
                  <label
                    className={cn(
                      "mt-6 flex cursor-pointer items-start gap-2.5 rounded-lg text-sm leading-5 text-muted-foreground transition-shadow",
                      errorField === "privacy_accepted" &&
                        "ring-2 ring-destructive/40 ring-offset-4 ring-offset-card"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={answers.privacy_accepted}
                      onChange={(e) => set("privacy_accepted", e.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                    />
                    Autorizo o Timely a usar meus dados para entrar em contato
                    sobre o produto. Nada é compartilhado com terceiros.
                  </label>
                </Step>
              )}
            </div>

            {error && (
              <p role="alert" className="mt-6 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-5 sm:px-9">
            {screen > 0 ? (
              <Button type="button" variant="ghost" onClick={goBack} disabled={sending}>
                <ArrowLeft className="size-4" />
                Voltar
              </Button>
            ) : (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden />
                Leva menos de dois minutos.
              </p>
            )}

            {screen < LAST_STEP ? (
              <Button
                type="button"
                size="lg"
                onClick={goNext}
                className="bg-cta text-white hover:opacity-90"
              >
                {screen === 0 ? "Começar" : "Continuar"}
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={submit}
                disabled={sending}
                className="bg-cta text-white hover:opacity-90"
              >
                {sending && <Loader2 className="size-4 animate-spin" />}
                Quero conhecer o Timely
                {!sending && <ArrowRight className="size-4" />}
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** A conclusão. Sem pergunta nenhuma: a pessoa já fez o que veio fazer. */
function Confirmation() {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Quem enviou por teclado precisa saber que a tela mudou e que o
    // formulário que estava em foco desapareceu.
    ref.current?.focus();
  }, []);

  return (
    <section id="conhecer" className="scroll-mt-16 border-b border-border bg-muted/40 py-20 sm:py-24">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
        <div className="panel p-7 sm:p-9">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Check className="size-6" aria-hidden />
          </span>
          <h2
            ref={ref}
            tabIndex={-1}
            className="mt-5 text-[1.75rem] leading-tight font-semibold tracking-tight text-foreground outline-none sm:text-[2rem]"
          >
            Tudo certo.
          </h2>
          <p className="mt-3 text-[1.0625rem] leading-7 text-muted-foreground">
            Recebemos suas informações. Nosso time vai conhecer melhor sua
            rotina e entrar em contato para apresentar o Timely.
          </p>

          <div className="mt-8 flex flex-col gap-3 border-t border-border pt-7 sm:flex-row">
            <Button
              nativeButton={false}
              className="bg-cta text-white hover:opacity-90"
              render={<Link href="/signup" />}
              onClick={() => track("signup_click", { from: "pos_envio" })}
            >
              Conhecer o Timely <ArrowRight className="size-4" />
            </Button>
            <Button variant="ghost" nativeButton={false} render={<a href="#topo" />}>
              Voltar ao início
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Heading({
  ref,
  children,
}: {
  ref: React.Ref<HTMLHeadingElement>;
  children: React.ReactNode;
}) {
  return (
    <h2
      ref={ref}
      tabIndex={-1}
      className="mt-3 text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance text-foreground outline-none sm:text-[2.25rem]"
    >
      {children}
    </h2>
  );
}

function Step({
  ref,
  title,
  text,
  optional,
  children,
}: {
  ref: React.Ref<HTMLHeadingElement>;
  title: string;
  text: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Heading ref={ref}>{title}</Heading>
      <p className="mt-3 text-[1.0625rem] leading-7 text-muted-foreground">
        {text}
        {/* Dizer que dá para seguir sem responder é o que impede a pessoa de
            escolher qualquer coisa só para destravar o botão — resposta
            inventada é pior que resposta em branco. */}
        {optional && (
          <span className="text-muted-foreground/70"> Pode seguir sem responder.</span>
        )}
      </p>
      <div className="mt-7">{children}</div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>
        {label}
        {hint && <span className="font-normal text-muted-foreground"> ({hint})</span>}
      </Label>
      {children}
    </div>
  );
}

/**
 * As opções de uma pergunta.
 *
 * `aria-pressed` em vez de `role="radio"`: são botões de alternar de verdade
 * (dá para desmarcar num conjunto múltiplo), e um grupo de rádio falso teria
 * navegação por setas que estes botões não implementam.
 */
function Options({
  options,
  value,
  onPick,
  multi,
  invalid,
  className,
}: {
  options: readonly { value: string; label: string }[];
  value: string | string[];
  onPick: (value: string) => void;
  multi?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-2.5 rounded-lg transition-shadow",
        invalid && "ring-2 ring-destructive/40 ring-offset-4 ring-offset-card",
        className
      )}
    >
      {options.map((option) => {
        const active = Array.isArray(value)
          ? value.includes(option.value)
          : value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(option.value)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[0.9375rem] font-medium transition-colors",
              active
                ? "border-primary bg-primary/8 text-primary"
                : "border-border bg-card text-foreground hover:border-primary/40"
            )}
          >
            {option.label}
            {multi && active && <Check className="size-4 shrink-0" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

/** Parâmetros de campanha da URL, quando existirem. */
function utmFromLocation(): Record<string, string> | undefined {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const value = params.get(key);
    if (value) utm[key] = value.slice(0, 120);
  }
  return Object.keys(utm).length > 0 ? utm : undefined;
}
