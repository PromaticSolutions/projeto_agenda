/**
 * "Essa tabela não existe (ainda)".
 *
 * As migrações deste projeto são rodadas à mão no SQL Editor do Supabase (ver
 * README.md), então é normal o código de uma feature nova chegar ao ar antes
 * do SQL dela. Reconhecer esse erro específico é o que permite a tela dizer
 * "rode a migração 00XX" em vez de estourar um erro genérico.
 *
 * Os dois códigos: 42P01 é o `undefined_table` do Postgres puro; PGRST205 é o
 * que a Supabase realmente devolve, porque o PostgREST responde a partir do
 * cache de schema dele (confirmado contra um projeto real na etapa 10 — ver
 * DECISIONS.md e src/app/app/error.tsx).
 */
export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: string; message?: string };
  if (code === "42P01" || code === "PGRST205") return true;
  return Boolean(message && (message.includes("does not exist") || message.includes("schema cache")));
}
