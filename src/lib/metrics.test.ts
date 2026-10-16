import { describe, expect, it } from "vitest";
import {
  bestWeekday,
  changeRate,
  inRange,
  periodBefore,
  periodEndingAt,
  rankBookings,
  revenueByLocalDay,
  revenueByWeekday,
  summarizePeriod,
  type MetricBooking,
} from "@/lib/metrics";
import type { BookingStatus } from "@/lib/types";

/** 14:00 em São Paulo (UTC-3) do dia indicado. */
function at(date: string): string {
  return `${date}T17:00:00.000Z`;
}

function booking(overrides: Partial<MetricBooking> = {}): MetricBooking {
  return {
    studio_id: "studio-1",
    service_id: "corte",
    client_name: "Ana",
    client_phone: "5511987654321",
    start_at: at("2026-10-05"),
    status: "agendado" as BookingStatus,
    ...overrides,
  };
}

/** Corte R$ 80,00 · Coloração R$ 250,00. "sumido" não está na tabela. */
const prices = new Map([
  ["corte", 8000],
  ["coloracao", 25000],
]);

const now = new Date(at("2026-10-08"));

describe("periodEndingAt", () => {
  it("inclui o dia de hoje e conta para trás", () => {
    // 7 dias terminando em 08/10 = 02/10..08/10, não 01/10..08/10.
    expect(periodEndingAt("2026-10-08", 7)).toEqual({ from: "2026-10-02", to: "2026-10-08" });
  });

  it("atravessa a virada do mês sem pular dia", () => {
    expect(periodEndingAt("2026-03-02", 30).from).toBe("2026-02-01");
  });
});

describe("periodBefore", () => {
  it("devolve a janela imediatamente anterior, do mesmo tamanho", () => {
    const current = periodEndingAt("2026-10-08", 7);
    expect(periodBefore(current, 7)).toEqual({ from: "2026-09-25", to: "2026-10-01" });
  });

  it("não deixa buraco nem sobreposição entre as duas janelas", () => {
    const current = periodEndingAt("2026-10-08", 30);
    const previous = periodBefore(current, 30);
    // O dia seguinte ao fim da janela anterior é o início da atual.
    expect(previous.to < current.from).toBe(true);
  });
});

describe("inRange", () => {
  it("separa as duas janelas buscadas numa consulta só", () => {
    const rows = [
      booking({ start_at: at("2026-09-30") }),
      booking({ start_at: at("2026-10-02") }),
      booking({ start_at: at("2026-10-08") }),
    ];
    const current = periodEndingAt("2026-10-08", 7);

    expect(inRange(rows, current)).toHaveLength(2);
    expect(inRange(rows, periodBefore(current, 7))).toHaveLength(1);
  });

  it("decide pela data no fuso do estúdio", () => {
    // 23:30 de 01/10 em São Paulo = 02:30 de 02/10 em UTC: pertence a 01/10.
    const rows = [booking({ start_at: "2026-10-02T02:30:00.000Z" })];
    expect(inRange(rows, { from: "2026-10-02", to: "2026-10-08" })).toHaveLength(0);
    expect(inRange(rows, { from: "2026-09-25", to: "2026-10-01" })).toHaveLength(1);
  });
});

