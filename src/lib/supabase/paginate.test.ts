import { describe, expect, it, vi } from "vitest";
import { fetchAllPages } from "@/lib/supabase/paginate";

/**
 * O bug que esta função existe para impedir é silencioso: o PostgREST devolve
 * as primeiras mil linhas com status 200 e sem erro. Por isso os testes olham
 * o RESULTADO COMPLETO, e não só se a função tentou paginar.
 */
describe("fetchAllPages", () => {
  /** Dublê de uma tabela com `total` linhas, respondendo por faixa. */
  function paginaDe(total: number) {
    const linhas = Array.from({ length: total }, (_, i) => ({ id: i }));
    return vi.fn(async (from: number, to: number) => ({
      data: linhas.slice(from, to + 1),
      error: null,
    }));
  }

  it("junta todas as páginas quando o total passa do corte", async () => {
    const page = paginaDe(2500);
    const todas = await fetchAllPages(page, { pageSize: 1000 });

    expect(todas).toHaveLength(2500);
    // 3 chamadas: 0-999, 1000-1999, 2000-2999 (esta volta incompleta e encerra).
    expect(page).toHaveBeenCalledTimes(3);
    expect(page.mock.calls[1]).toEqual([1000, 1999]);
  });

  it("para na primeira página incompleta, sem pedir uma vazia", async () => {
    const page = paginaDe(120);
    const todas = await fetchAllPages(page, { pageSize: 1000 });

    expect(todas).toHaveLength(120);
    expect(page).toHaveBeenCalledTimes(1);
  });

  it("faz uma chamada a mais quando o total é múltiplo exato do tamanho", async () => {
    // O caso que uma implementação ingênua erra: 1000 linhas parecem "cheias",
    // então é preciso perguntar de novo para saber que acabou.
    const page = paginaDe(1000);
    const todas = await fetchAllPages(page, { pageSize: 1000 });

    expect(todas).toHaveLength(1000);
    expect(page).toHaveBeenCalledTimes(2);
  });

  it("propaga o erro do PostgREST em vez de devolver resultado parcial", async () => {
    const page = vi.fn(async (from: number) =>
      from === 0
        ? { data: Array.from({ length: 10 }, (_, i) => ({ id: i })), error: null }
        : { data: null, error: { message: "boom" } }
    );

    await expect(fetchAllPages(page, { pageSize: 10 })).rejects.toEqual({ message: "boom" });
  });

  it("recusa a agregação que passa do teto em vez de rodar sem fim", async () => {
    const page = paginaDe(10_000);
    await expect(fetchAllPages(page, { pageSize: 10, maxRows: 50 })).rejects.toThrow(
      /Mova esta agregação para o banco/
    );
  });
});
