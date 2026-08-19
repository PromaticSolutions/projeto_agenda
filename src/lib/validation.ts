import { z } from "zod";

/** Mantém só dígitos — usado antes de validar/gravar telefone e CPF. */
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
  .min(2, "Informe o nome completo")
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

/** Data no formato do input[type=date] e da coluna `date` do Postgres. */
const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00Z`)), "Data inexistente");

/** URL http(s) — usada em logo, banner e link do lembrete. */
const httpUrlSchema = z
  .url("Endereço inválido — comece com https://")
  .refine((value) => /^https?:\/\//i.test(value), "Use um endereço http:// ou https://");

// ---------------------------------------------------------------------------
// CPF
// ---------------------------------------------------------------------------

/**
 * Valida CPF pelos dois dígitos verificadores — não só o comprimento.
 * Rejeita também as sequências repetidas (111.111.111-11 e afins), que
 * passam no cálculo mas não são CPFs válidos.
 */
export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const checkDigit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) {
      sum += Number(digits[i]) * (length + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
}

/** Normaliza para 11 dígitos, como a check constraint de studios.owner_cpf espera. */
export const cpfSchema = z
  .string()
  .transform(onlyDigits)
  .refine(isValidCpf, "CPF inválido — confira os dígitos");

// ---------------------------------------------------------------------------
// Upload de imagem (logo e banner)
// ---------------------------------------------------------------------------

/** Teto por arquivo. Casado com o bucket studio-media e com o
 *  serverActions.bodySizeLimit de next.config.ts (que é maior, para caber o
 *  overhead do multipart). */
export const MAX_IMAGE_UPLOAD_BYTES = 4 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export const IMAGE_UPLOAD_ACCEPT = ALLOWED_IMAGE_MIME_TYPES.join(",");

export type ImageUploadKind = "logo" | "banner";

/**
 * Checagem do arquivo recebido pela Server Action. Roda no servidor de
 * propósito: `accept` no input e qualquer verificação no browser são dica de
 * usabilidade, não barreira — o cliente pode postar o que quiser.
 */
export function validateImageUpload(
  file: File
): { ok: true } | { ok: false; error: string } {
  if (file.size === 0) return { ok: false, error: "Arquivo vazio." };
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    const mb = (MAX_IMAGE_UPLOAD_BYTES / 1024 / 1024).toFixed(0);
    return { ok: false, error: `Imagem acima de ${mb} MB. Reduza o arquivo e tente de novo.` };
  }
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    return { ok: false, error: "Formato não aceito. Use JPG, PNG, WebP ou AVIF." };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Estúdio
// ---------------------------------------------------------------------------

const optionalUrlSchema = z.union([z.literal(""), httpUrlSchema]).optional();

export const studioOnboardingSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do estúdio").max(80),
  slug: slugSchema,
  whatsapp: whatsappSchema,
  brand_color: hexColorSchema,
  logo_url: optionalUrlSchema,
});

/** Aba "Identidade" da Conta: onboarding + banner. */
export const studioIdentitySchema = studioOnboardingSchema.extend({
  banner_url: optionalUrlSchema,
});

/**
 * Módulo Configurações (item 6). O e-mail NÃO entra aqui: ele vive em
 * auth.users e é trocado pelo fluxo de autenticação do Supabase, que dispara
 * confirmação no endereço novo — deixar um form comum sobrescrevendo essa
 * coluna passaria por cima da verificação.
 */
export const studioProfileSchema = z.object({
  owner_name: z.union([z.literal(""), clientNameSchema]).optional(),
  salon_name: z.string().trim().min(2, "Informe o nome do salão").max(80),
  owner_cpf: z.union([z.literal(""), cpfSchema]).optional(),
  owner_birth_date: z
    .union([z.literal(""), isoDateSchema])
    .optional()
    .refine((value) => {
      if (!value) return true;
      const birth = new Date(`${value}T12:00:00Z`);
      if (birth > new Date()) return false;
      const minimum = new Date();
      minimum.setUTCFullYear(minimum.getUTCFullYear() - 16);
      return birth <= minimum;
    }, "Data de nascimento inválida — o responsável precisa ter ao menos 16 anos"),
  acquired_at: z
    .union([z.literal(""), isoDateSchema])
    .optional()
    .refine(
      (value) => !value || new Date(`${value}T12:00:00Z`) <= new Date(),
      "A data de aquisição não pode estar no futuro"
    ),
});

// ---------------------------------------------------------------------------
// Serviços
// ---------------------------------------------------------------------------

export const serviceInputSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do serviço").max(80),
  price_cents: z.number().int().min(0, "Preço não pode ser negativo"),
  duration_min: z.number().int().min(5, "Duração mínima de 5 minutos").max(600),
  color: hexColorSchema,
  active: z.boolean(),
  /** Item 2 do escopo: campo opcional, uso interno. */
  notes: z.string().trim().max(2000, "Máximo de 2000 caracteres").optional(),
});

// ---------------------------------------------------------------------------
// Horários e bloqueios
// ---------------------------------------------------------------------------

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
    start_at: z.iso.datetime({ offset: true }),
    end_at: z.iso.datetime({ offset: true }),
    reason: z.string().trim().max(120).optional(),
  })
  .refine((v) => new Date(v.end_at) > new Date(v.start_at), {
    message: "O fim precisa ser depois do início",
    path: ["end_at"],
  });

// ---------------------------------------------------------------------------
// Agendamentos
// ---------------------------------------------------------------------------

export const createBookingSchema = z.object({
  serviceId: z.uuid(),
  clientName: clientNameSchema,
  clientPhone: clientPhoneSchema,
  startAt: z.iso.datetime({ offset: true }),
});

export const bookingStatusSchema = z.enum([
  "agendado",
  "em_atendimento",
  "finalizado",
  "cancelado",
]);

/** Formulário de agendamento manual/edição pelo dono: data + horário
 * locais (sem timezone) em vez de um `startAt` já em UTC — a conversão
 * acontece na Server Action via `localDateTimeToUtc`. */
export const manualBookingSchema = z.object({
  serviceId: z.uuid("Selecione um serviço"),
  clientName: clientNameSchema,
  clientPhone: clientPhoneSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
});

export const bookingScheduleSchema = z.object({
  serviceId: z.uuid("Selecione um serviço"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
});

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export const clientNotesSchema = z.object({
  notes: z.string().trim().max(2000, "Máximo de 2000 caracteres").optional(),
});

/** Cadastro/edição manual de cliente (item 3). Só nome e telefone. */
export const clientInputSchema = z.object({
  name: clientNameSchema,
  phone: clientPhoneSchema,
});

// ---------------------------------------------------------------------------
// Lembretes (item 7)
// ---------------------------------------------------------------------------

export const REMINDER_PLACEHOLDERS = [
  "{cliente}",
  "{servico}",
  "{data}",
  "{hora}",
  "{salao}",
] as const;

/** Presets de antecedência oferecidos na interface, em minutos. */
export const REMINDER_LEAD_TIME_OPTIONS = [
  { value: 30, label: "30 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 120, label: "2 horas antes" },
  { value: 180, label: "3 horas antes" },
  { value: 360, label: "6 horas antes" },
  { value: 720, label: "12 horas antes" },
  { value: 1440, label: "1 dia antes" },
  { value: 2880, label: "2 dias antes" },
  { value: 10080, label: "1 semana antes" },
] as const;

export const reminderSettingsSchema = z
  .object({
    enabled: z.boolean(),
    lead_time_minutes: z
      .number()
      .int()
      .min(5, "A antecedência mínima é de 5 minutos")
      .max(10080, "A antecedência máxima é de 7 dias"),
    message_template: z
      .string()
      .trim()
      .min(10, "A mensagem está curta demais")
      .max(1000, "Máximo de 1000 caracteres"),
    include_link: z.boolean(),
    link_url: z.union([z.literal(""), httpUrlSchema]).optional(),
  })
  // Espelha a check constraint `reminder_settings_link_required`: se o banco
  // recusaria a linha, o erro precisa aparecer no campo, não como exceção.
  .refine((v) => !v.include_link || Boolean(v.link_url), {
    message: "Informe o link que será enviado, ou desligue a opção de incluir link",
    path: ["link_url"],
  });
