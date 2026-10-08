import {
  listSalonAttendants,
  listSalonConversations,
  narrowToAttendant,
  requireManager,
} from "@/lib/data/salons";
import { AttendantFilter } from "@/components/app/attendant-filter";
import { formatDateLocal, formatTimeLocal } from "@/lib/format";

export const metadata = { title: "Conversas do salão — Timely" };

const TYPE_LABELS: Record<string, string> = {
  texto: "",
  imagem: "📷 Foto",
  audio: "🎤 Áudio",
  video: "🎬 Vídeo",
  documento: "📄 Documento",
  outro: "Mensagem",
};

interface PageProps {
  searchParams: Promise<{ atendente?: string }>;
}

/**
 * Conversas das atendentes, em modo leitura.
 *
 * A gerente acompanha o atendimento; ela não responde no lugar de ninguém. As
 * policies da 0024 são `for select` e só, então mesmo que esta tela ganhasse um
 * campo de resposta amanhã, o banco recusaria a escrita — a decisão de abrir
 * isso seria uma policy nova, explícita.
 */
export default async function GerenciaConversasPage({ searchParams }: PageProps) {
  const manager = await requireManager();
  const [params, attendants] = await Promise.all([
    searchParams,
    listSalonAttendants(manager.salonId),
  ]);

  const studioIds = narrowToAttendant(
    attendants.map((a) => a.id),
    params.atendente
  );
  const conversations = await listSalonConversations(studioIds);
  const nameByStudio = new Map(attendants.map((a) => [a.id, a.name]));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Conversas do salão</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhamento em leitura — responder continua sendo com a atendente.
          </p>
        </div>
        <AttendantFilter attendants={attendants.map((a) => ({ id: a.id, name: a.name }))} />
      </header>

      {conversations.length === 0 ? (
        <div className="panel flex flex-col items-center gap-1 border-dashed p-10 text-center">
          <p className="font-medium text-foreground">Nenhuma conversa ainda</p>
          <p className="text-sm text-muted-foreground">
            Elas aparecem quando uma atendente conecta o WhatsApp dela e começa a trocar
            mensagens.
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Contato</th>
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Atendente</th>
                  <th className="section-label px-4 py-2.5 text-muted-foreground">
                    Última mensagem
                  </th>
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Quando</th>
                  <th className="section-label px-4 py-2.5 text-right text-muted-foreground">
                    Não lidas
                  </th>
                </tr>
              </thead>
              <tbody>
                {conversations.map((conversation) => {
                  const lastAt = new Date(conversation.last_at);
                  const typeLabel = TYPE_LABELS[conversation.last_type] ?? "";
                  return (
                    <tr
                      key={`${conversation.studio_id}:${conversation.chat_id}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">
                          {conversation.display_name}
                        </span>
                        {conversation.is_group ? (
                          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            grupo
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {nameByStudio.get(conversation.studio_id) ?? "—"}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                        {typeLabel ? `${typeLabel} ` : ""}
                        {conversation.last_body ?? ""}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateLocal(lastAt)} {formatTimeLocal(lastAt)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {conversation.unread_count || ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
