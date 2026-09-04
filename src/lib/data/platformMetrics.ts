import "server-only";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { STUDIO_TIMEZONE, utcToLocalDate } from "@/lib/availability";
import type {
  Block,
  Booking,
  BookingStatus,
  MessageOutbox,
  ReminderSettings,
  Service,
  Studio,
  WhatsAppConnection,
  WhatsAppConnectionStatus,
  WorkingHour,
} from "@/lib/types";

/**
 * Métricas de operação da plataforma para o /superadmin.
 *
 * Divisão de responsabilidade com `billing.ts`: aqui é USO (estúdios,
 * agendamentos, clientes, WhatsApp) e lá é DINHEIRO da assinatura. As páginas
 * juntam os dois — nenhum dos dois módulos importa o outro, então a tela de
 * uso continua de pé quando a migração de cobrança ainda não rodou.
 *
 * Todas as leituras usam a service_role key (atravessam RLS de propósito): a
 * autorização acontece uma vez, no layout, em `checkPlatformAdmin`.
 */

const DAY_MS = 86_400_000;
const AT_RISK_DAYS = 14;

export interface PlatformOverview {
  totalStudios: number;
  newStudios7d: number;
  newStudios30d: number;

  totalBookings: number;
  bookingsToday: number;
  bookings7d: number;
  bookingsThisMonth: number;
  bookingsByStatus: Record<BookingStatus, number>;
  cancellationRate: number;

  totalClients: number;
  newClients30d: number;
  activeServices: number;

  whatsappConnected: number;
  whatsappWithError: number;
  messagesSent30d: number;
  messagesFailed30d: number;
  messagesPending: number;

  /**
   * Volume atendido NOS estúdios nos últimos 30 dias (soma do preço dos
   * serviços com atendimento finalizado). Não é receita da plataforma — é o
   * tamanho da operação que ela sustenta. A tela precisa dizer isso.
   */
  attendedVolume30dCents: number;
  attendedBookings30d: number;
}

/**
 * KPIs do topo. As contagens vão como `head: true` (o Postgres conta, nada
 * viaja); só o volume atendido precisa de linhas, porque depende do preço do
 * serviço de cada agendamento.
 *
 * "Estúdio ativo" e "estúdio em risco" NÃO estão aqui de propósito: os dois
 * dependem de olhar agendamento por estúdio, e é `listStudiosWithActivity`
 * que faz isso. Derivar por subtração de contagens globais daria um número
 * plausível e errado (o estúdio novo que já agenda entraria nas duas contas).
 */
