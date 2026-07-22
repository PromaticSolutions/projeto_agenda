import { z } from "zod";

/** Mantém só dígitos — usado antes de validar/gravar telefone. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Telefone BR em E.164 sem "+", igual ao formato exigido pelo wa.me e pela
 * check constraint do banco (^\d{10,15}$). Aceita o usuário digitando com
 * ou sem o "55" e com ou sem máscara; sempre normaliza para 55DDNNNNNNNNN.
 */
export const clientPhoneSchema = z
  .string()
  .transform(onlyDigits)
  .pipe(
    z
      .string()
      .transform((digits) => (digits.startsWith("55") ? digits : `55${digits}`))
      .pipe(
        z
          .string()
          .regex(/^55\d{10,11}$/, "Telefone inválido. Use DDD + número, ex.: (11) 93447-6935")
      )
  );

export const clientNameSchema = z
  .string()
  .trim()
  .min(2, "Informe seu nome completo")
  .max(80, "Nome muito longo")
  .regex(/^[\p{L}\p{M} '.-]+$/u, "Nome contém caracteres inválidos");

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "O link precisa ter pelo menos 3 caracteres")
  .max(60, "O link é muito longo")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use só letras minúsculas, números e hífen (sem espaços)");

export const whatsappSchema = clientPhoneSchema;

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida, use o formato #RRGGBB");

export const studioOnboardingSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do estúdio").max(80),
  slug: slugSchema,
  whatsapp: whatsappSchema,
  brand_color: hexColorSchema,
  logo_url: z.union([z.literal(""), z.string().trim().url("URL de logo inválida")]).optional(),
});

export const serviceInputSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do serviço").max(80),
  price_cents: z.number().int().min(0, "Preço não pode ser negativo"),
  duration_min: z.number().int().min(5, "Duração mínima de 5 minutos").max(600),
  color: hexColorSchema,
  active: z.boolean(),
});

export const workingHourInputSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
  })
  .refine((v) => v.start_time < v.end_time, {
    message: "O horário final precisa ser depois do inicial",
    path: ["end_time"],
  });

export const blockInputSchema = z
  .object({
    start_at: z.string().datetime({ offset: true }),
    end_at: z.string().datetime({ offset: true }),
    reason: z.string().trim().max(120).optional(),
  })
  .refine((v) => new Date(v.end_at) > new Date(v.start_at), {
    message: "O fim precisa ser depois do início",
    path: ["end_at"],
  });

export const createBookingSchema = z.object({
  serviceId: z.string().uuid(),
  clientName: clientNameSchema,
  clientPhone: clientPhoneSchema,
  startAt: z.string().datetime({ offset: true }),
});

export const bookingStatusSchema = z.enum([
  "agendado",
  "em_atendimento",
  "finalizado",
  "cancelado",
]);