describe("summarizePeriod", () => {
  it("conta como realizado o que já passou e não foi cancelado", () => {
    const totals = summarizePeriod(
      [
        booking({ start_at: at("2026-10-05"), status: "finalizado" }),
        // Passado e esquecido em "agendado": a dona não marcou, mas atendeu.
        booking({ start_at: at("2026-10-06"), status: "agendado" }),
        booking({ start_at: at("2026-10-07"), status: "cancelado" }),
        // Ainda vai acontecer: é previsto, não realizado.
        booking({ start_at: at("2026-10-10"), status: "agendado" }),
      ],
      prices,
      now
    );

    expect(totals.realizedCount).toBe(2);
    expect(totals.realizedCents).toBe(16000);
    expect(totals.upcomingCount).toBe(1);
    expect(totals.expectedCents).toBe(8000);
    expect(totals.canceledCount).toBe(1);
  });

  it("separa quantos realizados a dona confirmou de fato", () => {
    const totals = summarizePeriod(
      [
        booking({ start_at: at("2026-10-05"), status: "finalizado" }),
        booking({ start_at: at("2026-10-06"), status: "agendado" }),
      ],
      prices,
      now
    );
    // É o que permite a tela dizer quanta confiança o número merece.
    expect(totals.confirmedCount).toBe(1);
    expect(totals.realizedCount).toBe(2);
  });

  it("não inventa preço de serviço que saiu da tabela", () => {
    const totals = summarizePeriod(
      [
        booking({ start_at: at("2026-10-05"), status: "finalizado" }),
        booking({ start_at: at("2026-10-06"), service_id: "sumido", status: "finalizado" }),
      ],
      prices,
      now
    );
    expect(totals.realizedCents).toBe(8000);
    // E avisa, em vez de deixar o total silenciosamente menor.
    expect(totals.unpricedCount).toBe(1);
  });

  it("tira o sem-preço do ticket médio, em vez de puxá-lo para baixo", () => {
    const totals = summarizePeriod(
      [
        booking({ start_at: at("2026-10-05"), service_id: "coloracao", status: "finalizado" }),
        booking({ start_at: at("2026-10-06"), service_id: "sumido", status: "finalizado" }),
      ],
      prices,
      now
    );
    // R$ 250 / 1 atendimento com preço — não R$ 250 / 2.
    expect(totals.averageTicketCents).toBe(25000);
  });

  it("devolve zero, e não NaN, sem nenhum agendamento", () => {
    const totals = summarizePeriod([], prices, now);
    expect(totals.averageTicketCents).toBe(0);
    expect(totals.cancelRate).toBe(0);
    expect(totals.realizedCents).toBe(0);
  });

  it("calcula a taxa de cancelamento sobre o total do período", () => {
    const totals = summarizePeriod(
      [
        booking({ status: "cancelado" }),
        booking({ status: "finalizado" }),
        booking({ status: "finalizado" }),
        booking({ status: "finalizado" }),
      ],
      prices,
      now
    );
    expect(totals.cancelRate).toBeCloseTo(0.25);
  });
});

describe("changeRate", () => {
  it("devolve a variação relativa", () => {
    expect(changeRate(150, 100)).toBeCloseTo(0.5);
    expect(changeRate(50, 100)).toBeCloseTo(-0.5);
  });

  it("devolve null quando não havia base de comparação", () => {
    // Sair de 0 para 300 não é "+30000%": é a primeira medição. Inventar
    // porcentagem aqui encheria o painel de variação sem significado.
    expect(changeRate(300, 0)).toBeNull();
    expect(changeRate(0, 0)).toBeNull();
  });
});

describe("revenueByLocalDay", () => {
  it("devolve um ponto por dia do período, inclusive os vazios", () => {
    const points = revenueByLocalDay(
      [booking({ start_at: at("2026-10-07"), status: "finalizado" })],
      prices,
      { from: "2026-10-05", to: "2026-10-08" },
      now
    );
    expect(points.map((p) => p.date)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
    ]);
    // Dia sem atendimento vale 0 e ocupa espaço no eixo: buraco escondido
    // faria a semana parecer mais cheia do que foi.
    expect(points.map((p) => p.cents)).toEqual([0, 0, 8000, 0]);
  });

  it("agrupa pelo dia no fuso do estúdio, não em UTC", () => {
    // 23:30 de 06/10 em São Paulo = 02:30 de 07/10 em UTC.
    const points = revenueByLocalDay(
      [booking({ start_at: "2026-10-07T02:30:00.000Z", status: "finalizado" })],
      prices,
      { from: "2026-10-06", to: "2026-10-07" },
      now
    );
    expect(points.find((p) => p.date === "2026-10-06")?.cents).toBe(8000);
    expect(points.find((p) => p.date === "2026-10-07")?.cents).toBe(0);
  });
});

