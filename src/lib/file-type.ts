/**
 * Descobre o tipo do arquivo pelo CONTEÚDO, não pelo `file.type`.
 *
 * O cabeçalho enviado pelo browser é controlado pelo cliente: um .exe
 * renomeado chega como "image/png" sem esforço nenhum. Conferir a assinatura
 * dos primeiros bytes é o que realmente garante que os buckets só recebam o
 * que aceitam.
 */
export function sniffFileType(bytes: Uint8Array): string | null {
  const startsWith = (offset: number, ...signature: number[]) =>
    signature.every((byte, i) => bytes[offset + i] === byte);

  if (startsWith(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (startsWith(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";

  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));

  // WebP e AVIF são contêineres: a marca fica depois do tamanho do bloco.
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(8, 4))) return "image/avif";

  if (ascii(0, 5) === "%PDF-") return "application/pdf";

  return null;
}

export const FILE_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "application/pdf": "pdf",
};
