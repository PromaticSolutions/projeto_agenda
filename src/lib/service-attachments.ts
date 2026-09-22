import type { ServiceAttachmentItem } from "@/lib/validation";

export type NewAttachment = Extract<ServiceAttachmentItem, { storage_path: string }>;

export interface AttachmentSyncPlan {
  toInsert: NewAttachment[];
  /** Anexos que existiam e saíram da lista: linha e objeto no Storage somem. */
  toDelete: { id: string; storage_path: string }[];
}

/**
 * Compara o que está gravado com o que o formulário mandou no Salvar.
 *
 * Função pura para dar para testar sem banco. As regras de segurança moram
 * aqui porque a lista chega de um campo escondido, editável por quem quiser:
 * - `id` que não é deste serviço é ignorado (não dá para "adotar" anexo alheio);
 * - arquivo novo só entra se o caminho estiver na pasta do estúdio. Apontar
 *   para o arquivo de OUTRO serviço esbarra no `unique` de storage_path (0020).
 */
export function planAttachmentSync(
  studioId: string,
  existing: { id: string; storage_path: string }[],
  desired: ServiceAttachmentItem[]
): AttachmentSyncPlan {
  const keptIds = new Set<string>();
  const toInsert: NewAttachment[] = [];
  const existingPaths = new Set(existing.map((a) => a.storage_path));
  const seenPaths = new Set<string>();

  for (const item of desired) {
    if ("id" in item) {
      keptIds.add(item.id);
      continue;
    }
    const path = item.storage_path;
    if (!isPathInStudio(studioId, path)) continue;
    if (existingPaths.has(path) || seenPaths.has(path)) continue;
    seenPaths.add(path);
    toInsert.push(item);
  }

  const toDelete = existing
    .filter((a) => !keptIds.has(a.id))
    .map(({ id, storage_path }) => ({ id, storage_path }));

  return { toInsert, toDelete };
}

/** `<studio_id>/qualquer-coisa`, sem `..` para escapar da pasta. */
export function isPathInStudio(studioId: string, path: string): boolean {
  return path.startsWith(`${studioId}/`) && !path.split("/").includes("..");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
