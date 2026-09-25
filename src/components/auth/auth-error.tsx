import { AlertCircle } from "lucide-react";

/**
 * Mensagem de erro dos formulários de entrada. `role="alert"` faz o leitor de
 * tela anunciar o erro assim que ele aparece — sem isso, quem não enxerga a
 * tela aperta "Entrar" e não fica sabendo por que nada aconteceu.
 */
export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-sm leading-5 text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}
