import { describe, expect, it } from "vitest";
import { buildLeadSummary } from "@/lib/data/leads";
import {
  LEAD_HOURS_BANDS,
  LEAD_PROFESSIONS,
  leadCaptureSchema,
  leadContextSchema,
} from "@/lib/validation";
import type { MarketResearchLead } from "@/lib/types";

/**
 * O que estes testes protegem:
 *
 * 1. O formulário exigir CINCO campos e nada mais. Se alguém tornar
 *    obrigatório um campo do contexto, o teste quebra — e essa regressão
 *    custaria conversão silenciosamente, sem erro em lugar nenhum.
 * 2. A normalização de telefone e e-mail, que é o que faz o dado servir para
 *    o contato depois.
 * 3. O resumo do WhatsApp OMITIR o que não foi respondido: ele chega no
 *    primeiro envio, quando quase todo o contexto está vazio.
 */

const CAPTURA = {
  name: "Maria Silva",
  profession: "nail_designer",
  phone: "11987654321",
  email: "maria@exemplo.com",
  privacy_accepted: true as const,
};

describe("leadCaptureSchema", () => {
  it("aceita o formulário com apenas os cinco campos", () => {
    expect(leadCaptureSchema.safeParse(CAPTURA).success).toBe(true);
  });

  it("não exige nome do negócio", () => {
    // Muita gente da beleza atende sem marca própria; exigir faria essa
    // pessoa inventar um nome ou desistir.
    expect(leadCaptureSchema.safeParse({ ...CAPTURA, business_name: "" }).success).toBe(true);
    expect(leadCaptureSchema.parse({ ...CAPTURA, business_name: "Studio Aurora" }).business_name)
      .toBe("Studio Aurora");
  });

  it("não exige nenhum campo de contexto", () => {
    // A regressão que este teste existe para pegar: alguém tornar
    // team_size/volume/dor obrigatórios e o funil voltar a ser questionário.
    const parsed = leadCaptureSchema.safeParse(CAPTURA);
    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty("team_size");
    expect(parsed.data).not.toHaveProperty("weekly_volume");
    expect(parsed.data).not.toHaveProperty("pain_points");
  });

  it("recusa envio sem o aceite de dados", () => {
    expect(leadCaptureSchema.safeParse({ ...CAPTURA, privacy_accepted: false }).success).toBe(false);
    // Ausente também recusa: `literal(true)` não tem valor padrão.
    const semAceite: Record<string, unknown> = { ...CAPTURA };
    delete semAceite.privacy_accepted;
    expect(leadCaptureSchema.safeParse(semAceite).success).toBe(false);
  });

  it("aceita todas as profissões que a interface oferece", () => {
    for (const o of LEAD_PROFESSIONS) {
      expect(leadCaptureSchema.safeParse({ ...CAPTURA, profession: o.value }).success).toBe(true);
    }
    expect(leadCaptureSchema.safeParse({ ...CAPTURA, profession: "astronauta" }).success).toBe(false);
  });

  it("normaliza telefone e e-mail", () => {
    const parsed = leadCaptureSchema.parse({
      ...CAPTURA,
      phone: "(11) 98765-4321",
      email: "  Maria@Exemplo.COM  ",
    });
    // Mesmo formato do resto do sistema: é o que a check constraint aceita e
    // o que o gateway espera.
    expect(parsed.phone).toBe("5511987654321");
    expect(parsed.email).toBe("maria@exemplo.com");
  });

  it("recusa e-mail inválido", () => {
    expect(leadCaptureSchema.safeParse({ ...CAPTURA, email: "maria@" }).success).toBe(false);
    expect(leadCaptureSchema.safeParse({ ...CAPTURA, email: "maria" }).success).toBe(false);
  });

  it("aceita a faixa de horas vinda da interação de custo", () => {
    for (const b of LEAD_HOURS_BANDS) {
      expect(leadCaptureSchema.safeParse({ ...CAPTURA, hours_lost_band: b.value }).success).toBe(true);
    }
  });
});

describe("leadContextSchema", () => {
  it("aceita responder uma pergunta só", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(leadContextSchema.safeParse({ id, team_size: "sozinho" }).success).toBe(true);
    expect(leadContextSchema.safeParse({ id, pain_points: ["faltas"] }).success).toBe(true);
    expect(leadContextSchema.safeParse({ id }).success).toBe(true);
  });

  it("exige um id válido", () => {
    expect(leadContextSchema.safeParse({ id: "nao-e-uuid", team_size: "sozinho" }).success).toBe(false);
  });
});

function leadOf(overrides: Partial<MarketResearchLead> = {}): MarketResearchLead {
  return {
    id: "lead-1",
    name: "Maria Silva",
    business_name: "Studio Aurora",
    email: "maria@exemplo.com",
    phone: "5511987654321",
    instagram: null,
    profession: "nail_designer",
    team_size: null,
    agenda_tools: [],
    pain_points: [],
    weekly_volume: null,
    whatsapp_reliance: null,
    improvement_wish: null,
    interest: null,
    hours_lost_band: "6_10",
    contact_allowed: true,
    privacy_accepted_at: "2026-09-04T12:00:00.000Z",
    source: "landing",
    utm: null,
    created_at: "2026-09-04T12:00:00.000Z",
    ...overrides,
  };
}

describe("buildLeadSummary", () => {
  it("traduz os valores gravados para os rótulos que a pessoa viu", () => {
    const summary = buildLeadSummary(leadOf());
    expect(summary).toContain("Nail designer");
    expect(summary).toContain("6 a 10h");
    expect(summary).toContain("Studio Aurora");
    // Nenhum identificador interno vaza para um texto lido no celular.
    expect(summary).not.toContain("nail_designer");
    expect(summary).not.toContain("6_10");
  });

  it("OMITE o contexto ainda não respondido", () => {
    // O aviso chega no primeiro envio, quando quase tudo está vazio. Uma
    // lista de dez "(não respondeu)" enterraria os cinco dados que importam.
    const summary = buildLeadSummary(leadOf());
    expect(summary).not.toContain("Modelo");
    expect(summary).not.toContain("Atendimentos/semana");
    expect(summary).not.toContain("Principal dificuldade");
    expect(summary).not.toContain("não respondeu");
  });

  it("mostra o contexto assim que ele existe", () => {
    const summary = buildLeadSummary(
      leadOf({ team_size: "sozinho", pain_points: ["faltas", "esquecer"] })
    );
    expect(summary).toContain("*Modelo:* Sozinho(a)");
    expect(summary).toContain("Clientes que faltam, Esquecer horários");
  });

  it("omite negócio e e-mail quando não informados", () => {
    const summary = buildLeadSummary(leadOf({ business_name: null, email: null }));
    expect(summary).not.toContain("Negócio");
    expect(summary).not.toContain("E-mail");
    expect(summary).toContain("Maria Silva");
  });
});
