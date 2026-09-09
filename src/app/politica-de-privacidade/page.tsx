import type { Metadata } from "next";
import Link from "next/link";
import { LegalSection, LegalShell } from "@/components/legal/legal-shell";
import { POLICY_VERSION } from "@/lib/consent";

/**
 * Política de Privacidade.
 *
 * Server Component estático — é texto, não tem estado nem dado de servidor.
 *
 * A DATA DE VIGÊNCIA abaixo é derivada de `POLICY_VERSION` (`lib/consent.ts`),
 * não digitada à mão. É essa versão que o cookie de consentimento guarda e que
 * decide se o banner volta a aparecer; se a data aqui e a constante lá
 * pudessem divergir, o texto mudaria sem ninguém ser perguntado de novo.
 *
 * O conteúdo descreve o tratamento que ESTE produto faz, conferido no código:
 * o fluxo público de `booking-flow.tsx`, o CRM de `clients`, a fila do
 * `message_outbox` que sai pela Evolution API e a captura de leads da landing.
 * Texto genérico de internet listaria "cookies de publicidade" e "parceiros de
 * marketing", que aqui não existem — e descrever tratamento que não acontece é
 * tão errado quanto esconder o que acontece.
 */

/** Placeholder — trocar pelo endereço real antes de publicar. */
const CONTATO_PRIVACIDADE = "privacidade@timely.exemplo";

/** "2026-09" -> "setembro de 2026". */
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
function vigenciaPorExtenso(versao: string): string {
  const [ano, mes] = versao.split("-");
  const nome = MESES[Number(mes) - 1];
  return nome ? `${nome} de ${ano}` : versao;
}

export const metadata: Metadata = {
  title: "Política de Privacidade — Timely",
  description:
    "Como o Timely trata dados pessoais: o que é coletado no agendamento público, no CRM e no cadastro do estúdio, com que base legal, por quanto tempo e como exercer seus direitos.",
  robots: { index: true, follow: true },
};

