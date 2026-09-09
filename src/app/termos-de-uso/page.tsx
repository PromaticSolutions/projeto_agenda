import type { Metadata } from "next";
import Link from "next/link";
import { LegalSection, LegalShell } from "@/components/legal/legal-shell";

/**
 * Termos de Uso.
 *
 * Mais enxuto que a política de privacidade de propósito: aqui o que precisa
 * ficar claro é quem responde pelo quê. A divisão controlador/operadora
 * descrita na seção 1 da política é a mesma, e é repetida aqui porque é dela
 * que sai a responsabilidade contratual de cada lado.
 *
 * A data de vigência é literal e não deriva de `POLICY_VERSION`: aquela
 * constante controla quando o aviso de cookies repergunta, e mudar os termos
 * não é motivo para repedir consentimento de cookie.
 */

const CONTATO = "contato@timely.exemplo";

export const metadata: Metadata = {
  title: "Termos de Uso — Timely",
  description:
    "Condições de uso do Timely: objeto do serviço, responsabilidades do estúdio e da plataforma, uso aceitável, limitação de responsabilidade e rescisão.",
  robots: { index: true, follow: true },
};

export default function TermosDeUsoPage() {
  return (
    <LegalShell
      title="Termos de Uso"
      updatedAt="setembro de 2026"
      summary="Estas condições regem o uso do Timely pelos estúdios que contratam o serviço e por quem agenda horários pelas páginas públicas dos estúdios."
    >
      <LegalSection id="objeto" title="1. O que o Timely é">
        <p>
          O Timely é um sistema de agenda online para negócios de horário
          marcado, operado pela Promatic Solutions. Ele oferece ao estúdio
          contratante: cadastro de serviços e horários de funcionamento, uma
          página pública de agendamento com link próprio, um painel para
          gerenciar a agenda e as clientes, e o envio automático de confirmações
          e lembretes por WhatsApp.
        </p>
        <p>
          O Timely é uma <strong>ferramenta</strong>. Ele não presta o serviço
          de beleza, estética ou qualquer outro atendimento marcado por meio
          dele, não intermedia pagamento entre estúdio e cliente e não é parte
          na relação entre os dois.
        </p>
      </LegalSection>

      <LegalSection id="responsabilidades" title="2. Quem responde pelo quê">
        <p>
          <strong>O estúdio é responsável por:</strong>
        </p>
        <ul>
          <li>
            Ser o controlador dos dados das próprias clientes, na forma da{" "}
            <Link href="/politica-de-privacidade">Política de Privacidade</Link>.
            Isso inclui responder a pedidos de acesso, correção e exclusão, e
            informar suas clientes sobre como os dados delas são usados.
          </li>
          <li>
            A veracidade do que publica na página pública — nome do negócio,
            serviços, valores, duração e horários de funcionamento.
          </li>
          <li>
            Prestar o atendimento marcado e resolver com a cliente qualquer
            questão sobre remarcação, cancelamento, cobrança e qualidade.
          </li>
          <li>
            O conteúdo que escreve nas observações do cadastro de clientes, e
            por não registrar ali dado sensível sem necessidade e sem base legal.
          </li>
          <li>
            Guardar suas credenciais de acesso e responder pelo que for feito
            com a conta.
          </li>
          <li>
            Usar o envio por WhatsApp apenas para comunicação relativa aos
            atendimentos, respeitando as regras da própria plataforma WhatsApp.
          </li>
        </ul>
        <p>
          <strong>A Promatic Solutions é responsável por:</strong>
        </p>
        <ul>
          <li>
            Manter a plataforma disponível e funcionando conforme descrito,
            aplicando medidas técnicas de segurança razoáveis.
          </li>
          <li>
            Atuar como operadora dos dados das clientes dos estúdios, tratando-os
            apenas para prestar o serviço e conforme as instruções do estúdio.
          </li>
          <li>
            Avisar com antecedência razoável sobre mudanças relevantes no
            serviço ou nestes termos.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="uso-aceitavel" title="3. Uso aceitável">
        <p>Ao usar o Timely, você concorda em não:</p>
        <ul>
          <li>
            Usar o sistema para atividade ilícita, ou para oferecer serviço que
            você não está habilitado a prestar.
          </li>
          <li>
            Enviar mensagens em massa, propaganda não solicitada ou qualquer
            comunicação alheia aos atendimentos agendados.
          </li>
          <li>
            Cadastrar dados de terceiros sem que exista base legal para isso.
          </li>
          <li>
            Tentar acessar dados de outro estúdio, contornar as regras de
            isolamento entre contas, sondar vulnerabilidades sem autorização
            prévia ou automatizar acesso de forma a degradar o serviço.
          </li>
          <li>
            Revender, sublicenciar ou expor o Timely como se fosse produto
            próprio, salvo acordo escrito.
          </li>
        </ul>
        <p>
          O descumprimento pode levar à suspensão imediata da conta, sem
          prejuízo das medidas legais cabíveis.
        </p>
      </LegalSection>

      <LegalSection id="disponibilidade" title="4. Disponibilidade e limitação de responsabilidade">
        <p>
          O serviço é prestado no estado em que se encontra. Trabalhamos para
          mantê-lo disponível, mas não garantimos funcionamento ininterrupto e
          livre de falhas: manutenções, indisponibilidade de fornecedores
          (incluindo a plataforma WhatsApp) e eventos fora do nosso controle
          podem interromper o serviço.
        </p>
        <p>
          <strong>O envio de mensagens depende de terceiros.</strong> Uma
          confirmação ou lembrete pode não ser entregue por bloqueio, número
          incorreto, restrição da plataforma WhatsApp ou instabilidade do
          provedor. O estúdio não deve tratar o lembrete automático como
          garantia de comparecimento nem como única forma de comunicação.
        </p>
        <p>
          Na medida permitida pela lei, a responsabilidade da Promatic Solutions
          por perdas relacionadas ao uso do Timely fica limitada ao valor pago
          pelo estúdio nos 12 meses anteriores ao fato. Não respondemos por
          lucros cessantes, perda de clientela ou danos indiretos. Nada aqui
          afasta responsabilidades que a lei não permite limitar, inclusive as
          decorrentes do Código de Defesa do Consumidor quando aplicável.
        </p>
      </LegalSection>

      <LegalSection id="planos" title="5. Planos e pagamento">
        <p>
          As condições comerciais vigentes — preço, ciclo de cobrança e limites
          de cada plano — são as informadas no momento da contratação. Mudanças
          de preço são comunicadas com antecedência e valem para o ciclo
          seguinte. A falta de pagamento pode levar à suspensão do acesso ao
          painel; a página pública do estúdio pode ficar indisponível junto.
        </p>
      </LegalSection>

      <LegalSection id="rescisao" title="6. Encerramento">
        <p>
          O estúdio pode encerrar a conta quando quiser, pelo painel ou pelo
          contato abaixo. Antes de encerrar, recomendamos exportar o que for
          preciso: o painel permite exportar a agenda em PDF.
        </p>
        <p>
          Podemos encerrar ou suspender uma conta em caso de violação destes
          termos, de ordem legal, ou com aviso prévio razoável em caso de
          descontinuação do serviço. Encerrada a conta, os dados são eliminados
          conforme a seção de retenção da{" "}
          <Link href="/politica-de-privacidade">Política de Privacidade</Link>.
        </p>
      </LegalSection>

      <LegalSection id="gerais" title="7. Disposições gerais">
        <p>
          Estes termos são regidos pela lei brasileira. Fica eleito o foro do
          domicílio do estúdio contratante para dirimir controvérsias, quando a
          lei permitir a eleição.
        </p>
        <p>
          Se alguma cláusula for considerada inválida, as demais continuam
          valendo. Mudanças relevantes nestes termos serão comunicadas; o uso
          continuado após a comunicação significa concordância.
        </p>
        <p>
          Contato: <a href={`mailto:${CONTATO}`}>{CONTATO}</a>.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
