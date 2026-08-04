import "server-only";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import type { BookingStatus } from "@/lib/types";

const DAY_MS = 86_400_000;
const AT_RISK_DAYS = 14;

export interface PlatformOverview {
  totalStudios: number;
  newStudios7d: number;
  newStudios30d: number;
  totalBookings: number;
  bookingsToday: number;
  bookingsThisMonth: number;
  bookingsByStatus: Record<BookingStatus, number>;
  cancellationRate: number;
}

/** KPIs do topo do painel — cada número é uma contagem exata no banco (sem
 * puxar linha nenhuma pro servidor), então continua barato mesmo com a
 * plataforma crescendo. */
export async function getPlatformOverview(): Promise<PlatformOverview> {
  const supabase = createServiceRoleSupabaseClient();
  const now = new Date();
  const since7d = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const since30d = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const results = await Promise.all([
    supabase.from("studios").select("*", { count: "exact", head: true }),
    supabase.from("studios").select("*", { count: "exact", head: true }).gte("created_at", since7d),
    supabase.from("studios").select("*", { count: "exact", head: true }).gte("created_at", since30d),
    supabase.from("bookings").select("*", { count: "exact", head: true }),
    supabase.from("bookings").select("*", { count: "exact", head: true }).gte("created_at", startOfToday),
    supabase.from("bookings").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "agendado"),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "em_atendimento"),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "finalizado"),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "cancelado"),
  ]);

  for (const r of results) {
    if (r.error) throw r.error;
  }
  const [
    totalStudios,
    newStudios7d,
    newStudios30d,
    totalBookings,
    bookingsToday,
    bookingsThisMonth,
    agendado,
    emAtendimento,
    finalizado,
    cancelado,
  ] = results;

  const bookingsByStatus: Record<BookingStatus, number> = {
    agendado: agendado.count ?? 0,
    em_atendimento: emAtendimento.count ?? 0,
    finalizado: finalizado.count ?? 0,
    cancelado: cancelado.count ?? 0,
  };
  const total = totalBookings.count ?? 0;

  return {
    totalStudios: totalStudios.count ?? 0,
    newStudios7d: newStudios7d.count ?? 0,
    newStudios30d: newStudios30d.count ?? 0,
    totalBookings: total,
    bookingsToday: bookingsToday.count ?? 0,
    bookingsThisMonth: bookingsThisMonth.count ?? 0,
    bookingsByStatus,
    cancellationRate: total > 0 ? bookingsByStatus.cancelado / total : 0,
  };
}

export interface StudioActivityRow {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  bookingsLast30d: number;
  totalBookings: number;
  lastBookingAt: string | null;
  isAtRisk: boolean;
  isNew: boolean;
}

/**
 * Uma linha por estúdio já existente, com atividade agregada em memória a
 * partir de duas queries (todos os estúdios + todos os bookings). Simples de
 * ler e correto pro tamanho de base que a plataforma tem agora — se o volume
 * de agendamentos crescer muito, isso deveria virar uma view/RPC agregando
 * no Postgres em vez de trazer as linhas pro servidor Next.js.
 */
export async function listStudiosWithActivity(): Promise<StudioActivityRow[]> {
  const supabase = createServiceRoleSupabaseClient();
  const now = Date.now();
  const since30d = new Date(now - 30 * DAY_MS).toISOString();
  const atRiskSince = new Date(now - AT_RISK_DAYS * DAY_MS).toISOString();
  const newSince = new Date(now - 14 * DAY_MS).toISOString();

  const [{ data: studios, error: studiosError }, { data: bookings, error: bookingsError }] = await Promise.all([
    supabase.from("studios").select("id, name, slug, created_at").order("created_at", { ascending: false }),
    supabase.from("bookings").select("studio_id, created_at"),
  ]);
  if (studiosError) throw studiosError;
  if (bookingsError) throw bookingsError;

  const totalByStudio = new Map<string, number>();
  const last30dByStudio = new Map<string, number>();
  const lastBookingByStudio = new Map<string, string>();
  for (const booking of bookings ?? []) {
    totalByStudio.set(booking.studio_id, (totalByStudio.get(booking.studio_id) ?? 0) + 1);
    if (booking.created_at >= since30d) {
      last30dByStudio.set(booking.studio_id, (last30dByStudio.get(booking.studio_id) ?? 0) + 1);
    }
    const current = lastBookingByStudio.get(booking.studio_id);
    if (!current || booking.created_at > current) {
      lastBookingByStudio.set(booking.studio_id, booking.created_at);
    }
  }

  return (studios ?? [])
    .map((studio) => {
      const bookingsLast30d = last30dByStudio.get(studio.id) ?? 0;
      const isOldEnough = studio.created_at < atRiskSince;
      return {
        id: studio.id,
        name: studio.name,
        slug: studio.slug,
        createdAt: studio.created_at,
        bookingsLast30d,
        totalBookings: totalByStudio.get(studio.id) ?? 0,
        lastBookingAt: lastBookingByStudio.get(studio.id) ?? null,
        isAtRisk: isOldEnough && bookingsLast30d === 0,
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
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of rows) {
    const key = row.created_at.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
}

/** Série diária (UTC) de agendamentos criados na plataforma inteira. */
export async function getBookingsTrend(days = 30): Promise<DailyPoint[]> {
  const supabase = createServiceRoleSupabaseClient();
  const since = new Date(Date.now() - days * DAY_MS).toISOString();
  const { data, error } = await supabase.from("bookings").select("created_at").gte("created_at", since);
  if (error) throw error;
  return bucketByDay(data ?? [], days);
}

/** Série diária (UTC) de novos estúdios cadastrados. */
export async function getSignupsTrend(days = 30): Promise<DailyPoint[]> {
  const supabase = createServiceRoleSupabaseClient();
  const since = new Date(Date.now() - days * DAY_MS).toISOString();
  const { data, error } = await supabase.from("studios").select("created_at").gte("created_at", since);
  if (error) throw error;
  return bucketByDay(data ?? [], days);
}