describe("revenueByWeekday", () => {
  it("soma por dia da semana e devolve os sete, de domingo a sábado", () => {
    const points = revenueByWeekday(
      [
        // 05/10/2026 é segunda; 07/10 é quarta.
        booking({ start_at: at("2026-10-05"), status: "finalizado" }),
        booking({ start_at: at("2026-10-05"), service_id: "coloracao", status: "finalizado" }),
        booking({ start_at: at("2026-10-07"), status: "finalizado" }),
      ],
      prices,
      now
    );

    expect(points).toHaveLength(7);
    expect(points[1]).toMatchObject({ weekday: 1, cents: 33000, count: 2 });
    expect(points[3]).toMatchObject({ weekday: 3, cents: 8000, count: 1 });
    expect(points[0].cents).toBe(0);
  });

  it("ignora cancelado e o que ainda não aconteceu", () => {
    const points = revenueByWeekday(
      [
        booking({ start_at: at("2026-10-05"), status: "cancelado" }),
        booking({ start_at: at("2026-10-12"), status: "agendado" }),
      ],
      prices,
      now
    );
    expect(points.every((p) => p.cents === 0 && p.count === 0)).toBe(true);
  });
});

describe("bestWeekday", () => {
  it("elege o dia que mais rendeu", () => {
    const points = revenueByWeekday(
      [
        booking({ start_at: at("2026-10-05"), service_id: "coloracao", status: "finalizado" }),
        booking({ start_at: at("2026-10-07"), status: "finalizado" }),
      ],
      prices,
      now
    );
    expect(bestWeekday(points)?.weekday).toBe(1);
  });

  it("devolve null quando não houve nenhum atendimento", () => {
    expect(bestWeekday(revenueByWeekday([], prices, now))).toBeNull();
  });

  it("usa a quantidade quando nenhum serviço tem preço", () => {
    // Sem preço, todo dia vale R$ 0; o movimento é o único critério que resta.
    const points = revenueByWeekday(
      [
        booking({ start_at: at("2026-10-07"), service_id: "sumido", status: "finalizado" }),
        booking({ start_at: at("2026-10-07"), service_id: "sumido", status: "finalizado" }),
        booking({ start_at: at("2026-10-05"), service_id: "sumido", status: "finalizado" }),
      ],
      prices,
      now
    );
    expect(bestWeekday(points)).toMatchObject({ weekday: 3, count: 2 });
  });
});

describe("rankBookings", () => {
  const rows = [
    booking({ start_at: at("2026-10-05"), service_id: "corte", status: "finalizado" }),
    booking({ start_at: at("2026-10-06"), service_id: "corte", status: "finalizado" }),
    booking({ start_at: at("2026-10-06"), service_id: "coloracao", status: "finalizado" }),
    booking({ start_at: at("2026-10-07"), service_id: "corte", status: "cancelado" }),
  ];

  it("ordena por valor e ignora o que não foi realizado", () => {
    const ranked = rankBookings(rows, prices, now, (b) => ({
      key: b.service_id,
      label: b.service_id,
    }));

    expect(ranked.map((r) => r.key)).toEqual(["coloracao", "corte"]);
    expect(ranked[0]).toMatchObject({ cents: 25000, count: 1 });
    // O cancelado não entra na contagem do corte.
    expect(ranked[1]).toMatchObject({ cents: 16000, count: 2 });
  });

  it("desempata pela quantidade quando o valor é igual", () => {
    const ranked = rankBookings(
      [
        booking({ start_at: at("2026-10-05"), service_id: "sumido", status: "finalizado" }),
        booking({ start_at: at("2026-10-05"), service_id: "outro", status: "finalizado" }),
        booking({ start_at: at("2026-10-06"), service_id: "outro", status: "finalizado" }),
      ],
      prices,
      now,
      (b) => ({ key: b.service_id, label: b.service_id })
    );
    // Os dois valem R$ 0 (sem preço); quem atendeu mais vem primeiro.
    expect(ranked.map((r) => r.key)).toEqual(["outro", "sumido"]);
  });

  it("deixa de fora quem o resolvedor não souber identificar", () => {
    const ranked = rankBookings(rows, prices, now, (b) =>
      b.service_id === "corte" ? null : { key: b.service_id, label: b.service_id }
    );
    expect(ranked.map((r) => r.key)).toEqual(["coloracao"]);
  });
});
