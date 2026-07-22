import "server-only";
import type { Block, Booking, BookingStatus, Service, Studio, WorkingHour } from "@/lib/types";
import { localDateTimeToUtc } from "@/lib/availability";

/**
 * Store em memória usado quando o Supabase não está configurado (sem
 * .env.local). Existe só para o front funcionar isolado durante o
 * desenvolvimento — reseta a cada restart do processo e NÃO é compartilhado
 * entre instâncias serverless em produção. Ver DECISIONS.md e README.md.
 *
 * Guardado em `globalThis` (não em `const` de módulo): o Next.js instancia
 * Route Handlers e Server Components em grafos de módulo separados (e o
 * Fast Refresh do dev server re-executa módulos), então um simples array no
 * topo do arquivo NÃO fica compartilhado entre a página pública e a API de
 * disponibilidade/booking — cada um veria seus próprios dados "fantasma".
 * `globalThis` é o mesmo truque usado pelo próprio Next.js para o singleton
 * do Prisma Client em dev.
 */

export const MOCK_OWNER_ID = "mock-owner-1";
export const MOCK_STUDIO_ID = "11111111-1111-1111-1111-111111111111";
export const MOCK_STUDIO_SLUG = "bella-studio";

function uid() {
  return crypto.randomUUID();
}

