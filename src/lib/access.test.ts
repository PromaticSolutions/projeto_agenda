import { describe, expect, it } from "vitest";
import { attendantStatus, can, homePathFor, managedSalonId, type Actor } from "@/lib/access";

const SALON_A = "11111111-1111-1111-1111-111111111111";
const SALON_B = "22222222-2222-2222-2222-222222222222";
const STUDIO_A1 = "aaaaaaa1-0000-0000-0000-000000000000";
const STUDIO_A2 = "aaaaaaa2-0000-0000-0000-000000000000";
const STUDIO_B1 = "bbbbbbb1-0000-0000-0000-000000000000";
const STUDIO_AUTONOMA = "ccccccc1-0000-0000-0000-000000000000";

const atendenteDoSalao: Actor = {
  role: "atendente",
  userId: "u-a1",
  studioId: STUDIO_A1,
  salonId: SALON_A,
};

/** O caso da profissional que comprou o sistema sozinha: sem salão. */
const atendenteAutonoma: Actor = {
  role: "atendente",
  userId: "u-auto",
  studioId: STUDIO_AUTONOMA,
  salonId: null,
};

const gerenteA: Actor = { role: "gerente", userId: "u-g-a", salonId: SALON_A };
const gerenteB: Actor = { role: "gerente", userId: "u-g-b", salonId: SALON_B };

describe("atendente", () => {
  it("lê e escreve o próprio estúdio", () => {
    expect(can(atendenteDoSalao, "studio:read", { studioId: STUDIO_A1 })).toBe(true);
    expect(can(atendenteDoSalao, "studio:write", { studioId: STUDIO_A1 })).toBe(true);
  });

  it("não alcança o estúdio de uma colega do MESMO salão", () => {
    expect(can(atendenteDoSalao, "studio:read", { studioId: STUDIO_A2, salonId: SALON_A })).toBe(
      false
    );
    expect(can(atendenteDoSalao, "studio:write", { studioId: STUDIO_A2, salonId: SALON_A })).toBe(
      false
    );
  });

  it("não gerencia atendente", () => {
    expect(can(atendenteDoSalao, "attendant:list", { salonId: SALON_A })).toBe(false);
    expect(can(atendenteDoSalao, "attendant:create", { salonId: SALON_A })).toBe(false);
    expect(can(atendenteDoSalao, "attendant:update", { salonId: SALON_A })).toBe(false);
  });

  it("autônoma funciona igual: o próprio estúdio, sem salão nenhum", () => {
    expect(can(atendenteAutonoma, "studio:read", { studioId: STUDIO_AUTONOMA })).toBe(true);
    expect(can(atendenteAutonoma, "studio:write", { studioId: STUDIO_AUTONOMA })).toBe(true);
    expect(homePathFor(atendenteAutonoma)).toBe("/app");
  });
});

describe("gerente", () => {
  it("lê os estúdios do próprio salão", () => {
    expect(can(gerenteA, "studio:read", { studioId: STUDIO_A1, salonId: SALON_A })).toBe(true);
    expect(can(gerenteA, "studio:read", { studioId: STUDIO_A2, salonId: SALON_A })).toBe(true);
  });

  it("lê, mas não escreve, a operação das atendentes", () => {
    expect(can(gerenteA, "studio:write", { studioId: STUDIO_A1, salonId: SALON_A })).toBe(false);
  });

  it("cadastra e edita atendente no próprio salão", () => {
    expect(can(gerenteA, "attendant:list")).toBe(true);
    expect(can(gerenteA, "attendant:create", { salonId: SALON_A })).toBe(true);
    expect(can(gerenteA, "attendant:update", { salonId: SALON_A })).toBe(true);
  });

  it("o salão da gerente vem da sessão, não do formulário", () => {
    expect(managedSalonId(gerenteA)).toBe(SALON_A);
    expect(managedSalonId(atendenteDoSalao)).toBeNull();
    expect(managedSalonId(atendenteAutonoma)).toBeNull();
  });
});

describe("isolamento entre salões", () => {
  it("a gerente do A não lê nada do B", () => {
    expect(can(gerenteA, "studio:read", { studioId: STUDIO_B1, salonId: SALON_B })).toBe(false);
    expect(can(gerenteA, "attendant:list", { salonId: SALON_B })).toBe(false);
    expect(can(gerenteA, "attendant:create", { salonId: SALON_B })).toBe(false);
    expect(can(gerenteA, "attendant:update", { salonId: SALON_B })).toBe(false);
  });

  it("e o contrário também", () => {
    expect(can(gerenteB, "studio:read", { studioId: STUDIO_A1, salonId: SALON_A })).toBe(false);
    expect(can(gerenteB, "attendant:create", { salonId: SALON_A })).toBe(false);
  });

  it("o Target precisa vir do banco: com salão forjado, `can` diz sim", () => {
    /* Armadilha documentada de propósito. `can` compara o salão que recebe;
       se quem monta o Target copiar o salão da SESSÃO em vez de ler
       `studios.salon_id` do estúdio alvo, a checagem vira carimbo.
       Por isso o Target é sempre montado a partir da linha lida do banco
       (`assertStudioInMySalon`, em src/lib/data/salons.ts) — e por isso a RLS
       da 0024 existe como segunda barreira, independente deste módulo. */
    expect(can(gerenteA, "studio:read", { studioId: STUDIO_B1, salonId: SALON_A })).toBe(true);
  });

  it("NENHUMA gerente alcança a profissional autônoma", () => {
    // `salon_id` nulo dos dois lados não pode casar: seria dar toda autônoma
    // do sistema para toda gerente.
    expect(can(gerenteA, "studio:read", { studioId: STUDIO_AUTONOMA, salonId: null })).toBe(false);
    expect(can(gerenteB, "studio:read", { studioId: STUDIO_AUTONOMA, salonId: null })).toBe(false);
    expect(can(gerenteA, "attendant:update", { salonId: null })).toBe(false);
    expect(can(gerenteA, "attendant:create", { salonId: undefined })).toBe(false);
  });
});

describe("sem vínculo", () => {
  it("não pode nada e vai para o onboarding", () => {
    const novata: Actor = { role: "sem_vinculo", userId: "u-nova" };
    expect(can(novata, "studio:read", { studioId: STUDIO_A1 })).toBe(false);
    expect(can(novata, "attendant:list")).toBe(false);
    expect(homePathFor(novata)).toBe("/app/onboarding");
  });
});

describe("homePathFor", () => {
  it("manda a gerente para a área de gerência", () => {
    expect(homePathFor(gerenteA)).toBe("/app/gerencia");
  });
});

describe("attendantStatus", () => {
  it("lê a data de desativação", () => {
    expect(attendantStatus({ deactivated_at: null })).toBe("ativa");
    expect(attendantStatus({ deactivated_at: "2026-10-01T12:00:00Z" })).toBe("inativa");
  });
});
