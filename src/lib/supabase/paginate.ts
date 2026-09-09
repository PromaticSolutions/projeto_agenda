import "server-only";

/**
 * Paginação para leituras que AGREGAM.
 *
 * O PostgREST corta toda resposta em `max_rows` (1000 no config.toml deste
 * projeto) e não avisa: vêm as primeiras mil linhas, com status 200 e sem
 * erro. Numa listagem de tela isso é uma página incompleta — chato, visível.
 * Numa SOMA ou num PLANEJAMENTO é pior: o número sai menor do que a
 * realidade, ou o lembrete da milésima-primeira cliente simplesmente não é
 * planejado, e nada em lugar nenhum acusa.
 *
 * O teto de `maxRows` existe para o bug não virar consulta infinita: se a
 * agregação passar disso, é sinal de que o cálculo precisa descer para o banco
 * (uma view ou uma função de agregação), não de subir o número aqui.
 */

/** O mesmo valor de `db.max_rows` em supabase/config.toml. */
export const POSTGREST_PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: unknown;
}

export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  options: { pageSize?: number; maxRows?: number } = {}
): Promise<T[]> {
  const pageSize = options.pageSize ?? POSTGREST_PAGE_SIZE;
  const maxRows = options.maxRows ?? 50_000;

  const todas: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;

    const linhas = data ?? [];
    todas.push(...linhas);
    // Página incompleta = acabou. Uma requisição a mais só para receber
    // vazio é desperdício num caminho que o cron percorre a cada 5 minutos.
    if (linhas.length < pageSize) return todas;
  }

  throw new Error(
    `Leitura paginada passou de ${maxRows} linhas. Mova esta agregação para o banco em vez de aumentar o teto.`
  );
}
