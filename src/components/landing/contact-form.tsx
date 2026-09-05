"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  LEAD_AGENDA_TOOLS,
  LEAD_PAIN_POINTS,
  LEAD_PROFESSIONS,
  LEAD_TEAM_SIZES,
} from "@/lib/validation";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useHoursBand } from "@/components/landing/hours-band";

/**
 * O convite comercial — não é pesquisa.
 *
 * A diferença não é só de rótulo: são CINCO campos, e nenhum a mais. Cada
 * campo obrigatório extra é uma chance de desistir no último passo, e quem
 * chega aqui é exatamente quem não pode esbarrar em pergunta que ninguém
 * pediu. O que o time gostaria de saber (equipe, volume, dificuldade) é
 * oferecido DEPOIS do envio, opcional, na tela de confirmação.
 *
 * A faixa escolhida lá em cima, na interação de custo, viaja junto sem a
 * pessoa precisar responder de novo — é contexto que ela já deu por vontade
 * própria.
 */

export function ContactForm() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [phone, setPhone] = useState("");
  const [profession, setProfession] = useState("");
  const [accepted, setAccepted] = useState(false);
  const startedRef = useRef(false);
  const { band } = useHoursBand();

  function begin() {
    if (startedRef.current) return;
    startedRef.current = true;
    track("form_started");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setErrorField(null);

    const data = new FormData(event.currentTarget);

    // Validado aqui, e não com o botão desabilitado: um CTA cinza na primeira
    // olhada parece defeito e não diz o que falta. Clicável + mensagem
    // específica converte melhor do que bloqueado + silêncio.
    if (!profession) {
      setErrorField("profession");
      setError("Escolha o que você faz para continuarmos.");
      return;
    }
    if (!accepted) {
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
          name: String(data.get("name") ?? ""),
          business_name: String(data.get("business_name") ?? ""),
          profession,
          phone,
          email: String(data.get("email") ?? ""),
          privacy_accepted: accepted,
          hours_lost_band: band ?? undefined,
          utm: utmFromLocation(),
        }),
      });

      const payload = (await response.json()) as { error?: string; field?: string; id?: string };
      if (!response.ok) {
        setError(payload.error ?? "Não foi possível enviar. Tente novamente.");
        setErrorField(payload.field ?? null);
        return;
      }

      track("lead_submitted");
      setLeadId(payload.id ?? null);
      setDone(true);
    } catch {
      setError("Sem conexão agora. Tente novamente em instantes.");
    } finally {
      setSending(false);
    }
  }

  if (done) return <Confirmation leadId={leadId} />;

  return (
    <section id="conhecer" className="scroll-mt-16 border-b border-border bg-muted/40 py-20 sm:py-24">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-16">
        <div>
          <h2 className="text-[2rem] leading-[1.12] font-semibold tracking-tight text-balance text-foreground sm:text-[2.5rem]">
            Vamos conhecer o seu negócio?
          </h2>
          <p className="mt-4 text-[1.0625rem] leading-7 text-muted-foreground">
            Conte um pouco sobre a sua rotina e nosso time vai entender como o
            Timely pode fazer sentido para você.
          </p>
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
            Leva menos de um minuto.
          </p>
        </div>

        <form onSubmit={handleSubmit} onChange={begin} className="panel flex flex-col gap-5 p-6 sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-name">Seu nome</Label>
              <Input
                id="lead-name"
                name="name"
                required
                autoComplete="name"
                placeholder="Como podemos te chamar"
                aria-invalid={errorField === "name" || undefined}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-business">
                Nome do negócio <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="lead-business" name="business_name" placeholder="Studio Aurora" />
            </div>
          </div>

          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-sm font-medium text-foreground">O que você faz?</legend>
            <div
              className={cn(
                "flex flex-wrap gap-2 rounded-lg transition-shadow",
                errorField === "profession" && "ring-2 ring-destructive/40 ring-offset-4 ring-offset-card"
              )}
            >
              {LEAD_PROFESSIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={profession === o.value}
                  onClick={() => {
                    begin();
                    setProfession(o.value);
                  }}
                  className={cn(
                    "rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
                    profession === o.value
                      ? "border-primary bg-primary/8 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/40"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-phone">WhatsApp</Label>
              <PhoneInput
                id="lead-phone"
                value={phone}
                onValueChange={setPhone}
                aria-invalid={errorField === "phone" || undefined}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-email">E-mail</Label>
              <Input
                id="lead-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="voce@exemplo.com"
                aria-invalid={errorField === "email" || undefined}
              />
            </div>
          </div>

          {/* Consentimento discreto, mas explícito e antes do botão — não uma
              nota em corpo 10 depois dele. */}
          <label
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-lg text-sm leading-5 text-muted-foreground transition-shadow",
              errorField === "privacy_accepted" &&
                "ring-2 ring-destructive/40 ring-offset-4 ring-offset-card"
            )}
          >
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
            />
            Autorizo o Timely a usar meus dados para entrar em contato sobre o
            produto. Nada é compartilhado com terceiros.
          </label>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={sending}
            className="bg-cta text-white hover:opacity-90"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : null}
            Quero conhecer o Timely
            {!sending && <ArrowRight className="size-4" />}
          </Button>
        </form>
      </div>
    </section>
  );
}

