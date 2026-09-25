import { cn } from "@/lib/utils";

/**
 * Título de seção da landing.
 *
 * Duas peças. Em cima, o horário e o nome da seção, como a linha de uma
 * agenda de papel ("09:00 — Como funciona"): a página inteira se lê como um
 * dia, da abertura ao fecho, e é isso que a separa de uma landing de molde.
 * Embaixo, o título, com a segunda parte na cor da marca — o destaque
 * mora dentro da própria frase, no lugar do antigo "segundo tom em cinza".
 *
 * `tone="dark"` é para as faixas plum: só troca as cores do rótulo.
 */
export function SectionHeading({
  time,
  eyebrow,
  lead,
  trail,
  align = "left",
  tone = "light",
  className,
}: {
  /** O horário da margem, "HH:MM". */
  time?: string;
  eyebrow?: string;
  lead: string;
  trail?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <div className={cn(align === "center" && "text-center", className)}>
      {(time || eyebrow) && (
        <SectionMark time={time} label={eyebrow} tone={tone} align={align} />
      )}
      <h2
        className={cn(
          "text-[2rem] leading-[1.1] text-balance sm:text-[2.75rem]",
          tone === "dark" ? "text-blush-50" : "text-foreground",
          (time || eyebrow) && "mt-5"
        )}
      >
        {lead}
        {trail && (
          <>
            {" "}
            <em>{trail}</em>
          </>
        )}
      </h2>
    </div>
  );
}

/** A linha "HH:MM — Seção", sozinha, para os blocos que montam o próprio título. */
export function SectionMark({
  time,
  label,
  tone = "light",
  align = "left",
}: {
  time?: string;
  label?: string;
  tone?: "light" | "dark";
  align?: "left" | "center";
}) {
  return (
    <p
      className={cn(
        "time-label flex items-baseline gap-3",
        align === "center" && "justify-center",
        tone === "dark" && "text-blush-50/60"
      )}
    >
      {time && (
        <time className={cn("tabular-nums", tone === "dark" ? "text-blush-50" : "text-foreground")}>{time}</time>
      )}
      {time && label && (
        <span aria-hidden className={cn("h-px w-8 shrink-0 self-center", tone === "dark" ? "bg-white/25" : "bg-foreground/30")} />
      )}
      {label && <span className="min-w-0 uppercase tracking-[0.08em]">{label}</span>}
    </p>
  );
}
