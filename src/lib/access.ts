/**
 * Hierarquia de acesso: atendente → gerente.
 *
 * Função pura, sem Supabase e sem React, pelo mesmo motivo de
 * `subscription-state.ts`: **regra de permissão não se confere no olho**. Aqui
 * ela tem teste; na tela ela teria um print.
 *
 * Esta é a fonte única da hierarquia no app. Ela NÃO é a única defesa: o que
 * realmente impede uma gerente de ler outro salão é a RLS da migração 0024,
 * que roda no Postgres e não conhece o código daqui. Este módulo existe para
 * que a aplicação decida o que mostrar e o que recusar ANTES de bater no banco,
 * e para que a recusa venha com uma mensagem em português em vez de uma lista
 * vazia inexplicável.
 *
 * O /superadmin (`platform_admins`, 0003) é um eixo SEPARADO e não passa por
 * aqui — continua exatamente como estava, com `checkPlatformAdmin`.
 */

/** Quem está pedindo. */
export type Actor =
  /**
   * A dona de um estúdio: a atendente. `salonId` nulo = profissional
   * autônoma, que é o caso que o sistema já atendia antes de existir salão.
   */
  | { role: "atendente"; userId: string; studioId: string; salonId: string | null }
  /** Gerente de um salão. Não tem estúdio, não tem agenda, não tem página pública. */
  | { role: "gerente"; userId: string; salonId: string }
  /** Autenticada, mas ainda sem estúdio e sem salão — vai para o onboarding. */
  | { role: "sem_vinculo"; userId: string };

/** O que a hierarquia governa. */
export type Permission =
  /** Ver os dados operacionais de um estúdio: agenda, clientes, conversas. */
  | "studio:read"
  /** Alterar esses dados: remarcar, editar cliente, responder conversa. */
  | "studio:write"
  /** Abrir a lista de atendentes de um salão. */
  | "attendant:list"
  /** Cadastrar atendente num salão. */
  | "attendant:create"
  /** Editar, desativar ou desvincular atendente de um salão. */
  | "attendant:update";

/**
 * O recurso alvo, descrito pelo que ele É — não pelo que o pedido afirma.
 * `salonId` aqui é o salão DO RECURSO (ex.: `studios.salon_id`), lido do banco.
 * Passar o salão alegado pelo cliente anularia a checagem.
 */
export interface Target {
  studioId?: string;
  salonId?: string | null;
}

/**
 * Mesmo salão, com uma recusa deliberada: dois nulos NÃO são o mesmo salão.
 *
 * Sem isso, `null === null` daria a toda gerente acesso a toda profissional
 * autônoma do sistema — justamente quem não pertence a salão nenhum. É o erro
 * mais caro possível neste módulo, e é por isso que ele tem nome e teste.
 */
function sameSalon(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a === b;
}

export function can(actor: Actor, permission: Permission, target: Target = {}): boolean {
  switch (actor.role) {
    case "atendente":
      switch (permission) {
        /* Só o próprio estúdio, exatamente como antes da 0024. Estar num salão
           não amplia nem reduz o que a atendente enxerga. */
        case "studio:read":
        case "studio:write":
          return target.studioId === actor.studioId;
        /* Atendente não gerencia atendente — nem a si mesma por esta porta. */
        case "attendant:list":
        case "attendant:create":
        case "attendant:update":
          return false;
      }
      break;

    case "gerente":
      switch (permission) {
        case "studio:read":
          return sameSalon(target.salonId, actor.salonId);
        /* A gerente LÊ a operação das atendentes; ela não remarca o horário
           nem responde a conversa no lugar delas. Se o negócio pedir isso
           depois, é uma decisão nova — e uma policy nova na 0024, que hoje é
           `for select` e só. */
        case "studio:write":
          return false;
        case "attendant:list":
          /* Sem alvo, "listar" significa "a lista do meu salão". Com alvo, o
             salão tem de ser o dela. */
          return target.salonId === undefined || sameSalon(target.salonId, actor.salonId);
        case "attendant:create":
        case "attendant:update":
          return sameSalon(target.salonId, actor.salonId);
      }
      break;

    /* Sem estúdio e sem salão não há o que ler: o destino dela é o onboarding. */
    case "sem_vinculo":
      return false;
  }
  return false;
}

/**
 * O salão que o ator pode operar, ou null.
 *
 * Usado pelas escritas do servidor para montar o `salon_id` a partir da SESSÃO,
 * nunca do formulário — é o que impede uma gerente de cadastrar atendente em
 * outro salão trocando um campo escondido.
 */
export function managedSalonId(actor: Actor): string | null {
  return actor.role === "gerente" ? actor.salonId : null;
}

/** Rota inicial de cada papel, para o layout do painel decidir sem `if` espalhado. */
export function homePathFor(actor: Actor): string {
  switch (actor.role) {
    case "gerente":
      return "/app/gerencia";
    case "atendente":
      return "/app";
    case "sem_vinculo":
      return "/app/onboarding";
  }
}

export type AttendantStatus = "ativa" | "inativa";

export function attendantStatus(studio: { deactivated_at: string | null }): AttendantStatus {
  return studio.deactivated_at ? "inativa" : "ativa";
}
