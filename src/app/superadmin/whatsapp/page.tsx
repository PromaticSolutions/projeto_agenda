import { AlertTriangle, CheckCircle2, MessageCircle, XCircle } from "lucide-react";
import { getPlatformWhatsApp } from "@/lib/data/platform-whatsapp";
import { listPlatformMessages } from "@/lib/data/outbox";
import { PlatformWhatsAppPanel } from "@/components/superadmin/platform-whatsapp-panel";
import { RetryNoticeButton, TestMessageButton } from "@/components/superadmin/platform-notices";
import { formatFullDateLocal, formatPhoneDisplay, formatTimeLocal } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MessageOutbox, MessageOutboxStatus } from "@/lib/types";

export const metadata = { title: "WhatsApp da plataforma — Timely" };

const NOTICE_STATUS: Record<MessageOutboxStatus, { texto: string; classe: string }> = {
  enviado: { texto: "Enviado", classe: "bg-emerald-500/10 text-emerald-700" },
  pendente: { texto: "Esperando envio", classe: "bg-amber-500/10 text-amber-700" },
  enviando: { texto: "Enviando", classe: "bg-amber-500/10 text-amber-700" },
  falhou: { texto: "Falhou", classe: "bg-destructive/10 text-destructive" },
  cancelado: { texto: "Cancelado", classe: "bg-muted text-muted-foreground" },
};

/**
 * Os avisos de lead da landing: quem envia, quem recebe, e o que saiu.
 *
 * A tela abre pelo veredito ("funcionando" ou "parado, e por quê") porque o
 * problema real foi esse: em setembro a sessão caiu, ficou semanas em
 * "aguardando QR", e nada em lugar nenhum dizia que os avisos tinham parado.
 *
 * O acesso já foi negado no layout do /superadmin para quem não é
 * `platform_admin`; as actions repetem a checagem porque Server Action é
 * endpoint público — o layout esconde a tela, não fecha a porta.
 */
export default async function SuperAdminWhatsAppPage() {
  const [conexao, notices] = await Promise.all([getPlatformWhatsApp(), listPlatformMessages(30)]);

  const conectado = conexao.status === "conectado";
  const destino = conexao.notify_phone;
  const parados = notices.filter((n) => n.status === "pendente" || n.status === "enviando").length;
  const falhas = notices.filter((n) => n.status === "falhou").length;
  const ultimoEnviado = notices.find((n) => n.status === "enviado" && n.sent_at);
  const funcionando = conectado && destino !== null;

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-border pb-5">
        <h1 className="text-xl font-semibold text-foreground">WhatsApp da plataforma</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada formulário preenchido na página inicial vira uma mensagem no número que recebe.
        </p>
      </header>

      <section
        className={cn(
          "panel flex flex-col gap-4 p-5",
          funcionando ? "border-emerald-600/40" : "border-destructive/40"
        )}
      >
        <div className="flex items-start gap-3">
          {funcionando ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
          ) : (
            <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
          )}
          <div>
            <h2 className="font-medium text-foreground">
              {funcionando ? "Avisos funcionando" : "Avisos parados"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {funcionando
                ? "Formulário novo chega no WhatsApp em segundos."
                : "Os leads continuam sendo gravados e os avisos esperam na fila — saem assim que o problema abaixo for resolvido."}
            </p>
          </div>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <Check
            ok={conectado}
            label="Número que envia"
            value={
              conectado
                ? conexao.connected_phone
                  ? `Conectado · ${formatPhoneDisplay(conexao.connected_phone)}`
                  : "Conectado"
                : conexao.status === "conectando"
                  ? "Aguardando leitura do QR — conecte abaixo"
                  : "Desconectado — conecte abaixo"
            }
          />
          <Check
            ok={destino !== null}
            label="Número que recebe"
            value={destino ? formatPhoneDisplay(destino) : "Não definido — preencha abaixo"}
          />
          <Check
            ok={parados === 0 && falhas === 0}
            warn
            label="Fila de avisos"
            value={
              parados > 0 || falhas > 0
                ? [parados > 0 && `${parados} esperando envio`, falhas > 0 && `${falhas} com falha`]
                    .filter(Boolean)
                    .join(" · ")
                : ultimoEnviado?.sent_at
                  ? `Nada parado · último enviado ${formatFullDateLocal(new Date(ultimoEnviado.sent_at))}`
                  : "Nada parado"
            }
          />
        </dl>

        <TestMessageButton disabled={!destino} />
      </section>

      <PlatformWhatsAppPanel conexao={conexao} />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Últimos avisos</h2>
          <p className="text-xs text-muted-foreground">
            O que saiu (ou não) para o número que recebe. Aviso parado sai sozinho quando a
            conexão volta; “Enviar agora” força a tentativa.
          </p>
        </div>
        <NoticesTable notices={notices} />
      </section>

      {/* Por que são DOIS números, e não um campo só: WhatsApp não tem caixa de
          entrada avulsa. Para a mensagem chegar, alguma sessão conectada
          precisa enviá-la — e quem lê o QR vira o remetente, não o
          destinatário. */}
      <div className="panel flex gap-3 p-4">
        <MessageCircle className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">Como isto funciona</p>
          <p className="text-muted-foreground">
            O WhatsApp não entrega mensagem sem remetente. O número conectado é quem{" "}
            <strong className="font-medium text-foreground">envia</strong> o aviso; o número de
            destino é quem <strong className="font-medium text-foreground">recebe</strong>. Se você
            só tem um chip, ponha o mesmo número nos dois — a mensagem chega em “Mensagem para
            você mesmo”.
          </p>
          <p className="text-muted-foreground">
            Esta instância é separada da de cada estúdio de propósito: usar o WhatsApp de um
            cliente para tráfego da plataforma misturaria as duas coisas.
          </p>
        </div>
      </div>

      {/* Aviso de privacidade, não decoração: o resumo do lead que sai por aqui
          leva nome, telefone e e-mail de quem preencheu o formulário. */}
      <p className="text-xs text-muted-foreground">
        O aviso enviado contém os dados que a pessoa preencheu — nome, telefone e e-mail. Eles
        trafegam pelo seu servidor Evolution e pelo WhatsApp.
      </p>
    </div>
  );
}

