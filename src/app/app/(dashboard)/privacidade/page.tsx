import { ShieldCheck } from "lucide-react";
import { getMyStudio } from "@/lib/data/studios";
import { listDataSubjectRequests } from "@/lib/data/data-requests";
import { CopyLinkButton } from "@/components/app/copy-link-button";
import { formatDateLocal, formatPhoneDisplay, getStudioPublicUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DataRequestActions } from "@/components/app/data-request-actions";
import type { DataRequestKind, DataRequestStatus } from "@/lib/types";

export const metadata = { title: "Privacidade — Timely" };

/**
 * Fila de solicitações do titular (LGPD art. 18).
 *
 * O atendimento é MANUAL por decisão de projeto — ver a nota em
 * 0016_data_subject_requests.sql. Esta tela existe para que o pedido não morra
 * numa tabela que ninguém abre: ela mostra o que está aberto, há quanto tempo,
 * e deixa registrar o que foi feito.
 *
 * Server Component; só os controles de cada linha descem como JavaScript.
 */

const KIND_LABEL: Record<DataRequestKind, string> = {
  acesso: "Acesso aos dados",
  correcao: "Correção de dado",
  exclusao: "Exclusão de dados",
  oposicao: "Parar de receber mensagens",
};

const STATUS_LABEL: Record<DataRequestStatus, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  recusada: "Recusada",
};

const STATUS_CLASS: Record<DataRequestStatus, string> = {
  aberta: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  em_andamento: "bg-primary/10 text-primary",
  concluida: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  recusada: "bg-muted text-muted-foreground",
};

/** Dias corridos desde o pedido. O prazo do art. 19 é de 15 dias. */
function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default async function PrivacidadePage() {
  const studio = await getMyStudio();
  if (!studio) return null;

  const requests = await listDataSubjectRequests(studio.id);
  const abertas = requests.filter(
    (r) => r.status === "aberta" || r.status === "em_andamento"
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Privacidade</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos das suas clientes sobre os próprios dados.
          </p>
        </div>
        <CopyLinkButton url={`${getStudioPublicUrl(studio.slug)}/meus-dados`} />
      </header>

      {/* Contexto de responsabilidade. Não é decoração: a maior parte dos donos
          de estúdio não sabe que é o controlador dos dados das clientes, e o
          prazo de 15 dias começa a correr sem ninguém avisar. */}
      <div className="panel flex gap-3 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">
            Você é a responsável pelos dados das suas clientes.
          </p>
          <p className="text-muted-foreground">
            A lei dá <strong className="font-medium text-foreground">15 dias</strong> para
            responder a cada pedido. Atender pode significar apagar um cadastro,
            corrigir um dado ou parar de enviar lembretes — e parte do histórico
            pode precisar ser mantida por obrigação fiscal, o que é motivo válido
            para recusar, desde que você explique.
          </p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2 border-dashed p-10 text-center">
          <p className="font-medium text-foreground">Nenhuma solicitação até agora</p>
          <p className="max-w-md text-sm text-muted-foreground">
            O canal fica no rodapé da sua página de agendamento, em “Meus dados”.
            Ele precisa existir mesmo que ninguém use.
          </p>
        </div>
      ) : (
        <>
          {abertas.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {abertas.length}{" "}
              {abertas.length === 1 ? "pedido aguardando" : "pedidos aguardando"} resposta.
            </p>
          )}

          <ul className="flex flex-col gap-3">
            {requests.map((r) => {
              const dias = diasDesde(r.created_at);
              const atrasada =
                (r.status === "aberta" || r.status === "em_andamento") && dias > 15;
              return (
                <li key={r.id} className={cn("panel p-4", atrasada && "border-destructive/50")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{KIND_LABEL[r.kind]}</p>
                      <p className="text-sm text-muted-foreground">
                        {r.client_name} · {formatPhoneDisplay(r.client_phone)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        STATUS_CLASS[r.status]
                      )}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>

                  {r.message && (
                    <p className="mt-3 rounded-lg bg-muted p-3 text-sm text-foreground">
                      {r.message}
                    </p>
                  )}

                  <p className={cn("mt-3 text-xs", atrasada ? "text-destructive" : "text-muted-foreground")}>
                    Recebido em {formatDateLocal(new Date(r.created_at))}
                    {dias > 0 && ` · há ${dias} ${dias === 1 ? "dia" : "dias"}`}
                    {atrasada && " · fora do prazo de 15 dias"}
                  </p>

                  {r.resolution_note && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      <strong className="font-medium text-foreground">O que foi feito:</strong>{" "}
                      {r.resolution_note}
                    </p>
                  )}

                  {(r.status === "aberta" || r.status === "em_andamento") && (
                    <DataRequestActions id={r.id} status={r.status} />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