export async function getPlatformOverview(): Promise<PlatformOverview> {
  const supabase = createServiceRoleSupabaseClient();
  const now = new Date();
  const since7d = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const since30d = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const counts = await Promise.all([
    supabase.from("studios").select("*", { count: "exact", head: true }),
    supabase.from("studios").select("*", { count: "exact", head: true }).gte("created_at", since7d),
    supabase.from("studios").select("*", { count: "exact", head: true }).gte("created_at", since30d),
    supabase.from("bookings").select("*", { count: "exact", head: true }),
    supabase.from("bookings").select("*", { count: "exact", head: true }).gte("created_at", startOfToday),
    supabase.from("bookings").select("*", { count: "exact", head: true }).gte("created_at", since7d),
    supabase.from("bookings").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "agendado"),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "em_atendimento"),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "finalizado"),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "cancelado"),
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("clients").select("*", { count: "exact", head: true }).gte("created_at", since30d),
    supabase.from("services").select("*", { count: "exact", head: true }).eq("active", true).is("archived_at", null),
    supabase.from("whatsapp_connections").select("*", { count: "exact", head: true }).eq("status", "conectado"),
    supabase.from("whatsapp_connections").select("*", { count: "exact", head: true }).eq("status", "erro"),
    supabase.from("message_outbox").select("*", { count: "exact", head: true }).eq("status", "enviado").gte("created_at", since30d),
    supabase.from("message_outbox").select("*", { count: "exact", head: true }).eq("status", "falhou").gte("created_at", since30d),
    supabase.from("message_outbox").select("*", { count: "exact", head: true }).eq("status", "pendente"),
  ]);
  for (const result of counts) {
    if (result.error) throw result.error;
  }
  const n = (index: number) => counts[index].count ?? 0;

  // Volume atendido + atividade por estúdio: uma passada só nas linhas.
  const [{ data: recentBookings, error: bookingsError }, { data: services, error: servicesError }] =
    await Promise.all([
      supabase.from("bookings").select("studio_id, service_id, status, start_at, created_at").gte("start_at", since30d),
      supabase.from("services").select("id, price_cents"),
    ]);
  if (bookingsError) throw bookingsError;
  if (servicesError) throw servicesError;

  const priceById = new Map((services ?? []).map((s) => [s.id, s.price_cents]));
  const attended = (recentBookings ?? []).filter((b) => b.status === "finalizado");
  const attendedVolume30dCents = attended.reduce(
    (total, booking) => total + (priceById.get(booking.service_id) ?? 0),
    0
  );

  const totalBookings = n(3);
  const canceled = n(10);

  return {
    totalStudios: n(0),
    newStudios7d: n(1),
    newStudios30d: n(2),

    totalBookings,
    bookingsToday: n(4),
    bookings7d: n(5),
    bookingsThisMonth: n(6),
    bookingsByStatus: {
      agendado: n(7),
      em_atendimento: n(8),
      finalizado: n(9),
      cancelado: canceled,
    },
    cancellationRate: totalBookings > 0 ? canceled / totalBookings : 0,

    totalClients: n(11),
    newClients30d: n(12),
    activeServices: n(13),

    whatsappConnected: n(14),
    whatsappWithError: n(15),
    messagesSent30d: n(16),
    messagesFailed30d: n(17),
    messagesPending: n(18),

    attendedVolume30dCents,
    attendedBookings30d: attended.length,
  };
}

export interface StudioActivityRow {
  id: string;
  name: string;
  slug: string;
  ownerName: string | null;
  whatsapp: string;
  createdAt: string;
  /** Agendamentos CRIADOS na janela (entrada de demanda). */
  bookingsLast7d: number;
  bookingsLast30d: number;
  totalBookings: number;
  canceledLast30d: number;
  cancellationRate30d: number;
  /** Atendimentos FINALIZADOS na janela e o valor deles no estúdio. */
  attendedLast30d: number;
  attendedVolume30dCents: number;
  clientsCount: number;
  activeServicesCount: number;
  lastBookingAt: string | null;
  whatsappStatus: WhatsAppConnectionStatus | null;
  remindersEnabled: boolean;
  isAtRisk: boolean;
  isNew: boolean;
}

/**
 * Uma linha por estúdio com a atividade agregada em memória.
 *
 * Continua sendo "puxa as linhas e agrega no Node" como na primeira versão,
 * agora com clientes, serviços e WhatsApp no mesmo pacote — são quatro queries
 * a mais, não uma por estúdio (o N+1 seria o erro fácil aqui). Quando o volume
 * de `bookings` crescer, o caminho é uma view materializada no Postgres; até
 * lá isto é mais simples de auditar do que SQL agregando cinco tabelas.
 */
