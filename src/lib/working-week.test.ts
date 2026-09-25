import { describe, expect, it } from "vitest";
import {
  diffShifts,
  suggestNextPeriod,
  validateShifts,
  validateWeek,
  weekFromWorkingHours,
  weekToShifts,
  type DraftWeek,
} from "@/lib/working-week";
import type { WorkingHour } from "@/lib/types";

function hour(id: string, weekday: number, start: string, end: string): WorkingHour {
  return { id, studio_id: "s1", weekday, start_time: `${start}:00`, end_time: `${end}:00` } as WorkingHour;
}

function emptyWeek(): DraftWeek {
  return Array.from({ length: 7 }, () => ({ enabled: false, periods: [] }));
}

describe("weekFromWorkingHours", () => {
  it("liga só os dias com período e ordena por início", () => {
    const week = weekFromWorkingHours([hour("a", 1, "13:00", "18:00"), hour("b", 1, "09:00", "12:00")]);
    expect(week[1].enabled).toBe(true);
    expect(week[1].periods.map((p) => p.start)).toEqual(["09:00", "13:00"]);
    expect(week[0].enabled).toBe(false);
  });
});

describe("validateWeek", () => {
  it("aceita períodos em sequência", () => {
    const week = emptyWeek();
    week[1] = {
      enabled: true,
      periods: [
        { key: "a", start: "09:00", end: "12:00" },
        { key: "b", start: "12:00", end: "18:00" },
      ],
    };
    expect(validateWeek(week)).toEqual({});
  });

  it("marca fim antes do início", () => {
    const week = emptyWeek();
    week[2] = { enabled: true, periods: [{ key: "a", start: "18:00", end: "09:00" }] };
    expect(validateWeek(week).a).toMatch(/depois do início/);
  });

  it("marca o período sobreposto, não o primeiro", () => {
    const week = emptyWeek();
    week[3] = {
      enabled: true,
      periods: [
        { key: "a", start: "09:00", end: "13:00" },
        { key: "b", start: "12:00", end: "18:00" },
      ],
    };
    const errors = validateWeek(week);
    expect(errors.a).toBeUndefined();
    expect(errors.b).toMatch(/sobrepõe/);
  });

  it("ignora dias desligados", () => {
    const week = emptyWeek();
    week[4] = { enabled: false, periods: [{ key: "a", start: "18:00", end: "09:00" }] };
    expect(validateWeek(week)).toEqual({});
  });
});

describe("weekToShifts / validateShifts", () => {
  it("só exporta os dias ligados", () => {
    const week = emptyWeek();
    week[1] = { enabled: true, periods: [{ key: "a", start: "09:00", end: "18:00" }] };
    week[2] = { enabled: false, periods: [{ key: "b", start: "09:00", end: "18:00" }] };
    expect(weekToShifts(week)).toEqual([{ weekday: 1, start_time: "09:00", end_time: "18:00" }]);
  });

  it("recusa sobreposição na server action também", () => {
    expect(
      validateShifts([
        { weekday: 1, start_time: "09:00", end_time: "13:00" },
        { weekday: 1, start_time: "12:00", end_time: "18:00" },
      ])
    ).toMatch(/sobrepõe/);
    expect(validateShifts([{ weekday: 9, start_time: "09:00", end_time: "10:00" }])).toMatch(/inválido/);
  });
});

describe("suggestNextPeriod", () => {
  it("começa uma hora depois do último período", () => {
    const next = suggestNextPeriod([{ key: "a", start: "09:00", end: "12:00" }]);
    expect([next.start, next.end]).toEqual(["13:00", "16:00"]);
  });

  it("não passa da meia-noite", () => {
    const next = suggestNextPeriod([{ key: "a", start: "18:00", end: "22:30" }]);
    expect(next.end <= "23:59").toBe(true);
  });
});

describe("diffShifts", () => {
  it("não mexe no que não mudou", () => {
    const existing = [hour("a", 1, "09:00", "18:00")];
    expect(diffShifts(existing, [{ weekday: 1, start_time: "09:00", end_time: "18:00" }])).toEqual({
      toDelete: [],
      toCreate: [],
    });
  });

  it("troca o período alterado e apaga o removido", () => {
    const existing = [hour("a", 1, "09:00", "18:00"), hour("b", 2, "09:00", "18:00")];
    const result = diffShifts(existing, [{ weekday: 1, start_time: "10:00", end_time: "18:00" }]);
    expect(result.toDelete.sort()).toEqual(["a", "b"]);
    expect(result.toCreate).toEqual([{ weekday: 1, start_time: "10:00", end_time: "18:00" }]);
  });
});
