import { describe, expect, it } from "vitest";
import { sniffFileType } from "@/lib/file-type";
import { formatFileSize, isPathInStudio, planAttachmentSync } from "@/lib/service-attachments";
import { serviceAttachmentListSchema } from "@/lib/validation";

const STUDIO = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const A1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const A2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const newFile = (path: string) => ({
  storage_path: path,
  file_name: "foto.jpg",
  mime_type: "image/jpeg" as const,
  size_bytes: 1000,
});

describe("sniffFileType", () => {
  const bytes = (...values: (number | string)[]) =>
    new Uint8Array(
      values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v]))
    );

  it("reconhece PDF pela assinatura", () => {
    expect(sniffFileType(bytes("%PDF-1.7\n"))).toBe("application/pdf");
  });

  it("reconhece JPEG e PNG", () => {
    expect(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
  });

  it("recusa o que não conhece, mesmo com nome de imagem", () => {
    expect(sniffFileType(bytes("MZ", 0x90, 0x00))).toBeNull();
    expect(sniffFileType(bytes("PK", 0x03, 0x04))).toBeNull();
  });
});

describe("planAttachmentSync", () => {
  const existing = [
    { id: A1, storage_path: `${STUDIO}/services/a1.jpg` },
    { id: A2, storage_path: `${STUDIO}/services/a2.pdf` },
  ];

  it("mantém os que vieram por id e apaga os que saíram", () => {
    const plan = planAttachmentSync(STUDIO, existing, [{ id: A1 }]);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toDelete).toEqual([existing[1]]);
  });

  it("insere os recém-enviados da pasta do estúdio", () => {
    const fresh = newFile(`${STUDIO}/services/novo.jpg`);
    const plan = planAttachmentSync(STUDIO, existing, [{ id: A1 }, { id: A2 }, fresh]);
    expect(plan.toInsert).toEqual([fresh]);
    expect(plan.toDelete).toEqual([]);
  });

  it("ignora caminho de outro estúdio ou que tenta sair da pasta", () => {
    const plan = planAttachmentSync(STUDIO, [], [
      newFile(`${OTHER}/services/x.jpg`),
      newFile(`${STUDIO}/../${OTHER}/services/x.jpg`),
    ]);
    expect(plan.toInsert).toEqual([]);
  });

  it("não duplica um caminho repetido nem um que já está gravado", () => {
    const repeated = newFile(`${STUDIO}/services/r.jpg`);
    const plan = planAttachmentSync(STUDIO, existing, [
      { id: A1 },
      { id: A2 },
      repeated,
      repeated,
      newFile(existing[0].storage_path),
    ]);
    expect(plan.toInsert).toEqual([repeated]);
  });

  it("lista vazia apaga tudo", () => {
    expect(planAttachmentSync(STUDIO, existing, []).toDelete).toHaveLength(2);
  });
});

describe("isPathInStudio", () => {
  it("exige o prefixo exato com barra", () => {
    expect(isPathInStudio(STUDIO, `${STUDIO}/services/a.jpg`)).toBe(true);
    expect(isPathInStudio(STUDIO, `${STUDIO}x/services/a.jpg`)).toBe(false);
  });
});

describe("serviceAttachmentListSchema", () => {
  it("recusa tipo fora da lista", () => {
    const result = serviceAttachmentListSchema.safeParse([
      { ...newFile(`${STUDIO}/a.exe`), mime_type: "application/x-msdownload" },
    ]);
    expect(result.success).toBe(false);
  });

  it("recusa mais de 20 arquivos", () => {
    const many = Array.from({ length: 21 }, (_, i) => newFile(`${STUDIO}/services/${i}.jpg`));
    expect(serviceAttachmentListSchema.safeParse(many).success).toBe(false);
  });
});

describe("formatFileSize", () => {
  it("usa vírgula decimal em MB", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1,5 MB");
  });
});