export async function listStudiosWithActivity(): Promise<StudioActivityRow[]> {
  const supabase = createServiceRoleSupabaseClient();
  const now = Date.now();
  const since7d = new Date(now - 7 * DAY_MS).toISOString();
  const since30d = new Date(now - 30 * DAY_MS).toISOString();
  const atRiskSince = new Date(now - AT_RISK_DAYS * DAY_MS).toISOString();
  const newSince = new Date(now - 14 * DAY_MS).toISOString();

  const [studios, bookings, services, clients, connections, reminders] = await Promise.all([
    supabase.from("studios").select("*").order("created_at", { ascending: false }),
    supabase.from("bookings").select("studio_id, service_id, status, created_at, start_at"),
    supabase.from("services").select("id, studio_id, price_cents, active, archived_at"),
    supabase.from("clients").select("studio_id"),
    supabase.from("whatsapp_connections").select("studio_id, status"),
    supabase.from("reminder_settings").select("studio_id, enabled"),
  ]);
  for (const result of [studios, bookings, services, clients, connections, reminders]) {
    if (result.error) throw result.error;
  }

  const priceById = new Map((services.data ?? []).map((s) => [s.id, s.price_cents]));
  const activeServicesByStudio = countBy(
    (services.data ?? []).filter((s) => s.active && !s.archived_at),
    (s) => s.studio_id
  );
  const clientsByStudio = countBy(clients.data ?? [], (c) => c.studio_id);
  const statusByStudio = new Map((connections.data ?? []).map((c) => [c.studio_id, c.status]));
  const remindersByStudio = new Map((reminders.data ?? []).map((r) => [r.studio_id, r.enabled]));

  interface Agg {
    total: number;
    last7d: number;
    last30d: number;
    canceled30d: number;
    attended30d: number;
    attendedCents: number;
    lastBookingAt: string | null;
  }
  const agg = new Map<string, Agg>();
  for (const booking of bookings.data ?? []) {
    const row =
      agg.get(booking.studio_id) ??
      ({
        total: 0,
        last7d: 0,
        last30d: 0,
        canceled30d: 0,
        attended30d: 0,
        attendedCents: 0,
        lastBookingAt: null,
      } satisfies Agg);

    row.total += 1;
    if (booking.created_at >= since7d) row.last7d += 1;
    if (booking.created_at >= since30d) {
      row.last30d += 1;
      if (booking.status === "cancelado") row.canceled30d += 1;
    }
    if (booking.status === "finalizado" && booking.start_at >= since30d) {
      row.attended30d += 1;
      row.attendedCents += priceById.get(booking.service_id) ?? 0;
    }
    if (!row.lastBookingAt || booking.created_at > row.lastBookingAt) {
      row.lastBookingAt = booking.created_at;
    }
    agg.set(booking.studio_id, row);
  }

  return (studios.data ?? [])
    .map((studio) => {
      const row = agg.get(studio.id);
      const bookingsLast30d = row?.last30d ?? 0;
      return {
        id: studio.id,
        name: studio.name,
        slug: studio.slug,
        ownerName: studio.owner_name,
        whatsapp: studio.whatsapp,
        createdAt: studio.created_at,
        bookingsLast7d: row?.last7d ?? 0,
        bookingsLast30d,
        totalBookings: row?.total ?? 0,
        canceledLast30d: row?.canceled30d ?? 0,
        cancellationRate30d: bookingsLast30d > 0 ? (row?.canceled30d ?? 0) / bookingsLast30d : 0,
        attendedLast30d: row?.attended30d ?? 0,
        attendedVolume30dCents: row?.attendedCents ?? 0,
        clientsCount: clientsByStudio.get(studio.id) ?? 0,
        activeServicesCount: activeServicesByStudio.get(studio.id) ?? 0,
        lastBookingAt: row?.lastBookingAt ?? null,
        whatsappStatus: statusByStudio.get(studio.id) ?? null,
        remindersEnabled: remindersByStudio.get(studio.id) ?? false,
        // Só é "em risco" quem já teve tempo de usar: um estúdio de ontem sem
        // agendamento é normal, um de dois meses atrás sem agendamento não é.
        isAtRisk: studio.created_at < atRiskSince && bookingsLast30d === 0,
        isNew: studio.created_at >= newSince,
      };
    })
    .sort((a, b) => b.bookingsLast30d - a.bookingsLast30d);
}

export interface DailyPoint {
  date: string;
  count: number;
}

function bucketByDay(rows: { created_at: string }[], days: number): DailyPoint[] {
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS);
    buckets.set(utcToLocalDate(d), 0);
  }
  for (const row of rows) {
    const key = utcToLocalDate(new Date(row.created_at));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
}

function countBy<T>(rows: T[], key: (row: T) => string): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    result.set(k, (result.get(k) ?? 0) + 1);
  }
  return result;
}

