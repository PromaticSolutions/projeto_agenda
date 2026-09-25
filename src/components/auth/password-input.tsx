"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Campo de senha com o botão de mostrar/esconder.
 *
 * No celular, digitar senha às cegas é a causa mais comum de "senha
 * incorreta" — e cada erro ali é um cadastro ou um login que não acontece.
 * O botão fica DENTRO do campo, à direita, e é um `button type="button"`:
 * sem o `type`, apertar Enter no formulário o acionaria em vez de enviar.
 */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  minLength,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <LockKeyhole
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={describedBy}
        className={AUTH_INPUT_CLASS + " pr-11"}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Esconder senha" : "Mostrar senha"}
        aria-pressed={visible}
        className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

/** Campo das telas de entrada: um pouco mais alto que o do painel (alvo de
 *  toque confortável no celular) e com espaço para o ícone à esquerda. */
export const AUTH_INPUT_CLASS = "h-11 bg-card pl-10 text-[0.9375rem]";
