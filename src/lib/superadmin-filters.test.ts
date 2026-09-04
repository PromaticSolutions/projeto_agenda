import { describe, expect, it } from "vitest";
import {
  filterAndSortStudios,
  invoiceFilterToStatus,
  parseInvoiceFilter,
  parseMonthParam,
  parseStudioFilter,
  parseStudioSort,
  type StudioFilterInput,
} from "@/lib/superadmin-filters";

function row(overrides: Partial<StudioFilterInput> & { name: string }): StudioFilterInput {
  return {
    slug: overrides.name.toLowerCase().replace(/\s+/g, "-"),
    ownerName: null,
    whatsapp: "5511934476935",
    createdAt: "2026-01-01T12:00:00Z",
    bookingsLast30d: 0,
    lastBookingAt: null,
    isAtRisk: false,
    isNew: false,
    subscriptionStatus: "ativa",
    monthlyCents: 8900,
    lifetimeCents: 0,
    overdueCents: 0,
    ...overrides,
  };
}

describe("parse dos filtros do superadmin", () => {
  it("cai no padrão diante de valor inventado na URL", () => {
    expect(parseStudioFilter("vips")).toBe("todos");
    expect(parseStudioSort("aleatorio")).toBe("atividade");
    expect(parseInvoiceFilter("quitadas")).toBe("todas");
  });

  it("só aceita mês em formato de mês", () => {
    expect(parseMonthParam("2026-08")).toBe("2026-08");
    expect(parseMonthParam("2026-13")).toBeUndefined();
    expect(parseMonthParam("agosto")).toBeUndefined();
    expect(parseMonthParam(undefined)).toBeUndefined();
  });

  it("traduz o filtro da URL para o status que a query entende", () => {
    expect(invoiceFilterToStatus("todas")).toBe("todas");
    expect(invoiceFilterToStatus("em_atraso")).toBe("em_atraso");
    expect(invoiceFilterToStatus("paga")).toBe("paga");
  });
});

describe("filtro da lista de clientes", () => {
  const rows = [
    row({ name: "Bella Studio", bookingsLast30d: 12, lifetimeCents: 26700, lastBookingAt: "2026-08-20T12:00:00Z" }),
    row({ name: "Studio Ana", bookingsLast30d: 0, isAtRisk: true, subscriptionStatus: "inadimplente", overdueCents: 8900 }),
    row({ name: "Nail House", bookingsLast30d: 3, isNew: true, subscriptionStatus: "trial", monthlyCents: 8900, lastBookingAt: "2026-08-22T12:00:00Z" }),
    row({ name: "Espaço Zen", bookingsLast30d: 1, subscriptionStatus: null, monthlyCents: 0, overdueCents: 4900, lastBookingAt: "2026-08-01T12:00:00Z" }),
  ];

  it("separa ativos, em risco, novos e em teste", () => {
    const names = (filter: Parameters<typeof filterAndSortStudios>[1]["filter"]) =>
      filterAndSortStudios(rows, { filter, sort: "nome", query: "" }).map((r) => r.name);

    expect(names("ativos")).toEqual(["Bella Studio", "Espaço Zen", "Nail House"]);
    expect(names("em_risco")).toEqual(["Studio Ana"]);
    expect(names("novos")).toEqual(["Nail House"]);
    expect(names("trial")).toEqual(["Nail House"]);
    expect(names("sem_assinatura")).toEqual(["Espaço Zen"]);
  });

  it("trata como inadimplente quem tem fatura vencida, mesmo com assinatura marcada como ativa", () => {
    const found = filterAndSortStudios(rows, { filter: "inadimplentes", sort: "nome", query: "" });
    expect(found.map((r) => r.name)).toEqual(["Espaço Zen", "Studio Ana"]);
  });

  it("busca por nome, slug e telefone (só com dígitos suficientes)", () => {
    const search = (query: string) =>
      filterAndSortStudios(rows, { filter: "todos", sort: "nome", query }).map((r) => r.name);

    expect(search("bella")).toEqual(["Bella Studio"]);
    expect(search("nail-house")).toEqual(["Nail House"]);
    expect(search("(11) 93447-6935")).toHaveLength(4);
    // Dois dígitos casariam com quase tudo: busca curta não filtra por telefone.
    expect(search("55")).toHaveLength(0);
  });

  it("ordena parados colocando quem nunca agendou na frente", () => {
    const ordered = filterAndSortStudios(rows, { filter: "todos", sort: "parados", query: "" });
    expect(ordered[0].name).toBe("Studio Ana");
    expect(ordered[ordered.length - 1].name).toBe("Nail House");
  });

  it("ordena por receita paga e por MRR sem alterar o array recebido", () => {
    const original = [...rows];
    expect(filterAndSortStudios(rows, { filter: "todos", sort: "receita", query: "" })[0].name).toBe(
      "Bella Studio"
    );
    expect(rows).toEqual(original);
  });
});
