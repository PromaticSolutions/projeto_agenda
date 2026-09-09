import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { LEADS_PAGE_LIMIT, listLeads } from "@/lib/data/leads";
import { getPlatformWhatsApp } from "@/lib/data/platform-whatsapp";
import { LeadsTable } from "@/components/superadmin/leads-table";

export const metadata = { title: "Leads — Timely Admin" };

/**
 * Quem preencheu o formulário da página inicial.
 *
 * Esta tela é o REGISTRO; o aviso no WhatsApp é a notificação. A distinção
 * importa porque o aviso tem três pontos de falha fora do controle de quem
 * espera por ele — sessão caída, destino não configurado, disparador parado —
 * e antes desta tela um lead que caísse em qualquer um dos três ficava
 * invisível: gravado no banco, e em lugar nenhum do produto.
 *
 * O acesso já foi negado no layout do /superadmin para quem não é
 * `platform_admin`.
 */
export default async function SuperAdminLeadsPage() {
  const [{ leads, total }, conexao] = await Promise.all([listLeads(), getPlatformWhatsApp()]);

  // Por que o aviso pode não estar saindo, dito na tela em que a pergunta
  // nasce. Sem isto, "não recebi nada no WhatsApp" obriga a abrir outra tela
  // para descobrir qual das duas condições falta.
  const semDestino = !conexao.notify_phone;
  const semSessao = conexao.status !== "conectado";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header className="space-y-1 border-b border-border pb-5">
        <h1 className="text-xl font-semibold text-foreground">Leads</h1>
        <p className="text-sm text-muted-foreground">
          Cada pessoa que preencheu o formulário da página inicial. O registro fica
          aqui mesmo quando o aviso no WhatsApp não sai.
        </p>
      </header>

      {(semDestino || semSessao) && (
        <div className="panel flex gap-3 border-amber-500/40 bg-amber-500/5 p-4">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">O aviso no WhatsApp não está saindo</p>
            <p className="text-muted-foreground">
              {semSessao && semDestino
                ? "A instância da plataforma não está conectada e não há número de destino configurado."
                : semSessao
                  ? "A instância da plataforma não está conectada — sem remetente, o aviso não é nem enfileirado."
                  : "Não há número de destino configurado, então ninguém é avisado."}{" "}
              Os leads continuam sendo gravados normalmente e aparecem nesta lista.
            </p>
            <Link
              href="/superadmin/whatsapp"
              className="inline-block font-medium text-primary underline-offset-2 hover:underline"
            >
              Configurar o WhatsApp da plataforma
            </Link>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {total === 1 ? "1 lead" : `${total.toLocaleString("pt-BR")} leads`}
        {total > LEADS_PAGE_LIMIT && ` — mostrando os ${LEADS_PAGE_LIMIT} mais recentes`}
      </p>

      <LeadsTable leads={leads} />

      {/* Aviso de privacidade, não decoração: esta tela mostra nome, telefone e
          e-mail de quem preencheu o formulário. */}
      <p className="text-xs text-muted-foreground">
        Dados pessoais coletados com consentimento na página inicial. Use-os apenas
        para o contato que a pessoa pediu.
      </p>
    </div>
  );
}