function Check({
  ok,
  warn = false,
  label,
  value,
}: {
  ok: boolean;
  /** Problema que não impede o envio: amarelo em vez de vermelho. */
  warn?: boolean;
  label: string;
  value: string;
}) {
  const Icon = ok ? CheckCircle2 : warn ? AlertTriangle : XCircle;
  return (
    <div className="flex min-w-0 gap-2">
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          ok ? "text-emerald-600" : warn ? "text-amber-600" : "text-destructive"
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-foreground">{value}</dd>
      </div>
    </div>
  );
}

/** "*Nome:* Fulana" → "Fulana". O aviso guarda o texto pronto, não o lead. */
function noticeTitle(notice: MessageOutbox): string {
  if (notice.body.startsWith("*TESTE")) return "Mensagem de teste";
  const name = /\*Nome:\*\s*(.+)/.exec(notice.body)?.[1]?.trim();
  const repeated = notice.body.startsWith("*LEAD PREENCHEU DE NOVO");
  return name ? `${name}${repeated ? " (preencheu de novo)" : ""}` : "Aviso de lead";
}

function NoticesTable({ notices }: { notices: MessageOutbox[] }) {
  if (notices.length === 0) {
    return (
      <p className="panel border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum aviso ainda. Quando alguém preencher o formulário da landing, aparece aqui.
      </p>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Quando</th>
              <th className="px-4 py-2.5 font-medium">Lead</th>
              <th className="px-4 py-2.5 font-medium">Para</th>
              <th className="px-4 py-2.5 font-medium">Situação</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {notices.map((notice) => {
              const created = new Date(notice.created_at);
              const status = NOTICE_STATUS[notice.status];
              const retryable =
                notice.status === "pendente" || notice.status === "falhou" || notice.status === "cancelado";
              return (
                <tr key={notice.id}>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {formatFullDateLocal(created)} {formatTimeLocal(created)}
                  </td>
                  <td className="px-4 py-2.5 text-foreground">{noticeTitle(notice)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {formatPhoneDisplay(notice.to_phone)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", status.classe)}>
                      {status.texto}
                    </span>
                    {notice.status === "enviado" && notice.sent_at ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        às {formatTimeLocal(new Date(notice.sent_at))} de{" "}
                        {formatFullDateLocal(new Date(notice.sent_at))}
                      </span>
                    ) : (
                      notice.last_error && (
                        <span className="mt-0.5 block max-w-xs text-xs text-muted-foreground">
                          {notice.last_error}
                        </span>
                      )
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {retryable && <RetryNoticeButton messageId={notice.id} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
