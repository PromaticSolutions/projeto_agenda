import "server-only";
import type {
  Block,
  Booking,
  BookingStatus,
  Client,
  ReminderSettings,
  Service,
  Studio,
  WhatsAppConnection,
  WorkingHour,
} from "@/lib/types";
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
  clients: Client[];
  reminderSettings: ReminderSettings[];
  whatsappConnections: WhatsAppConnection[];
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
      banner_url: null,
      owner_name: null,
      owner_cpf: null,
      owner_birth_date: null,
      acquired_at: null,
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
      notes: null,
      archived_at: null,
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
      notes: null,
      archived_at: null,
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
      notes: null,
      archived_at: null,
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
      notes: null,
      archived_at: null,
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

  const clients: Client[] = [
    {
      id: uid(),
      studio_id: MOCK_STUDIO_ID,
      name: "Ana Paula Ferreira",
      phone: "5511987654321",
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uid(),
      studio_id: MOCK_STUDIO_ID,
      name: "Camila Rodrigues",
      phone: "5511976543210",
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uid(),
      studio_id: MOCK_STUDIO_ID,
      name: "Juliana Souza",
      phone: "5511965432109",
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  const [clientAna, clientCamila, clientJuliana] = clients;

  const bookings: Booking[] = [
    {
      id: uid(),
      studio_id: MOCK_STUDIO_ID,
      service_id: svcSobrancelhas.id,
      client_id: clientAna.id,
      client_name: clientAna.name,
      client_phone: clientAna.phone,
      start_at: localDateTimeToUtc(today, "09:00").toISOString(),
      end_at: localDateTimeToUtc(today, "09:40").toISOString(),
      status: "finalizado",
      created_at: new Date().toISOString(),
    },
    {
      id: uid(),
      studio_id: MOCK_STUDIO_ID,
      service_id: svcCilios.id,
      client_id: clientCamila.id,
      client_name: clientCamila.name,
      client_phone: clientCamila.phone,
      start_at: localDateTimeToUtc(today, "10:00").toISOString(),
      end_at: localDateTimeToUtc(today, "11:30").toISOString(),
      status: "em_atendimento",
      created_at: new Date().toISOString(),
    },
    {
      id: uid(),
      studio_id: MOCK_STUDIO_ID,
      service_id: svcMicro.id,
      client_id: clientJuliana.id,
      client_name: clientJuliana.name,
      client_phone: clientJuliana.phone,
      start_at: localDateTimeToUtc(today, "14:00").toISOString(),
      end_at: localDateTimeToUtc(today, "16:00").toISOString(),
      status: "agendado",
      created_at: new Date().toISOString(),
    },
  ];

  // Lembretes e WhatsApp nascem vazios: sem linha = configuração padrão,
  // igual ao banco real, onde a linha só existe depois do primeiro save.
  return {
    studios,
    services,
    workingHours,
    blocks,
    bookings,
    clients,
    reminderSettings: [],
    whatsappConnections: [],
  };
}

const db = (globalThis.__agendaMockDb ??= buildSeedDb());
const {
  studios,
  services,
  workingHours,
  blocks,
  bookings,
  clients,
  reminderSettings,
  whatsappConnections,
} = db;

// ---------------------------------------------------------------------------
// studios
// ---------------------------------------------------------------------------
export function mockFindStudioBySlug(slug: string): Studio | null {
  return studios.find((s) => s.slug === slug) ?? null;
}

export function mockFindStudioByOwnerId(ownerId: string): Studio | null {
  return studios.find((s) => s.owner_id === ownerId) ?? null;
}

/**
 * Colunas nullable ficam opcionais no INSERT: no Postgres elas assumem NULL
 * quando omitidas, e o mock precisa espelhar isso — senão cada coluna nova da
 * 0006 obrigaria todos os chamadores a repetir `null`.
 */
type MockStudioInput = Omit<
  Studio,
  | "id"
  | "created_at"
  | "logo_url"
  | "banner_url"
  | "owner_name"
  | "owner_cpf"
  | "owner_birth_date"
  | "acquired_at"
> &
  Partial<
    Pick<
      Studio,
      "logo_url" | "banner_url" | "owner_name" | "owner_cpf" | "owner_birth_date" | "acquired_at"
    >
  >;

export function mockCreateStudio(input: MockStudioInput): Studio {
  const studio: Studio = {
    ...input,
    logo_url: input.logo_url ?? null,
    banner_url: input.banner_url ?? null,
    owner_name: input.owner_name ?? null,
    owner_cpf: input.owner_cpf ?? null,
    owner_birth_date: input.owner_birth_date ?? null,
    acquired_at: input.acquired_at ?? null,
    id: uid(),
    created_at: new Date().toISOString(),
  };
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
    // Arquivado nunca aparece em listagem — só sobrevive para o histórico.
    .filter((s) => s.archived_at === null)
    .filter((s) => (opts?.activeOnly ? s.active : true))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function mockGetService(id: string): Service | null {
  return services.find((s) => s.id === id) ?? null;
}

/** Ver `MockStudioInput`: `notes` e `archived_at` são nullable e opcionais. */
type MockServiceInput = Omit<Service, "id" | "created_at" | "notes" | "archived_at"> &
  Partial<Pick<Service, "notes" | "archived_at">>;

export function mockCreateService(input: MockServiceInput): Service {
  const service: Service = {
    ...input,
    notes: input.notes ?? null,
    archived_at: input.archived_at ?? null,
    id: uid(),
    created_at: new Date().toISOString(),
  };
  services.push(service);
  return service;
}

export function mockUpdateService(id: string, patch: Partial<Service>): Service {
  const idx = services.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("Serviço não encontrado");
  services[idx] = { ...services[idx], ...patch };
  return services[idx];
}

/**
 * Espelha os dois regimes do servidor (ver `deleteService`): serviço nunca
 * agendado some de vez; serviço com histórico é arquivado.
 */
export function mockDeleteService(id: string): "deleted" | "archived" {
  const idx = services.findIndex((s) => s.id === id);
  if (idx === -1) return "deleted";

  if (bookings.some((b) => b.service_id === id)) {
    services[idx] = {
      ...services[idx],
      archived_at: new Date().toISOString(),
      active: false,
    };
    return "archived";
  }

  services.splice(idx, 1);
  return "deleted";
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

function hasScheduleConflict(
  studioId: string,
  startIso: string,
  endIso: string,
  excludeBookingId?: string
): boolean {
  const newStart = new Date(startIso).getTime();
  const newEnd = new Date(endIso).getTime();
  return bookings.some(
    (b) =>
      b.studio_id === studioId &&
      b.id !== excludeBookingId &&
      b.status !== "cancelado" &&
      newStart < new Date(b.end_at).getTime() &&
      new Date(b.start_at).getTime() < newEnd
  );
}

export function mockCreateBooking(
  input: Omit<Booking, "id" | "created_at" | "status">
): CreateBookingResult {
  if (hasScheduleConflict(input.studio_id, input.start_at, input.end_at)) {
    return { ok: false, error: "conflict" };
  }

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

export type UpdateBookingScheduleInput = {
  serviceId: string;
  startAt: string;
  endAt: string;
};

export function mockUpdateBookingSchedule(
  id: string,
  input: UpdateBookingScheduleInput
): CreateBookingResult {
  const idx = bookings.findIndex((b) => b.id === id);
  if (idx === -1) throw new Error("Agendamento não encontrado");
  const current = bookings[idx];
  if (hasScheduleConflict(current.studio_id, input.startAt, input.endAt, id)) {
    return { ok: false, error: "conflict" };
  }
  bookings[idx] = {
    ...current,
    service_id: input.serviceId,
    start_at: input.startAt,
    end_at: input.endAt,
  };
  return { ok: true, booking: bookings[idx] };
}

export function mockGetBooking(id: string): Booking | null {
  return bookings.find((b) => b.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// clients
// ---------------------------------------------------------------------------
export function mockListClients(studioId: string): Client[] {
  return clients.filter((c) => c.studio_id === studioId).sort((a, b) => a.name.localeCompare(b.name));
}

export function mockGetClient(id: string): Client | null {
  return clients.find((c) => c.id === id) ?? null;
}

export function mockUpsertClient(input: { studio_id: string; name: string; phone: string }): Client {
  const idx = clients.findIndex((c) => c.studio_id === input.studio_id && c.phone === input.phone);
  if (idx !== -1) {
    clients[idx] = { ...clients[idx], name: input.name, updated_at: new Date().toISOString() };
    return clients[idx];
  }
  const client: Client = {
    id: uid(),
    studio_id: input.studio_id,
    name: input.name,
    phone: input.phone,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  clients.push(client);
  return client;
}

export function mockUpdateClientNotes(id: string, notes: string | null): Client {
  const idx = clients.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Cliente não encontrado");
  clients[idx] = { ...clients[idx], notes, updated_at: new Date().toISOString() };
  return clients[idx];
}

// ---------------------------------------------------------------------------
// reminder_settings (item 7) — 1 linha por estúdio.
// ---------------------------------------------------------------------------
const REMINDER_DEFAULTS = {
  enabled: false,
  lead_time_minutes: 1440,
  message_template:
    "Olá {cliente}! Passando para confirmar seu horário de {servico} em {data} às {hora}. Até logo! — {salao}",
  include_link: false,
  link_url: null,
};

export function mockGetReminderSettings(studioId: string): ReminderSettings {
  return (
    reminderSettings.find((r) => r.studio_id === studioId) ?? {
      studio_id: studioId,
      ...REMINDER_DEFAULTS,
      updated_at: new Date().toISOString(),
    }
  );
}

export function mockUpsertReminderSettings(
  studioId: string,
  input: Omit<ReminderSettings, "studio_id" | "updated_at">
): ReminderSettings {
  const row: ReminderSettings = {
    studio_id: studioId,
    ...input,
    link_url: input.include_link ? input.link_url : null,
    updated_at: new Date().toISOString(),
  };
  const idx = reminderSettings.findIndex((r) => r.studio_id === studioId);
  if (idx === -1) reminderSettings.push(row);
  else reminderSettings[idx] = row;
  return row;
}

// ---------------------------------------------------------------------------
// whatsapp_connections (item 8) — só leitura: a Evolution API ainda não existe.
// ---------------------------------------------------------------------------
export function mockGetWhatsAppConnection(studioId: string): WhatsAppConnection {
  return (
    whatsappConnections.find((w) => w.studio_id === studioId) ?? {
      studio_id: studioId,
      status: "desconectado",
      instance_name: null,
      connected_phone: null,
      last_error: null,
      last_connected_at: null,
      updated_at: new Date().toISOString(),
    }
  );
}
