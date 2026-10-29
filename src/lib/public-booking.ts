import { STUDIO_TIMEZONE, addLocalDays, utcToLocalDate } from "@/lib/availability";

/**
 * Peças puras da página pública de agendamento: cor da marca, rótulos de data
 * e os links de "adicionar à agenda". Ficam fora do componente para serem
 * testadas sem navegador.
 */

// --- Cor da marca ------------------------------------------------------------

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Cor do texto por cima da cor escolhida pelo dono: branco ou quase preto,
 * o que der mais contraste (fórmula de luminância da WCAG). O dono escolhe a
 * cor livremente, e um amarelo-claro com texto branco deixaria o botão de
 * confirmar ilegível.
 */
export function brandForeground(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return "#ffffff";
  const n = parseInt(match[1], 16);
  const luminance =
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  const contrastWhite = 1.05 / (luminance + 0.05);
  const contrastDark = (luminance + 0.05) / 0.05;
  return contrastWhite >= contrastDark ? "#ffffff" : "#1c1424";
}

// --- Datas -------------------------------------------------------------------

/** "YYYY-MM-DD" → Date ao meio-dia UTC, que cai no mesmo dia em qualquer fuso. */
function noonUtc(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

const weekdayShort = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function clean(label: string): string {
  return label.replace(".", "");
}

/** Pedaços da pílula de data: "qua", "12", "nov". */
export function dayParts(date: string): { weekday: string; day: string; month: string } {
  const d = noonUtc(date);
  return {
    weekday: clean(weekdayShort.format(d)),
    day: String(d.getUTCDate()),
    month: clean(monthShort.format(d)),
  };
}

/** "quarta-feira, 12 de novembro". */
export function formatLongDate(date: string): string {
  return longDate.format(noonUtc(date));
}

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: STUDIO_TIMEZONE,
});

/**
 * "hoje às 14:00", "amanhã às 09:00", "qua, 12 nov às 09:00" — a prévia do
 * próximo horário livre na lista de serviços.
 */
export function relativeSlotLabel(iso: string, now = new Date()): string {
  const instant = new Date(iso);
  const day = utcToLocalDate(instant);
  const today = utcToLocalDate(now);
  const time = timeFormatter.format(instant);
  if (day === today) return `hoje às ${time}`;
  if (day === addLocalDays(today, 1)) return `amanhã às ${time}`;
  const { weekday, day: dayNumber, month } = dayParts(day);
  return `${weekday}, ${dayNumber} ${month} às ${time}`;
}

export type DayPeriod = "manha" | "tarde" | "noite";

export const DAY_PERIOD_LABELS: Record<DayPeriod, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

/** Período do horário no fuso do estúdio: antes de 12h, antes de 18h, depois. */
export function dayPeriodOf(iso: string): DayPeriod {
  const hour = Number(timeFormatter.format(new Date(iso)).slice(0, 2));
  if (hour < 12) return "manha";
  if (hour < 18) return "tarde";
  return "noite";
}

// --- Adicionar à agenda ------------------------------------------------------

export interface CalendarEvent {
  title: string;
  details: string;
  start: Date;
  end: Date;
}

/** 20261112T120000Z — o formato de data que Google e iCalendar aceitam. */
function compactUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    details: event.details,
    dates: `${compactUtc(event.start)}/${compactUtc(event.end)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Arquivo .ics: abre na agenda do iPhone, do Outlook e de quase todo o resto. */
export function icsContent(event: CalendarEvent, uid: string, now = new Date()): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Timely//Agendamento//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${compactUtc(now)}`,
    `DTSTART:${compactUtc(event.start)}`,
    `DTEND:${compactUtc(event.end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.details)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(event.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