/** Série diária de agendamentos criados na plataforma inteira. */
export async function getBookingsTrend(days = 30, studioId?: string): Promise<DailyPoint[]> {
  const supabase = createServiceRoleSupabaseClient();
  const since = new Date(Date.now() - days * DAY_MS).toISOString();
  let query = supabase.from("bookings").select("created_at").gte("created_at", since);
  if (studioId) query = query.eq("studio_id", studioId);
  const { data, error } = await query;
  if (error) throw error;
  return bucketByDay(data ?? [], days);
}

/** Série diária de novos estúdios cadastrados. */
export async function getSignupsTrend(days = 30): Promise<DailyPoint[]> {
  const supabase = createServiceRoleSupabaseClient();
  const since = new Date(Date.now() - days * DAY_MS).toISOString();
  const { data, error } = await supabase.from("studios").select("created_at").gte("created_at", since);
  if (error) throw error;
  return bucketByDay(data ?? [], days);
}

// =============================================================================
// Ficha do cliente (um estúdio)
// =============================================================================

export interface ServiceUsageRow {
  service: Service;
  bookings: number;
  attended: number;
  volumeCents: number;
}

export interface ClientUsageRow {
  id: string;
  name: string;
  phone: string;
  bookings: number;
  lastBookingAt: string | null;
}

export interface StudioDetail {
  studio: Studio;
  /** Uso acumulado e nas janelas de 7/30 dias. */
  totalBookings: number;
  bookings7d: number;
  bookings30d: number;
  bookingsByStatus: Record<BookingStatus, number>;
  cancellationRate: number;
  attended30d: number;
  attendedVolume30dCents: number;
  attendedVolumeTotalCents: number;
  /** Ticket médio do estúdio (não da plataforma). */
  averageTicketCents: number;

  firstBookingAt: string | null;
  lastBookingAt: string | null;
  daysSinceLastBooking: number | null;
  isAtRisk: boolean;

  clientsCount: number;
  newClients30d: number;
  /** Clientes com dois ou mais atendimentos — a base fiel do estúdio. */
  returningClients: number;
  returnRate: number;

  services: ServiceUsageRow[];
  activeServicesCount: number;
  archivedServicesCount: number;

  /** Minutos de agenda ocupados vs. disponíveis nos últimos 30 dias. */
  weeklyOpenMinutes: number;
  bookedMinutes30d: number;
  availableMinutes30d: number;
  occupancyRate30d: number;
  blocksNext30d: number;

  whatsapp: WhatsAppConnection | null;
  reminders: ReminderSettings | null;
  messagesSent30d: number;
  messagesFailed30d: number;
  messagesPending: number;
  lastMessageAt: string | null;

  bookingsTrend: DailyPoint[];
  recentBookings: Booking[];
  topClients: ClientUsageRow[];
}

export async function getStudioAdmin(studioId: string): Promise<Studio | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("studios").select("*").eq("id", studioId).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Tudo o que a ficha de um cliente mostra, em uma função.
 *
 * É uma tela só, aberta uma por vez, sobre UM estúdio — então aqui as queries
 * são todas filtradas por `studio_id` e o custo não cresce com o tamanho da
 * plataforma. Diferente da lista, aqui pode ser detalhado à vontade.
 */
