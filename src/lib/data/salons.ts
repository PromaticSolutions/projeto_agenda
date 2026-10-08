import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { isMissingColumnError, isMissingTableError } from "@/lib/supabase/errors";
import { MOCK_OWNER_ID, mockFindStudioByOwnerId } from "@/lib/mock/store";
import { can, managedSalonId, type Actor } from "@/lib/access";
import type {
  Booking,
  Client,
  Salon,
  Service,
  Studio,
  WhatsAppConversation,
} from "@/lib/types";

/**
 * Camada de dados da hierarquia atendente → gerente (migração 0024).
 *
 * Divisão de trabalho, que vale para o arquivo inteiro:
 *   - QUEM é a pessoa: aqui, a partir da sessão do Supabase Auth;
 *   - O QUE ela pode: `src/lib/access.ts`, função pura e testada;
 *   - O QUE ela alcança de fato: a RLS da 0024, no Postgres.
 *
 * A terceira é a que vale contra requisição forjada. As duas primeiras existem
 * para a aplicação recusar cedo e com mensagem legível.
 */

/** Erro de autorização — a Server Action devolve isso para a tela, não um stack. */
export class ForbiddenError extends Error {
  constructor(message = "Você não tem acesso a esse recurso.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export interface SalonManagerRecord {
  user_id: string;
  salon_id: string;
  name: string | null;
  email: string | null;
}

/**
 * A gerente, se a pessoa autenticada for uma.
 *
 * Lida com a service_role key, como `checkPlatformAdmin` faz com
 * `platform_admins`: a tabela `salon_managers` não tem policy para
 * anon/authenticated, então nem a própria gerente confirma seu papel pelo
 * client do browser. A checagem acontece sempre no servidor.
 */
export async function getSalonManager(userId: string): Promise<SalonManagerRecord | null> {
  if (!isSupabaseConfigured) return null;

  const service = createServiceRoleSupabaseClient();
  const { data, error } = await service
    .from("salon_managers")
    .select("user_id, salon_id, name, email")
    .eq("user_id", userId)
    .maybeSingle();
  /* Sem a 0024 rodada, não existe gerente nenhuma — e isso não é erro, é o
     estado anterior do sistema. As migrações deste projeto sobem à mão, então
     o código da feature chega antes do SQL por padrão (ver README). */
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return data;
}

/**
 * Quem está pedindo, resolvido uma vez por request.
 *
 * Ordem deliberada — estúdio PRIMEIRO. Quem já tem estúdio é atendente e
 * continua atendente, aconteça o que acontecer na tabela de gerentes. É o que
 * garante que ninguém que usa o sistema hoje mude de papel por efeito colateral
 * desta migração.
 */
export async function getCurrentActor(): Promise<Actor | null> {
  if (!isSupabaseConfigured) {
    /* Modo demonstração (sem .env.local): segue existindo só a atendente
       fictícia. Gerência não é simulada — preferível a tela dizer que precisa
       de Supabase a inventar um salão que não existe. */
    const mock = mockFindStudioByOwnerId(MOCK_OWNER_ID);
    return mock
      ? { role: "atendente", userId: MOCK_OWNER_ID, studioId: mock.id, salonId: null }
      : null;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: studio, error } = await supabase
    .from("studios")
    .select("id, salon_id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    /* Banco ainda sem a 0024: `salon_id` não existe. Em vez de derrubar o
       painel inteiro de quem já usa o sistema, relê sem a coluna e segue como
       atendente autônoma — que é exatamente o comportamento anterior à
       migração. É a mesma postura das telas que dizem "rode a migração 00XX"
       em vez de estourar. */
    if (!isMissingColumnError(error)) throw error;

    const fallback = await supabase
      .from("studios")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (fallback.error) throw fallback.error;
    if (fallback.data) {
      return {
        role: "atendente",
        userId: user.id,
        studioId: fallback.data.id,
        salonId: null,
      };
    }
    return { role: "sem_vinculo", userId: user.id };
  }

  if (studio) {
    return {
      role: "atendente",
      userId: user.id,
      studioId: studio.id,
      salonId: studio.salon_id,
    };
  }

  const manager = await getSalonManager(user.id);
  if (manager) {
    return { role: "gerente", userId: user.id, salonId: manager.salon_id };
  }

  return { role: "sem_vinculo", userId: user.id };
}

/** O ator, ou erro. Para Server Actions, onde seguir sem saber quem é não é opção. */
export async function requireActor(): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) throw new ForbiddenError("Sessão expirada. Entre de novo.");
  return actor;
}

