import { MessageCircle } from "lucide-react";
import { getPlatformWhatsApp } from "@/lib/data/platform-whatsapp";
import { PlatformWhatsAppPanel } from "@/components/superadmin/platform-whatsapp-panel";

export const metadata = { title: "WhatsApp da plataforma — Timely" };

/**
 * Onde se configura para onde vão as respostas do formulário da landing.
 *
 * O acesso já foi negado no layout do /superadmin para quem não é
 * `platform_admin`; as actions repetem a checagem porque Server Action é
 * endpoint público — o layout esconde a tela, não fecha a porta.
 */
export default async function SuperAdminWhatsAppPage() {
  const conexao = await getPlatformWhatsApp();

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-border pb-5">
        <h1 className="text-xl font-semibold text-foreground">WhatsApp da plataforma</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O número por onde a Promatic recebe os leads da página inicial.
        </p>
      </header>

      {/* Por que são DOIS números, e não um campo só: WhatsApp não tem caixa de
          entrada avulsa. Para a mensagem chegar, alguma sessão conectada
          precisa enviá-la — e quem lê o QR vira o remetente, não o
          destinatário. Sem essa explicação a tela pareceria pedir a mesma coisa
          duas vezes. */}
      <div className="panel flex gap-3 p-4">
        <MessageCircle className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">Como isto funciona</p>
          <p className="text-muted-foreground">
            O WhatsApp não entrega mensagem sem remetente. O número conectado
            abaixo é quem <strong className="font-medium text-foreground">envia</strong> o
            aviso; o segundo campo é quem{" "}
            <strong className="font-medium text-foreground">recebe</strong>. Se você
            só tem um chip, ponha o mesmo número nos dois — a mensagem chega em
            “Mensagem para você mesmo”.
          </p>
          <p className="text-muted-foreground">
            Esta instância é separada da de cada estúdio de propósito: usar o
            WhatsApp de um cliente para tráfego da plataforma misturaria as duas
            coisas.
          </p>
        </div>
      </div>

      <PlatformWhatsAppPanel conexao={conexao} />

      {/* Aviso de privacidade, não decoração: o resumo do lead que sai por aqui
          leva nome, telefone e e-mail de quem preencheu o formulário. */}
      <p className="text-xs text-muted-foreground">
        O aviso enviado contém os dados que a pessoa preencheu — nome, telefone e
        e-mail. Eles trafegam pelo seu servidor Evolution e pelo WhatsApp.
      </p>
    </div>
  );
}