export async function getStudioDetail(studioId: string): Promise<StudioDetail | null> {
  const supabase = createServiceRoleSupabaseClient();
  const studio = await getStudioAdmin(studioId);
  if (!studio) return null;

  const now = new Date();
  const since7d = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const since30d = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const in30d = new Date(now.getTime() + 30 * DAY_MS).toISOString();

  const [bookings, services, clients, hours, blocks, connection, reminders, outbox, trend] =
    await Promise.all([
      supabase.from("bookings").select("*").eq("studio_id", studioId).order("start_at", { ascending: false }),
      supabase.from("services").select("*").eq("studio_id", studioId).order("created_at"),
      supabase.from("clients").select("*").eq("studio_id", studioId),
      supabase.from("working_hours").select("*").eq("studio_id", studioId),
      supabase.from("blocks").select("*").eq("studio_id", studioId).gte("start_at", now.toISOString()).lt("start_at", in30d),
      supabase.from("whatsapp_connections").select("*").eq("studio_id", studioId).maybeSingle(),
      supabase.from("reminder_settings").select("*").eq("studio_id", studioId).maybeSingle(),
      supabase.from("message_outbox").select("status, created_at").eq("studio_id", studioId),
      getBookingsTrend(30, studioId),
    ]);
  for (const result of [bookings, services, clients, hours, blocks, connection, reminders, outbox]) {
    if (result.error) throw result.error;
  }

  const allBookings = (bookings.data ?? []) as Booking[];
  const allServices = (services.data ?? []) as Service[];
  const priceById = new Map(allServices.map((s) => [s.id, s.price_cents]));
  const durationById = new Map(allServices.map((s) => [s.id, s.duration_min]));

  const bookingsByStatus: Record<BookingStatus, number> = {
    agendado: 0,
    em_atendimento: 0,
    finalizado: 0,
    cancelado: 0,
  };
  let attended30d = 0;
  let attendedVolume30dCents = 0;
  let attendedVolumeTotalCents = 0;
  let bookedMinutes30d = 0;
  let firstBookingAt: string | null = null;
  let lastBookingAt: string | null = null;

  for (const booking of allBookings) {
    bookingsByStatus[booking.status] += 1;
    if (booking.status === "finalizado") {
      attendedVolumeTotalCents += priceById.get(booking.service_id) ?? 0;
      if (booking.start_at >= since30d) {
        attended30d += 1;
        attendedVolume30dCents += priceById.get(booking.service_id) ?? 0;
      }
    }
    // Ocupação conta o que reserva a agenda: cancelado libera o horário.
    if (booking.status !== "cancelado" && booking.start_at >= since30d && booking.start_at <= now.toISOString()) {
      bookedMinutes30d += durationById.get(booking.service_id) ?? 0;
    }
    if (!firstBookingAt || booking.created_at < firstBookingAt) firstBookingAt = booking.created_at;
    if (!lastBookingAt || booking.created_at > lastBookingAt) lastBookingAt = booking.created_at;
  }

  const bookings30d = allBookings.filter((b) => b.created_at >= since30d).length;
  const attendedTotal = bookingsByStatus.finalizado;

  // Uso por serviço, do mais movimentado para o menos.
  const serviceUsage: ServiceUsageRow[] = allServices
    .map((service) => {
      const ofService = allBookings.filter((b) => b.service_id === service.id);
      const done = ofService.filter((b) => b.status === "finalizado");
      return {
        service,
        bookings: ofService.length,
        attended: done.length,
        volumeCents: done.length * service.price_cents,
      };
    })
    .sort((a, b) => b.bookings - a.bookings);

  // Clientes: recorrência é o número que diz se o estúdio retém.
  const bookingsByClient = new Map<string, { count: number; last: string | null }>();
  for (const booking of allBookings) {
    if (!booking.client_id || booking.status === "cancelado") continue;
    const row = bookingsByClient.get(booking.client_id) ?? { count: 0, last: null };
    row.count += 1;
    if (!row.last || booking.start_at > row.last) row.last = booking.start_at;
    bookingsByClient.set(booking.client_id, row);
  }
  const allClients = clients.data ?? [];
  const returningClients = Array.from(bookingsByClient.values()).filter((r) => r.count >= 2).length;
  const topClients: ClientUsageRow[] = allClients
    .map((client) => ({
      id: client.id,
      name: client.name,
      phone: client.phone,
      bookings: bookingsByClient.get(client.id)?.count ?? 0,
      lastBookingAt: bookingsByClient.get(client.id)?.last ?? null,
    }))
    .filter((row) => row.bookings > 0)
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 8);

  // Capacidade: quantos minutos de agenda o estúdio abre por semana, e quanto
  // disso os últimos 30 dias ofereceram de fato.
  const weeklyOpenMinutes = (hours.data ?? []).reduce(
    (total, shift) => total + minutesBetween(shift.start_time, shift.end_time),
    0
  );
  const availableMinutes30d = availableMinutesInLast30Days(hours.data ?? [], now);

  const outboxRows = (outbox.data ?? []) as Pick<MessageOutbox, "status" | "created_at">[];
  const lastMessageAt = outboxRows.reduce<string | null>(
    (latest, row) => (!latest || row.created_at > latest ? row.created_at : latest),
    null
  );

  const daysSinceLastBooking = lastBookingAt
    ? Math.floor((now.getTime() - Date.parse(lastBookingAt)) / DAY_MS)
    : null;

  return {
    studio,
    totalBookings: allBookings.length,
    bookings7d: allBookings.filter((b) => b.created_at >= since7d).length,
    bookings30d,
    bookingsByStatus,
    cancellationRate: allBookings.length > 0 ? bookingsByStatus.cancelado / allBookings.length : 0,
    attended30d,
    attendedVolume30dCents,
    attendedVolumeTotalCents,
    averageTicketCents: attendedTotal > 0 ? Math.round(attendedVolumeTotalCents / attendedTotal) : 0,

    firstBookingAt,
    lastBookingAt,
    daysSinceLastBooking,
    isAtRisk:
      studio.created_at < new Date(now.getTime() - AT_RISK_DAYS * DAY_MS).toISOString() &&
      bookings30d === 0,

    clientsCount: allClients.length,
    newClients30d: allClients.filter((c) => c.created_at >= since30d).length,
    returningClients,
    returnRate: bookingsByClient.size > 0 ? returningClients / bookingsByClient.size : 0,

    services: serviceUsage,
    activeServicesCount: allServices.filter((s) => s.active && !s.archived_at).length,
    archivedServicesCount: allServices.filter((s) => s.archived_at).length,

    weeklyOpenMinutes,
    bookedMinutes30d,
    availableMinutes30d,
    occupancyRate30d: availableMinutes30d > 0 ? bookedMinutes30d / availableMinutes30d : 0,
    blocksNext30d: ((blocks.data ?? []) as Block[]).length,

    whatsapp: connection.data ?? null,
    reminders: reminders.data ?? null,
    messagesSent30d: outboxRows.filter((m) => m.status === "enviado" && m.created_at >= since30d).length,
    messagesFailed30d: outboxRows.filter((m) => m.status === "falhou" && m.created_at >= since30d).length,
    messagesPending: outboxRows.filter((m) => m.status === "pendente").length,
    lastMessageAt,

    bookingsTrend: trend,
    recentBookings: allBookings.slice(0, 10),
    topClients,
  };
}