function todayLocalDate(): string {
  const now = new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

interface MockDb {
  studios: Studio[];
  services: Service[];
  workingHours: WorkingHour[];
  blocks: Block[];
  bookings: Booking[];
}

declare global {
  var __agendaMockDb: MockDb | undefined;
}

function buildSeedDb(): MockDb {
  const studios: Studio[] = [
    {
      id: MOCK_STUDIO_ID,
      owner_id: MOCK_OWNER_ID,
      name: "Bella Studio",
      slug: MOCK_STUDIO_SLUG,
      whatsapp: "5511934476935",
      brand_color: "#7C3AED",
      logo_url: null,
      created_at: new Date().toISOString(),
    },
  ];

  const services: Service[] = [
    {
      id: uid(),
      studio_id: MOCK_STUDIO_ID,
      name: "Design de Sobrancelhas",
      price_cents: 6000,
      duration_min: 40,
      color: "#7C3AED",
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: uid(),
      studio_id: MOCK_STUDIO_ID,
      name: "Extensão de Cílios",
      price_cents: 12000,
      duration_min: 90,
      color: "#8B5CF6",
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: uid(),
      studio_id: MOCK_STUDIO_ID,
      name: "Micropigmentação",
      price_cents: 35000,
      duration_min: 120,
      color: "#E23FA0",
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: uid(),
      studio_id: MOCK_STUDIO_ID,
      name: "Limpeza de Pele (pausado)",
      price_cents: 15000,
      duration_min: 60,
      color: "#A93CC9",
      active: false,
      created_at: new Date().toISOString(),
    },
  ];

  const workingHours: WorkingHour[] = [1, 2, 3, 4, 5].flatMap((weekday) => [
    { id: uid(), studio_id: MOCK_STUDIO_ID, weekday, start_time: "09:00", end_time: "12:00" },
    { id: uid(), studio_id: MOCK_STUDIO_ID, weekday, start_time: "13:00", end_time: "18:00" },
  ]);
  workingHours.push({
    id: uid(),
    studio_id: MOCK_STUDIO_ID,
    weekday: 6,
    start_time: "09:00",
    end_time: "13:00",
  });

  const blocks: Block[] = [];

  const today = todayLocalDate();
  const [svcSobrancelhas, svcCilios, svcMicro] = services;
  const bookings: Booking[] = [
    {
      id: uid(),
      studio_id: MOCK_STUDIO_ID,
      service_id: svcSobrancelhas.id,
      client_name: "Ana Paula Ferreira",
      client_phone: "5511987654321",
      start_at: localDateTimeToUtc(today, "09:00").toISOString(),
      end_at: localDateTimeToUtc(today, "09:40").toISOString(),
      status: "finalizado",
      created_at: new Date().toISOString(),
    },
    {
      id: uid(),
      studio_id: MOCK_STUDIO_ID,
      service_id: svcCilios.id,
      client_name: "Camila Rodrigues",
      client_phone: "5511976543210",
      start_at: localDateTimeToUtc(today, "10:00").toISOString(),
      end_at: localDateTimeToUtc(today, "11:30").toISOString(),
      status: "em_atendimento",
      created_at: new Date().toISOString(),
    },
    {
      id: uid(),
      studio_id: MOCK_STUDIO_ID,
      service_id: svcMicro.id,
      client_name: "Juliana Souza",
      client_phone: "5511965432109",
      start_at: localDateTimeToUtc(today, "14:00").toISOString(),
      end_at: localDateTimeToUtc(today, "16:00").toISOString(),
      status: "agendado",
      created_at: new Date().toISOString(),
    },
  ];

  return { studios, services, workingHours, blocks, bookings };
}

const db = (globalThis.__agendaMockDb ??= buildSeedDb());
const { studios, services, workingHours, blocks, bookings } = db;

// ---------------------------------------------------------------------------
// studios
// ---------------------------------------------------------------------------
export function mockFindStudioBySlug(slug: string): Studio | null {
  return studios.find((s) => s.slug === slug) ?? null;
}

export function mockFindStudioByOwnerId(ownerId: string): Studio | null {
  return studios.find((s) => s.owner_id === ownerId) ?? null;
}

export function mockCreateStudio(input: Omit<Studio, "id" | "created_at">): Studio {
  const studio: Studio = { ...input, id: uid(), created_at: new Date().toISOString() };
  studios.push(studio);
  return studio;
}

export function mockUpdateStudio(id: string, patch: Partial<Studio>): Studio {
  const idx = studios.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("Estúdio não encontrado");
  studios[idx] = { ...studios[idx], ...patch };
  return studios[idx];
}

// ---------------------------------------------------------------------------
// services
// ---------------------------------------------------------------------------
export function mockListServices(studioId: string, opts?: { activeOnly?: boolean }): Service[] {
  return services
    .filter((s) => s.studio_id === studioId)
    .filter((s) => (opts?.activeOnly ? s.active : true))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function mockGetService(id: string): Service | null {
  return services.find((s) => s.id === id) ?? null;
}

export function mockCreateService(input: Omit<Service, "id" | "created_at">): Service {
  const service: Service = { ...input, id: uid(), created_at: new Date().toISOString() };
  services.push(service);
  return service;
}

export function mockUpdateService(id: string, patch: Partial<Service>): Service {
  const idx = services.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("Serviço não encontrado");
  services[idx] = { ...services[idx], ...patch };
  return services[idx];
}

export function mockDeleteService(id: string): void {
  const idx = services.findIndex((s) => s.id === id);
  if (idx !== -1) services.splice(idx, 1);
}

// ---------------------------------------------------------------------------
// working_hours
// ---------------------------------------------------------------------------
export function mockListWorkingHours(studioId: string): WorkingHour[] {
  return workingHours
    .filter((w) => w.studio_id === studioId)
    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
}

export function mockCreateWorkingHour(input: Omit<WorkingHour, "id">): WorkingHour {
  const wh: WorkingHour = { ...input, id: uid() };
  workingHours.push(wh);
  return wh;
}

export function mockDeleteWorkingHour(id: string): void {
  const idx = workingHours.findIndex((w) => w.id === id);
  if (idx !== -1) workingHours.splice(idx, 1);
}

// ---------------------------------------------------------------------------
// blocks
// ---------------------------------------------------------------------------
export function mockListBlocks(studioId: string): Block[] {
  return blocks
    .filter((b) => b.studio_id === studioId)
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
}

export function mockCreateBlock(input: Omit<Block, "id">): Block {
  const block: Block = { ...input, id: uid() };
  blocks.push(block);
  return block;
}

export function mockDeleteBlock(id: string): void {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx !== -1) blocks.splice(idx, 1);
}

// ---------------------------------------------------------------------------
// bookings
// ---------------------------------------------------------------------------
export function mockListBookings(
  studioId: string,
  range?: { from: string; to: string }
): Booking[] {
  return bookings
    .filter((b) => b.studio_id === studioId)
    .filter((b) => !range || (b.start_at < range.to && b.end_at > range.from))
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
}

export function mockSearchBookings(studioId: string, query: string): Booking[] {
  const q = query.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  return bookings
    .filter((b) => b.studio_id === studioId)
    .filter(
      (b) =>
        b.client_name.toLowerCase().includes(q) ||
        (qDigits.length > 0 && b.client_phone.includes(qDigits))
    )
    .sort((a, b) => b.start_at.localeCompare(a.start_at));
}

export type CreateBookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; error: "conflict" };

export function mockCreateBooking(
  input: Omit<Booking, "id" | "created_at" | "status">
): CreateBookingResult {
  const newStart = new Date(input.start_at).getTime();
  const newEnd = new Date(input.end_at).getTime();
  const conflict = bookings.some(
    (b) =>
      b.studio_id === input.studio_id &&
      b.status !== "cancelado" &&
      newStart < new Date(b.end_at).getTime() &&
      new Date(b.start_at).getTime() < newEnd
  );
  if (conflict) return { ok: false, error: "conflict" };

  const booking: Booking = {
    ...input,
    id: uid(),
    status: "agendado",
    created_at: new Date().toISOString(),
  };
  bookings.push(booking);
  return { ok: true, booking };
}

export function mockUpdateBookingStatus(id: string, status: BookingStatus): Booking {
  const idx = bookings.findIndex((b) => b.id === id);
  if (idx === -1) throw new Error("Agendamento não encontrado");
  bookings[idx] = { ...bookings[idx], status };
  return bookings[idx];
}