export default function PoliticaDePrivacidadePage() {
  return (
    <LegalShell
      title="Política de Privacidade"
      updatedAt={vigenciaPorExtenso(POLICY_VERSION)}
      summary="Esta política explica quais dados pessoais o Timely trata, por quê, com quem eles são compartilhados e como você exerce seus direitos previstos na Lei Geral de Proteção de Dados (Lei 13.709/2018)."
    >
      <LegalSection id="papeis" title="1. Quem responde por quais dados">
        <p>
          Esta é a parte mais importante do documento, porque muda a quem você
          deve recorrer. O Timely é um sistema usado por muitos estúdios
          independentes, e o papel de cada parte é diferente conforme o dado.
        </p>
        <ul>
          <li>
            <strong>Cada estúdio é o controlador dos dados das próprias
            clientes.</strong> Quando você marca um horário pela página pública
            de um estúdio, é aquele estúdio que decide coletar seu nome e
            telefone, que escreve observações sobre você no cadastro de
            clientes e que resolve por quanto tempo mantém esse histórico.
          </li>
          <li>
            <strong>A Promatic Solutions, que opera o Timely, é operadora
            nesses dados.</strong> Nós fornecemos e mantemos a infraestrutura,
            e tratamos esses dados seguindo as instruções do estúdio. Não
            vendemos, não alugamos e não usamos os dados das clientes de um
            estúdio para finalidade própria.
          </li>
          <li>
            <strong>A Promatic Solutions é controladora dos dados de quem
            contrata o Timely.</strong> O cadastro do dono do estúdio — e-mail,
            nome, dados do negócio, informações de cobrança — e os leads
            enviados pelo formulário da página inicial são tratados por nós,
            para prestar e vender o serviço.
          </li>
        </ul>
        <p>
          Na prática: pedidos sobre dados de agendamento devem ser dirigidos
          primeiro ao estúdio onde você marcou. Se você não conseguir contato,
          pode nos escrever e nós encaminhamos.
        </p>
      </LegalSection>

      <LegalSection id="dados" title="2. Quais dados são tratados">
        <p>
          <strong>No agendamento público</strong> (a página com o link do
          estúdio, que não exige login): nome e telefone com DDD, o serviço
          escolhido e o horário. O telefone é usado como identificador da
          cliente dentro daquele estúdio — dois agendamentos com o mesmo número
          são reconhecidos como a mesma pessoa.
        </p>
        <p>
          <strong>No cadastro de clientes do estúdio:</strong> além de nome e
          telefone, o histórico de atendimentos e as observações que o estúdio
          escrever livremente. Esse campo é de texto livre e o que entra nele é
          decisão do estúdio; recomendamos que não sejam registradas informações
          sensíveis, como dados de saúde, sem necessidade e sem base legal.
        </p>
        <p>
          <strong>No cadastro do estúdio:</strong> e-mail e senha de acesso,
          nome do responsável, nome e link do negócio, número de WhatsApp e, nos
          planos pagos, os dados necessários à cobrança.
        </p>
        <p>
          <strong>No formulário da página inicial:</strong> nome, telefone,
          e-mail, tipo de negócio e as respostas opcionais sobre a rotina de
          agenda de quem pede contato comercial.
        </p>
        <p>
          <strong>Dados técnicos:</strong> registros de acesso e de erro
          gerados automaticamente pela infraestrutura, usados para segurança e
          diagnóstico.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="3. Cookies">
        <p>
          O Timely usa <strong>apenas cookies estritamente necessários</strong>.
          Hoje isso significa um único conjunto: os cookies de sessão do
          Supabase Auth, criados quando o dono do estúdio faz login, que mantêm
          a sessão ativa entre as páginas do painel. Sem eles seria preciso
          entrar de novo a cada clique.
        </p>
        <p>
          A página inicial e a página pública de agendamento{" "}
          <strong>não escrevem cookie nenhum</strong> enquanto você só navega.
          Não há cookies de publicidade, de redes sociais nem de rastreamento de
          terceiros, e nenhuma ferramenta de análise de audiência está instalada.
        </p>
        <p>
          Guardamos também um cookie próprio (<code>timely_consent</code>) com o
          registro da sua resposta ao aviso de cookies, para não perguntar de
          novo a cada visita. Ele contém apenas as categorias aceitas, a versão
          desta política e a data — nenhum identificador pessoal. Se esta
          política mudar de versão, o aviso reaparece.
        </p>
        <p>
          Caso uma ferramenta de análise venha a ser adotada no futuro, ela será
          apresentada como categoria opcional no aviso de cookies e só passará a
          funcionar após autorização expressa.
        </p>
      </LegalSection>

      <LegalSection id="base-legal" title="4. Com que base legal tratamos cada dado">
        <ul>
          <li>
            <strong>Execução de contrato (art. 7º, V).</strong> Os dados do
            agendamento — nome, telefone, serviço e horário — são necessários
            para que o atendimento aconteça. Sem eles não há como reservar o
            horário nem identificar quem chegou.
          </li>
          <li>
            <strong>Execução de contrato.</strong> A confirmação enviada por
            WhatsApp logo após a marcação faz parte da própria prestação do
            serviço: é o comprovante do horário reservado.
          </li>
          <li>
            <strong>Legítimo interesse (art. 7º, IX).</strong> O lembrete
            automático enviado antes do atendimento existe para reduzir faltas,
            interesse legítimo do estúdio, e beneficia diretamente a cliente,
            que é avisada do compromisso. Você pode se opor a receber esses
            lembretes a qualquer momento, pelo estúdio ou respondendo à própria
            mensagem.
          </li>
          <li>
            <strong>Consentimento (art. 7º, I).</strong> O contato comercial a
            partir do formulário da página inicial só acontece com autorização
            marcada por você, e pode ser revogado a qualquer momento.
          </li>
          <li>
            <strong>Cumprimento de obrigação legal (art. 7º, II).</strong>{" "}
            Registros fiscais e contábeis relacionados à contratação do Timely.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="compartilhamento" title="5. Com quem os dados são compartilhados">
        <p>
          Não vendemos dados pessoais. O compartilhamento acontece apenas com
          fornecedores necessários para o serviço funcionar:
        </p>
        <ul>
          <li>
            <strong>Provedor de mensagens de WhatsApp.</strong> As confirmações
            e os lembretes são entregues por meio de um provedor de integração
            com o WhatsApp (Evolution API), hospedado em servidor próprio da
            Promatic Solutions. Para isso, <strong>o número de telefone da
            cliente e o texto da mensagem trafegam por esse serviço</strong>. O
            conteúdo é limitado ao necessário para identificar o atendimento:
            nome, serviço, data e horário. A entrega final é feita pela
            plataforma WhatsApp, que tem política própria.
          </li>
          <li>
            <strong>Provedor de banco de dados e autenticação (Supabase).</strong>{" "}
            Onde os dados ficam armazenados.
          </li>
          <li>
            <strong>Provedor de hospedagem da aplicação.</strong>
          </li>
          <li>
            <strong>Autoridades públicas</strong>, quando houver ordem legal.
          </li>
        </ul>
        <p>
          Alguns desses fornecedores podem processar dados fora do Brasil. Nesses
          casos, a transferência internacional se dá nos termos do art. 33 da
          LGPD, para a execução do contrato.
        </p>
      </LegalSection>

      <LegalSection id="retencao" title="6. Por quanto tempo os dados ficam guardados">
        <ul>
          <li>
            <strong>Agendamentos e cadastro de clientes:</strong> enquanto a
            conta do estúdio estiver ativa, porque é esse histórico que o estúdio
            consulta para atender. O estúdio pode apagar um cliente ou um
            agendamento a qualquer momento pelo painel.
          </li>
          <li>
            <strong>Mensagens enviadas:</strong> o registro de envio é mantido
            enquanto for útil para comprovar a comunicação do atendimento.
          </li>
          <li>
            <strong>Registros de consentimento:</strong> mantidos enquanto durar
            o tratamento a que se referem, porque é deles que sai a prova de que
            a autorização existiu.
          </li>
          <li>
            <strong>Conta do estúdio:</strong> encerrada a conta, os dados são
            eliminados, salvo o que precisar ser mantido por obrigação legal ou
            para exercício de direitos em processo.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="direitos" title="7. Seus direitos e como exercê-los">
        <p>
          A LGPD garante a você, a qualquer momento e sem custo: confirmação de
          que tratamos seus dados; acesso a eles; correção de dados
          incompletos ou desatualizados; anonimização, bloqueio ou eliminação
          de dados desnecessários ou tratados em desconformidade;
          portabilidade; informação sobre com quem compartilhamos;
          possibilidade de não fornecer consentimento e as consequências disso;
          e revogação do consentimento.
        </p>
        <p>
          <strong>Se você é cliente de um estúdio</strong>, fale primeiro com o
          estúdio onde marcou o horário — é ele quem controla esses dados e quem
          consegue apagá-los ou corrigi-los diretamente pelo painel. Se não
          obtiver resposta, escreva para{" "}
          <a href={`mailto:${CONTATO_PRIVACIDADE}`}>{CONTATO_PRIVACIDADE}</a> e
          nós encaminhamos ao responsável.
        </p>
        <p>
          <strong>Se você é dono de estúdio</strong>, ou enviou o formulário de
          contato da página inicial, escreva direto para{" "}
          <a href={`mailto:${CONTATO_PRIVACIDADE}`}>{CONTATO_PRIVACIDADE}</a>.
          Respondemos em até 15 dias.
        </p>
        <p>
          Você também pode apresentar reclamação à Autoridade Nacional de
          Proteção de Dados (ANPD).
        </p>
      </LegalSection>

      <LegalSection id="seguranca" title="8. Segurança">
        <p>
          Os dados trafegam sempre por conexão criptografada. O acesso ao
          banco é isolado por estúdio: as regras de segurança em nível de linha
          impedem que um estúdio leia dados de outro, e a página pública de
          agendamento não tem acesso direto de leitura ao banco — ela passa por
          uma camada de servidor que valida cada pedido.
        </p>
        <p>
          Nenhum sistema é imune. Se ocorrer incidente de segurança com risco
          relevante aos titulares, comunicaremos os afetados e a ANPD, conforme
          o art. 48 da LGPD.
        </p>
      </LegalSection>

      <LegalSection id="menores" title="9. Crianças e adolescentes">
        <p>
          O Timely não é destinado a menores de 16 anos. Se um atendimento
          envolver menor de idade, cabe ao estúdio obter o consentimento
          específico e destacado de ao menos um dos pais ou responsável legal,
          na forma do art. 14 da LGPD.
        </p>
      </LegalSection>

      <LegalSection id="mudancas" title="10. Mudanças nesta política">
        <p>
          Quando esta política mudar de forma relevante, a versão é atualizada e
          o aviso de cookies volta a aparecer para que você tome conhecimento do
          novo texto. A versão em vigor é sempre a publicada nesta página.
        </p>
        <p>
          Dúvidas sobre privacidade:{" "}
          <a href={`mailto:${CONTATO_PRIVACIDADE}`}>{CONTATO_PRIVACIDADE}</a>.
          Veja também os{" "}
          <Link href="/termos-de-uso">Termos de Uso</Link>.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
