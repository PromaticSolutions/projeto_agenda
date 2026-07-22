"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

function formatBRPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (digits.length <= 2) return ddd ? `(${ddd}` : "";
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  const firstPart = rest.slice(0, rest.length - 4);
  const lastPart = rest.slice(-4);
  return `(${ddd}) ${firstPart}-${lastPart}`;
}

export interface PhoneInputProps
  extends Omit<React.ComponentProps<typeof Input>, "onChange" | "type" | "value" | "defaultValue"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (digits: string) => void;
}

/** Input de telefone BR com máscara "(DD) 9XXXX-XXXX" aplicada durante a digitação. */
export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ onValueChange, defaultValue, value, ...props }, ref) => {
    const [display, setDisplay] = React.useState(() =>
      formatBRPhone(value ?? defaultValue ?? "")
    );

    React.useEffect(() => {
      if (value !== undefined) setDisplay(formatBRPhone(value));
    }, [value]);

    return (
      <Input
        {...props}
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder={props.placeholder ?? "(11) 93447-6935"}
        value={display}
        onChange={(e) => {
          const formatted = formatBRPhone(e.target.value);
          setDisplay(formatted);
          onValueChange?.(formatted.replace(/\D/g, ""));
        }}
      />
    );
  }
);
PhoneInput.displayName = "PhoneInput";
