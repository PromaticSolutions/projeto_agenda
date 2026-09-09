"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { clientNameSchema, clientPhoneSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";
import type { DataRequestKind } from "@/lib/types";

/**
 * Formulário do art. 18 da LGPD, na página pública do estúdio.
 *
 * A escolha do tipo vem em botões grandes, e não num `select`: são quatro
 * opções, cada uma é uma frase, e ler quatro frases lado a lado é mais rápido
 * do que abrir uma lista para descobrir o que existe. Mesmo raciocínio do
 * formulário da landing.
 *
 * `message` é OPCIONAL de propósito — quem pede exclusão não deve ter que
 * justificar. O direito não depende de motivo, e um campo obrigatório aqui
 * viraria um filtro para desistir no meio.
 */

/** Os rótulos são repetidos aqui, e não importados de `lib/data/`, porque
 *  aquele módulo é `server-only` e este componente roda no navegador. */
const OPCOES: { value: DataRequestKind; label: string; hint: string }[] = [
  {
    value: "acesso",
    label: "Quero saber quais dados vocês têm sobre mim",
    hint: "O estúdio responde com o que está guardado no cadastro.",
  },
  {
    value: "correcao",
    label: "Quero corrigir um dado errado",
    hint: "Nome trocado, telefone antigo, qualquer informação desatualizada.",
  },
  {
    value: "exclusao",
    label: "Quero que meus dados sejam excluídos",
    hint: "Parte do histórico pode precisar ser mantida por obrigação legal.",
  },
  {
    value: "oposicao",
    label: "Não quero mais receber mensagens",
    hint: "Interrompe as confirmações e lembretes no WhatsApp.",
  },
];

export function DataRequestForm({ slug, studioName }: { slug: string; studioName: string }) {
  const [kind, setKind] = useState<DataRequestKind | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!kind) {
      setError("Escolha o tipo de solicitação.");
      return;
    }
    const nameResult = clientNameSchema.safeParse(name);
    if (!nameResult.success) {
      setError(nameResult.error.issues[0]?.message ?? "Nome inválido");
      return;
    }
    const phoneResult = clientPhoneSchema.safeParse(phone);
    if (!phoneResult.success) {
      setError(phoneResult.error.issues[0]?.message ?? "Telefone inválido");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/data-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          kind,
          clientName: nameResult.data,
          clientPhone: phoneResult.data,
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível registrar. Tente novamente.");
        return;
      }
      setDone(true);
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="panel flex flex-col items-center gap-3 p-8 text-center">
        <CheckCircle2 className="size-8 text-wa" aria-hidden />
        <p className="text-lg font-semibold text-foreground">Solicitação registrada.</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {studioName} recebeu seu pedido e tem até 15 dias para responder. Se
          precisar, use o mesmo WhatsApp do atendimento para acompanhar.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-foreground">
          O que você quer pedir?
        </legend>
        {OPCOES.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setKind(o.value)}
            aria-pressed={kind === o.value}
            className={cn(
              "rounded-xl border p-4 text-left transition-colors",
              kind === o.value
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40"
            )}
          >
            <span className="block font-medium text-foreground">{o.label}</span>
            <span className="mt-0.5 block text-sm text-muted-foreground">{o.hint}</span>
          </button>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="dsr_name">Seu nome</Label>
        <Input
          id="dsr_name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Maria Silva"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="dsr_phone">WhatsApp usado nos agendamentos</Label>
        <PhoneInput id="dsr_phone" required value={phone} onValueChange={setPhone} />
        <p className="text-xs text-muted-foreground">
          É por ele que o estúdio encontra seu cadastro.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="dsr_message">
          Quer detalhar? <span className="text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="dsr_message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Se quiser, explique o que precisa ser corrigido ou excluído."
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={sending} className="bg-cta text-white hover:opacity-90">
        {sending ? "Enviando..." : "Enviar solicitação"}
      </Button>
    </form>
  );
}
