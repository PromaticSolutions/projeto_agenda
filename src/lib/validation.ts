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

/** Criação do estúdio. Sem `logo_url`: o estúdio nasce com a marca do
 *  Timely e só troca depois, na Conta. */
export const studioOnboardingSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do estúdio").max(80),
  slug: slugSchema,
  whatsapp: whatsappSchema,
  brand_color: hexColorSchema,
});

/** Aba "Identidade" da Conta: o cadastro + as imagens que só existem aqui.
 *  `logo_url` vazio é um estado válido e significativo — é o que diz "use a
 *  marca do Timely na minha página". */
export const studioIdentitySchema = studioOnboardingSchema.extend({
  logo_url: optionalUrlSchema,
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

const ACEITE_OBRIGATORIO = "É preciso aceitar a Política de Privacidade para agendar.";

export const createBookingSchema = z.object({
  serviceId: z.uuid(),
  clientName: clientNameSchema,
  clientPhone: clientPhoneSchema,
  startAt: z.iso.datetime({ offset: true }),
  /* Aceite da política, exigido NO SERVIDOR e não só no formulário. Um
     checkbox desmarcável no navegador não é prova de nada: quem chamar a API
     direto criaria agendamento sem consentimento, e é exatamente esse caminho
     que precisa estar fechado para o registro em `consents` valer alguma
     coisa. `refine` em vez de `z.literal(true)` porque a mensagem de erro
     precisa dizer o que fazer, e não "invalid literal". */
  privacyAccepted: z
    // A mensagem se repete no tipo e no refine porque são dois erros
    // diferentes — campo ausente e campo `false` — e quem chama a API não tem
    // nada a ganhar sabendo qual dos dois foi.
    .boolean({ error: ACEITE_OBRIGATORIO })
    .refine((v) => v === true, ACEITE_OBRIGATORIO),
});

/**
 * Solicitação do titular (LGPD art. 18), enviada da página pública
 * `/[slug]/meus-dados`. `message` é opcional: quem pede exclusão não deve ser
 * obrigada a justificar — o direito não depende de motivo.
 */
export const dataSubjectRequestSchema = z.object({
  kind: z.enum(["acesso", "correcao", "exclusao", "oposicao"], {
    error: "Escolha o tipo de solicitação.",
  }),
  clientName: clientNameSchema,
  clientPhone: clientPhoneSchema,
  message: z.string().trim().max(1000, "Mensagem muito longa").optional(),
});

export const bookingStatusSchema = z.enum([
  "agendado",
  "em_atendimento",
  "finalizado",
  "cancelado",
]);

/**
 * Agendamento criado manualmente pelo dono no painel. Diferente do público
 * (createBookingSchema), o horário chega como data + hora local do estúdio —
 * a conversão para UTC acontece na Server Action via `localDateTimeToUtc` — e
 * a duração é editável, porque o modo "encaixe" permite fugir da grade de
 * horários sugerida.
 */
export const manualBookingSchema = z.object({
  serviceId: z.uuid("Selecione um serviço"),
  clientName: clientNameSchema,
  clientPhone: clientPhoneSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
  durationMin: z
    .number()
    .int()
    .min(5, "Duração mínima de 5 minutos")
    .max(600, "Duração máxima de 10 horas"),
  /** true = encaixe: ignora expediente e bloqueios (nunca ignora colisão com outro agendamento). */
  encaixe: z.boolean(),
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

/**
 * Envio manual de WhatsApp (seções 20–24 do plano de integração).
 *
 * Reaproveita `clientPhoneSchema`: o número digitado aqui é normalizado para
 * o MESMO formato do resto do sistema (55DDNNNNNNNNN), que é o que a check
 * constraint de `message_outbox.to_phone` aceita e o que o gateway espera.
 * Um segundo formato de telefone só nesta tela seria um jeito de descobrir a
 * divergência quando a mensagem não sair.
 */
export const manualWhatsAppMessageSchema = z.object({
  phone: clientPhoneSchema,
  message: z
    .string()
    .trim()
    .min(1, "Escreva a mensagem que será enviada")
    // O WhatsApp aceita mais que isso, mas texto muito longo costuma ser
    // colagem acidental — e o corpo é gravado no histórico de toda mensagem.
    .max(4096, "A mensagem passou de 4096 caracteres"),
});

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
// ---------------------------------------------------------------------------
// Pesquisa de mercado da landing (0013)
// ---------------------------------------------------------------------------
/**
 * As opções ficam AQUI, não no componente, e o formulário as importa.
 *
 * O motivo é concreto: o `value` gravado no banco e o `label` mostrado na tela
 * precisam andar juntos. Declarados em dois lugares, um ajuste de texto na
 * interface passaria a gravar valor que o Zod recusa — e a pessoa perderia o
 * formulário inteiro no envio, depois de nove etapas.
 */

export const LEAD_PROFESSIONS = [
  { value: "salao", label: "Salão" },
  { value: "cabeleireiro", label: "Cabeleireiro(a)" },
  { value: "barbeiro", label: "Barbeiro(a)" },
  { value: "manicure", label: "Manicure" },
  { value: "nail_designer", label: "Nail designer" },
  { value: "lash_designer", label: "Lash designer" },
  { value: "estetica", label: "Estética" },
  { value: "maquiagem", label: "Maquiagem" },
  { value: "outro", label: "Outro" },
] as const;

export const LEAD_TEAM_SIZES = [
  { value: "sozinho", label: "Sozinho(a)" },
  { value: "2_3", label: "2 a 3 profissionais" },
  { value: "4_10", label: "4 a 10 profissionais" },
  { value: "10_mais", label: "Mais de 10" },
] as const;

export const LEAD_AGENDA_TOOLS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "papel", label: "Papel ou caderno" },
  { value: "planilha", label: "Planilha" },
  { value: "outro_sistema", label: "Outro sistema" },
  { value: "misturo", label: "Misturo vários" },
] as const;

export const LEAD_PAIN_POINTS = [
  { value: "faltas", label: "Clientes que faltam" },
  { value: "esquecer", label: "Esquecer horários" },
  { value: "organizar_agenda", label: "Organizar a agenda" },
  { value: "responder_whatsapp", label: "Responder WhatsApp" },
  { value: "confirmar", label: "Confirmar clientes" },
  { value: "faturamento", label: "Saber quanto estou faturando" },
  { value: "organizar_clientes", label: "Organizar clientes" },
  { value: "outro", label: "Outro" },
] as const;

export const LEAD_WEEKLY_VOLUMES = [
  { value: "ate_10", label: "Até 10" },
  { value: "11_25", label: "11 a 25" },
  { value: "26_50", label: "26 a 50" },
  { value: "51_100", label: "51 a 100" },
  { value: "100_mais", label: "Mais de 100" },
] as const;

export const LEAD_WHATSAPP_RELIANCE = [
  { value: "pouco", label: "Pouco" },
  { value: "medio", label: "Médio" },
  { value: "muito", label: "Muito" },
  { value: "quase_tudo", label: "Praticamente tudo" },
] as const;

export const LEAD_INTERESTS = [
  { value: "sim", label: "Sim, quero testar" },
  { value: "talvez", label: "Talvez" },
  { value: "saber_mais", label: "Quero saber mais" },
  { value: "nao", label: "Não" },
] as const;

/** Extrai os `value` de uma lista de opções para montar o enum do Zod. */
function values<T extends readonly { value: string }[]>(options: T) {
  return options.map((o) => o.value) as [string, ...string[]];
}

/**
 * Faixas de tempo perdido da interação "quanto isso custa".
 *
 * É a única "pergunta" que a pessoa responde ANTES do formulário — e ela
 * responde porque quer ver o resultado, não porque pedimos. Por isso vale
 * mais que uma pergunta direta, e viaja junto com o lead.
 */
export const LEAD_HOURS_BANDS = [
  { value: "ate_2", label: "Até 2h", hoursPerWeek: 2 },
  { value: "3_5", label: "3 a 5h", hoursPerWeek: 4 },
  { value: "6_10", label: "6 a 10h", hoursPerWeek: 8 },
  { value: "10_mais", label: "Mais de 10h", hoursPerWeek: 12 },
] as const;

/**
 * O QUE O FORMULÁRIO EXIGE.
 *
 * Cinco campos, e nenhum a mais. Cada campo obrigatório extra é uma chance de
 * a pessoa desistir no último passo — e quem chega ao fim do funil é
 * exatamente quem não pode esbarrar em pergunta que ninguém pediu.
 *
 * O resto do contexto (equipe, volume, dificuldade) é coletado DEPOIS do
 * envio, em perguntas opcionais, por `leadContextSchema`.
 */
export const leadCaptureSchema = z.object({
  name: clientNameSchema,
  // Opcional de propósito: muita gente da beleza atende sem marca própria, e
  // exigir "nome do negócio" faria essa pessoa inventar um ou desistir.
  business_name: z
    .string()
    .trim()
    .max(80, "Nome muito longo")
    .optional()
    .or(z.literal("")),
  profession: z.enum(values(LEAD_PROFESSIONS), { message: "Escolha uma opção" }),
  phone: clientPhoneSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160, "E-mail muito longo")
    .pipe(z.email("Informe um e-mail válido")),

  // Aceite explícito de tratamento de dados. `literal(true)` em vez de
  // `boolean`: um `false` aqui não é "respondeu que não", é formulário que
  // não pode ser enviado.
  privacy_accepted: z.literal(true, {
    message: "É preciso aceitar o uso dos seus dados para continuar",
  }),

  // Subprodutos de interações voluntárias, não campos de formulário.
  hours_lost_band: z.enum(values(LEAD_HOURS_BANDS)).optional(),
  // Contexto do fluxo comercial. Continua opcional no contrato para que o
  // endpoint aceite capturas curtas, mas a landing o envia já estruturado.
  team_size: z.enum(values(LEAD_TEAM_SIZES)).optional(),
  agenda_tools: z.array(z.enum(values(LEAD_AGENDA_TOOLS))).max(LEAD_AGENDA_TOOLS.length).optional(),
  pain_points: z.array(z.enum(values(LEAD_PAIN_POINTS))).max(LEAD_PAIN_POINTS.length).optional(),
  weekly_volume: z.enum(values(LEAD_WEEKLY_VOLUMES)).optional(),
  whatsapp_reliance: z.enum(values(LEAD_WHATSAPP_RELIANCE)).optional(),
  improvement_wish: z.string().trim().max(1000, "Máximo de 1000 caracteres").optional().or(z.literal("")),
  utm: z.record(z.string(), z.string()).optional(),
});

export type LeadCapture = z.infer<typeof leadCaptureSchema>;

/**
 * O CONTEXTO OPCIONAL, oferecido depois do envio.
 *
 * Tudo opcional, inclusive o conjunto inteiro: quem fechar a página nesse
 * ponto já é um lead completo. Serve para o time chegar na conversa sabendo
 * de que rotina está falando.
 */
export const leadContextSchema = z.object({
  id: z.uuid("Lead inválido"),
  team_size: z.enum(values(LEAD_TEAM_SIZES)).optional(),
  agenda_tools: z.array(z.enum(values(LEAD_AGENDA_TOOLS))).max(LEAD_AGENDA_TOOLS.length).optional(),
  pain_points: z.array(z.enum(values(LEAD_PAIN_POINTS))).max(LEAD_PAIN_POINTS.length).optional(),
  weekly_volume: z.enum(values(LEAD_WEEKLY_VOLUMES)).optional(),
  whatsapp_reliance: z.enum(values(LEAD_WHATSAPP_RELIANCE)).optional(),
  improvement_wish: z.string().trim().max(1000, "Máximo de 1000 caracteres").optional().or(z.literal("")),
});

export type LeadContext = z.infer<typeof leadContextSchema>;

/** Rótulo de um `value` gravado, para montar o resumo legível da notificação. */
export function leadLabel(
  options: readonly { value: string; label: string }[],
  value: string
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