/** A gerente autenticada, ou erro. Porta única das telas e ações de /app/gerencia. */
export async function requireManager(): Promise<Extract<Actor, { role: "gerente" }>> {
  const actor = await requireActor();
  if (actor.role !== "gerente") {
    throw new ForbiddenError("Esta área é exclusiva de gerentes de salão.");
  }
  return actor;
}

export async function getSalon(salonId: string): Promise<Salon | null> {
  const service = createServiceRoleSupabaseClient();
  const { data, error } = await service
    .from("salons")
    .select("*")
    .eq("id", salonId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * As atendentes do salão da gerente.
 *
 * `eq("salon_id", salonId)` com o salão vindo da SESSÃO, nunca de parâmetro de
 * rota. Mesmo que viesse, a RLS da 0024 só devolve estúdios de
 * `salon_studio_ids()` — um salão alheio volta vazio, não volta proibido.
 */
export async function listSalonAttendants(salonId: string): Promise<Studio[]> {
  const supabase = await createServerSupabaseClient();
  return fetchAllPages<Studio>((from, to) =>
    supabase
      .from("studios")
      .select("*")
      .eq("salon_id", salonId)
      .order("name")
      .order("id")
      .range(from, to)
  );
}

/**
 * Confirma que o estúdio pertence ao salão da gerente e devolve a linha.
 *
 * O ponto importante é QUEM informa o salão: ele é lido do banco, do próprio
 * estúdio alvo, e só então comparado com o da sessão. Copiar o salão da sessão
 * para dentro do alvo transformaria a checagem em carimbo — está documentado
 * em `access.test.ts`.
 */
export async function assertStudioInMySalon(actor: Actor, studioId: string): Promise<Studio> {
  const service = createServiceRoleSupabaseClient();
  const { data, error } = await service
    .from("studios")
    .select("*")
    .eq("id", studioId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ForbiddenError("Atendente não encontrada.");

  if (!can(actor, "studio:read", { studioId: data.id, salonId: data.salon_id })) {
    /* Mesma mensagem para "não é do seu salão" e para "não existe": dizer qual
       dos dois é confirmaria a existência de estúdio de outro salão para quem
       ficasse chutando id. */
    throw new ForbiddenError("Atendente não encontrada.");
  }
  return data;
}

export interface SalonAttendantStats {
  studioId: string;
  clients: number;
  upcomingBookings: number;
  unreadMessages: number;
}

/**
 * Números por atendente para a visão geral do salão.
 *
 * Três `count` com `head: true` por estúdio em vez de trazer as linhas: a
 * gerente precisa do tamanho, não do conteúdo, e o conteúdo de um salão com
 * anos de histórico é justamente o que o corte de mil linhas do PostgREST
 * estragaria (ver `fetchAllPages` e DECISIONS.md).
 */
export async function getSalonAttendantStats(
  studioIds: string[],
  now: Date = new Date()
): Promise<Map<string, SalonAttendantStats>> {
  const stats = new Map<string, SalonAttendantStats>();
  if (studioIds.length === 0) return stats;

  const supabase = await createServerSupabaseClient();
  const nowIso = now.toISOString();

  await Promise.all(
    studioIds.map(async (studioId) => {
      const [clients, bookings, unread] = await Promise.all([
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("studio_id", studioId),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("studio_id", studioId)
          .gte("start_at", nowIso)
          .in("status", ["agendado", "em_atendimento"]),
        supabase
          .from("whatsapp_messages")
          .select("id", { count: "exact", head: true })
          .eq("studio_id", studioId)
          .eq("direction", "recebida")
          .is("read_at", null),
      ]);

      stats.set(studioId, {
        studioId,
        clients: clients.count ?? 0,
        upcomingBookings: bookings.count ?? 0,
        /* `read_at` só existe a partir da 0019. Num banco sem ela a consulta
           falha, e um erro de coluna não pode derrubar a visão inteira do
           salão — o número vira zero e o resto da tela continua de pé. */
        unreadMessages: unread.error ? 0 : (unread.count ?? 0),
      });
    })
  );

  return stats;
}

/**
 * Leituras do salão inteiro.
 *
 * Todas usam `createServerSupabaseClient` (chave anônima + sessão), NUNCA a
 * service_role. É o detalhe que faz o isolamento valer: a RLS da 0024 recorta
 * o resultado para `salon_studio_ids()` antes de a linha sair do Postgres.
 * Com a service_role, um `in("studio_id", ...)` montado errado devolveria
 * dados de outro salão — e nenhum teste de tela pegaria isso.
 *
 * `listBookingsForStudiosInRange` (bookings.ts) parece servir e NÃO serve:
 * ela é a leitura do disparador de lembretes e roda com service_role.
 */

/** Clientes das atendentes do salão, com a atendente de cada uma. */
export async function listSalonClients(studioIds: string[]): Promise<Client[]> {
  if (studioIds.length === 0) return [];
  const supabase = await createServerSupabaseClient();
  return fetchAllPages<Client>((from, to) =>
    supabase
      .from("clients")
      .select("*")
      .in("studio_id", studioIds)
      .order("name")
      .order("id")
      .range(from, to)
  );
}

/** Agendamentos das atendentes do salão numa janela. */
export async function listSalonBookings(
  studioIds: string[],
  fromIso: string,
  toIso: string
): Promise<Booking[]> {
  if (studioIds.length === 0) return [];
  const supabase = await createServerSupabaseClient();
  return fetchAllPages<Booking>((from, to) =>
    supabase
      .from("bookings")
      .select("*")
      .in("studio_id", studioIds)
      .gte("start_at", fromIso)
      .lte("start_at", toIso)
      .order("start_at")
      .order("id")
      .range(from, to)
  );
}

/**
 * Conversas das atendentes do salão.
 *
 * `whatsapp_conversations` é view com `security_invoker = true` (0019/0021),
 * então ela respeita a RLS de `whatsapp_messages` e de `clients` — as duas
 * ganharam policy de gerente na 0024. Sem o `security_invoker`, esta leitura
 * teria que ser reescrita; com ele, funciona pelo mesmo caminho da atendente.
 */
export async function listSalonConversations(
  studioIds: string[]
): Promise<WhatsAppConversation[]> {
  if (studioIds.length === 0) return [];
  const supabase = await createServerSupabaseClient();
  return fetchAllPages<WhatsAppConversation>((from, to) =>
    supabase
      .from("whatsapp_conversations")
      .select("*")
      .in("studio_id", studioIds)
      .order("last_at", { ascending: false })
      .order("chat_id")
      .range(from, to)
  );
}

/** Serviços das atendentes do salão — usado para nomear o serviço do agendamento. */
export async function listSalonServices(studioIds: string[]): Promise<Service[]> {
  if (studioIds.length === 0) return [];
  const supabase = await createServerSupabaseClient();
  return fetchAllPages<Service>((from, to) =>
    supabase
      .from("services")
      .select("*")
      .in("studio_id", studioIds)
      .order("name")
      .order("id")
      .range(from, to)
  );
}

/**
 * Recorta a lista de estúdios pelo filtro "atendente" da tela.
 *
 * O filtro é conveniência de leitura, não barreira: um id de fora do salão
 * simplesmente não está em `studioIds` e é descartado aqui — e mesmo que
 * passasse, a RLS devolveria vazio. Duas barreiras, nenhuma delas na tela.
 */
export function narrowToAttendant(studioIds: string[], attendantId?: string | null): string[] {
  if (!attendantId || attendantId === "todas") return studioIds;
  return studioIds.includes(attendantId) ? [attendantId] : [];
}

export interface CreateSalonInput {
  salonName: string;
  managerName: string;
}

/**
 * Abre um salão e torna quem está autenticada a gerente dele.
 *
 * É o caminho de auto-atendimento do onboarding: antes disso, virar salão só
 * acontecia por SQL, o que fazia a hierarquia existir no banco e não existir
 * para quem compra o sistema.
 *
 * O escopo é estreito de propósito: a pessoa só pode criar um salão NOVO e ser
 * gerente DELE. Não há como entrar num salão que já existe — isso exigiria
 * convite de quem já está lá, e um formulário que aceitasse `salon_id` seria a
 * porta para se autodeclarar gerente do salão alheio.
 *
 * Usa a service_role porque `salons` e `salon_managers` não têm policy para
 * `authenticated` (mesma postura de `platform_admins`). Quem autoriza é a
 * checagem de sessão aqui em cima.
 */
export async function createSalonWithManager(
  input: CreateSalonInput
): Promise<{ salonId: string }> {
  if (!isSupabaseConfigured) {
    throw new ForbiddenError("Abrir salão exige o Supabase configurado.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ForbiddenError("Sessão expirada. Entre de novo.");

  /* Quem já tem estúdio é atendente, e quem já gerencia não abre um segundo
     salão. As duas checagens são aqui, e não só na tela, porque esta é uma
     Server Action — porta HTTP própria. */
  const actor = await getCurrentActor();
  if (actor?.role === "atendente") {
    throw new ForbiddenError("Sua conta já tem um estúdio. Não dá para abrir um salão por ela.");
  }
  if (actor?.role === "gerente") {
    throw new ForbiddenError("Você já gerencia um salão.");
  }

  const service = createServiceRoleSupabaseClient();

  const { data: salon, error: salonError } = await service
    .from("salons")
    .insert({ name: input.salonName })
    .select("id")
    .single();
  if (salonError || !salon) {
    throw new Error(salonError?.message ?? "Não foi possível criar o salão.");
  }

  const { error: managerError } = await service.from("salon_managers").insert({
    user_id: user.id,
    salon_id: salon.id,
    name: input.managerName,
    email: user.email ?? null,
  });

  if (managerError) {
    /* Salão sem gerente nenhuma é lixo invisível: ninguém o alcança pela
       interface e ele reapareceria só numa consulta manual. */
    await service
      .from("salons")
      .delete()
      .eq("id", salon.id)
      .then(() => undefined, () => undefined);
    throw new Error(managerError.message);
  }

  return { salonId: salon.id };
}

export interface CreateAttendantInput {
  name: string;
  email: string;
  password: string;
  whatsapp: string;
  slug: string;
}

export interface CreateAttendantResult {
  studio: Studio;
  userId: string;
}

/**
 * Cadastra uma atendente já vinculada ao salão da gerente.
 *
 * Duas coisas que NÃO são negociáveis aqui:
 *
 * 1. `salon_id` vem de `managedSalonId(actor)` — da sessão. O formulário não
 *    tem campo de salão, e se tivesse seria ignorado. É isto que impede uma
 *    gerente de cadastrar atendente em outro salão.
 *
 * 2. Criar usuário no Auth exige a service_role key, que ignora RLS. Por isso
 *    a autorização é conferida ANTES, em código, e não delegada ao banco como
 *    nas leituras.
 *
 * Se a criação do estúdio falhar depois de o usuário já existir, o usuário é
 * removido: metade de uma atendente é pior que nenhuma — ela ocuparia o e-mail
 * e não conseguiria entrar em lugar nenhum.
 */
export async function createSalonAttendant(
  actor: Actor,
  input: CreateAttendantInput
): Promise<CreateAttendantResult> {
  const salonId = managedSalonId(actor);
  if (!salonId || !can(actor, "attendant:create", { salonId })) {
    throw new ForbiddenError("Só a gerente do salão pode cadastrar atendentes.");
  }

  const service = createServiceRoleSupabaseClient();

  const { data: created, error: authError } = await service.auth.admin.createUser({
    email: input.email,
    password: input.password,
    /* A gerente está cadastrando alguém que está na frente dela; exigir
       confirmação por e-mail só adiaria o primeiro login. */
    email_confirm: true,
    user_metadata: { name: input.name },
  });
  if (authError || !created?.user) {
    throw new Error(authError?.message ?? "Não foi possível criar o acesso da atendente.");
  }

  const userId = created.user.id;

  const { data: studio, error: studioError } = await service
    .from("studios")
    .insert({
      owner_id: userId,
      name: input.name,
      slug: input.slug,
      whatsapp: input.whatsapp,
      salon_id: salonId,
      owner_name: input.name,
    })
    .select("*")
    .single();

  if (studioError || !studio) {
    await service.auth.admin.deleteUser(userId).catch(() => {
      /* Se nem a limpeza funcionar, o erro de criação ainda é o que importa
         relatar — engolir o original para relatar o da faxina esconde a causa. */
    });
    throw new Error(studioError?.message ?? "Não foi possível criar o estúdio da atendente.");
  }

  return { studio, userId };
}

export interface UpdateAttendantInput {
  name?: string;
  whatsapp?: string;
}

/** Edita dados cadastrais da atendente, depois de confirmar que ela é do salão. */
export async function updateSalonAttendant(
  actor: Actor,
  studioId: string,
  patch: UpdateAttendantInput
): Promise<Studio> {
  const studio = await assertStudioInMySalon(actor, studioId);
  if (!can(actor, "attendant:update", { salonId: studio.salon_id })) {
    throw new ForbiddenError("Só a gerente do salão pode editar atendentes.");
  }

  const service = createServiceRoleSupabaseClient();
  const { data, error } = await service
    .from("studios")
    .update(patch)
    .eq("id", studioId)
    /* Cinto e suspensório: mesmo com a checagem acima, a escrita se recusa a
       sair do salão da gerente. Um bug futuro na checagem não vira vazamento. */
    .eq("salon_id", studio.salon_id!)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Desativa ou reativa a atendente.
 *
 * Desativar tira a página pública do ar — ninguém marca horário com ela. NÃO
 * mexe no login nem apaga nada: agendamento, cliente e conversa são dado de
 * terceiro, e a própria atendente continua dona do histórico dela.
 */
export async function setSalonAttendantActive(
  actor: Actor,
  studioId: string,
  active: boolean
): Promise<Studio> {
  const studio = await assertStudioInMySalon(actor, studioId);
  if (!can(actor, "attendant:update", { salonId: studio.salon_id })) {
    throw new ForbiddenError("Só a gerente do salão pode desativar atendentes.");
  }

  const service = createServiceRoleSupabaseClient();
  const { data, error } = await service
    .from("studios")
    .update({ deactivated_at: active ? null : new Date().toISOString() })
    .eq("id", studioId)
    .eq("salon_id", studio.salon_id!)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Desvincula a atendente do salão — ela volta a ser autônoma.
 *
 * É o "remover" desta tela, e de propósito não é um DELETE. A conta continua
 * existindo, os dados continuam com ela, e o acesso dela não muda: só o salão
 * deixa de enxergar. Reversível, e sem destruir dado de cliente que nunca foi
 * do salão para começar.
 */
export async function detachSalonAttendant(actor: Actor, studioId: string): Promise<void> {
  const studio = await assertStudioInMySalon(actor, studioId);
  if (!can(actor, "attendant:update", { salonId: studio.salon_id })) {
    throw new ForbiddenError("Só a gerente do salão pode remover atendentes.");
  }

  const service = createServiceRoleSupabaseClient();
  const { error } = await service
    .from("studios")
    .update({ salon_id: null })
    .eq("id", studioId)
    .eq("salon_id", studio.salon_id!);
  if (error) throw error;
}