/**
 * Confirmação + as perguntas opcionais.
 *
 * O lead já está gravado neste ponto. As três perguntas abaixo são um convite,
 * não um segundo formulário: cada resposta é gravada sozinha, sem botão de
 * enviar, e fechar a página aqui não perde nada.
 */
function Confirmation({ leadId }: { leadId: string | null }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  useEffect(() => {
    // Foco no agradecimento: quem enviou por teclado precisa saber que a tela
    // mudou e o formulário que estava em foco desapareceu.
    ref.current?.focus();
  }, []);

  function save(field: string, value: string | string[]) {
    setAnswers((a) => ({ ...a, [field]: value }));
    if (!leadId) return;
    track("form_step_completed", { field });
    // Silencioso: a pessoa já converteu, e uma falha aqui não pode virar erro
    // numa tela que acabou de dizer "tudo certo".
    void fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: leadId, [field]: value }),
    }).catch(() => {});
  }

  function toggle(field: string, value: string) {
    const current = (answers[field] as string[] | undefined) ?? [];
    save(field, current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  }

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

          {leadId && (
            <div className="mt-8 border-t border-border pt-7">
              <p className="text-sm font-medium text-foreground">
                Quer adiantar a conversa?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Três toques, se quiser. Ajuda o time a chegar sabendo do que
                estamos falando.
              </p>

              <div className="mt-6 flex flex-col gap-6">
                <Quick
                  label="Você trabalha sozinho(a) ou com equipe?"
                  options={LEAD_TEAM_SIZES}
                  value={answers.team_size as string | undefined}
                  onPick={(v) => save("team_size", v)}
                />
                <QuickMulti
                  label="Como você organiza a agenda hoje?"
                  options={LEAD_AGENDA_TOOLS}
                  values={(answers.agenda_tools as string[] | undefined) ?? []}
                  onToggle={(v) => toggle("agenda_tools", v)}
                />
                <QuickMulti
                  label="O que mais atrapalha sua rotina?"
                  options={LEAD_PAIN_POINTS}
                  values={(answers.pain_points as string[] | undefined) ?? []}
                  onToggle={(v) => toggle("pain_points", v)}
                />
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 border-t border-border pt-7 sm:flex-row">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/signup" />}
              onClick={() => track("signup_click", { from: "pos_envio" })}
            >
              Criar minha conta agora
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

function Quick({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value?: string;
  onPick: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o.value} on={value === o.value} onClick={() => onPick(o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function QuickMulti({
  label,
  options,
  values,
  onToggle,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o.value} on={values.includes(o.value)} onClick={() => onToggle(o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        on
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {children}
    </button>
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
