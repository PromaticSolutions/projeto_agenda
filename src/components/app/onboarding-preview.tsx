import { SystemLogo } from "@/components/system-logo";
import { cn } from "@/lib/utils";

/**
 * Miniatura da página pública, ao vivo, enquanto o estúdio é criado.
 *
 * O estúdio nasce com a marca do Timely — não há mais campo de logo no
 * cadastro. Quem quiser a própria troca depois, em Conta > Imagens; até lá é
 * esta a imagem que a cliente dele vê, e é ela que a prévia precisa mostrar.
 */
export function OnboardingPreview({
  name,
  slug,
  brandColor,
  className,
}: {
  name: string;
  slug: string;
  brandColor: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        Prévia da sua página
      </p>
      <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-plum-900/10 ring-1 ring-plum-900/10">
        <div
          className="flex flex-col items-center gap-2 px-4 py-8 text-center text-white transition-colors duration-200"
          style={{ backgroundColor: brandColor }}
        >
          {/* Disco branco atrás da marca: a cor do estúdio é livre, e sem uma
              base neutra a logo sumiria em quem escolher um violeta próximo. */}
          <span className="flex size-12 items-center justify-center rounded-full bg-white shadow-sm">
            <SystemLogo className="size-8" size={64} />
          </span>
          <p className="font-heading text-sm font-semibold">{name.trim() || "Nome do estúdio"}</p>
        </div>
        <div className="bg-blush-50 px-4 py-3">
          <p className="truncate text-[11px] text-muted-foreground">
            agenda-online.app/{slug.trim() || "seu-link"}
          </p>
        </div>
      </div>
    </div>
  );
}