/** "09:00" e "18:30" → 570. Aceita o `time` do Postgres com ou sem segundos. */
function minutesBetween(startTime: string, endTime: string): number {
  const toMinutes = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
  };
  return Math.max(0, toMinutes(endTime) - toMinutes(startTime));
}

/**
 * Minutos de atendimento que os últimos 30 dias ofereceram, somando os turnos
 * de cada dia da semana pelo número de vezes que aquele dia caiu na janela.
 *
 * É ESTIMATIVA, e a tela rotula como tal: ignora bloqueios pontuais (folga,
 * feriado) porque eles reduzem a disponibilidade real. Ou seja, a ocupação
 * mostrada é conservadora — nunca superestima o quanto a agenda está cheia.
 */
function availableMinutesInLast30Days(hours: WorkingHour[], now: Date): number {
  const minutesByWeekday = new Map<number, number>();
  for (const shift of hours) {
    minutesByWeekday.set(
      shift.weekday,
      (minutesByWeekday.get(shift.weekday) ?? 0) + minutesBetween(shift.start_time, shift.end_time)
    );
  }

  const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: STUDIO_TIMEZONE,
    weekday: "short",
  });
  const weekdayIndex: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  let total = 0;
  for (let i = 0; i < 30; i++) {
    const day = new Date(now.getTime() - i * DAY_MS);
    const weekday = weekdayIndex[weekdayFormatter.format(day)];
    total += minutesByWeekday.get(weekday) ?? 0;
  }
  return total;
}
