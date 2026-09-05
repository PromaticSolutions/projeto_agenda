import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseServiceConfigured } from "@/lib/supabase/env";
import { enqueueLeadNotification, saveLead, updateLeadContext } from "@/lib/data/leads";
import { leadCaptureSchema, leadContextSchema } from "@/lib/validation";

/**
 * Leads da landing.
 *
 *   POST  — a captura: cinco campos, grava e avisa no WhatsApp.
 *   PATCH — o contexto opcional respondido depois, identificado pelo UUID que
 *           o POST devolveu.
 *
 * Segundo caminho de escrita pública do sistema, e segue o desenho do
 * primeiro (/api/bookings): validação com Zod no servidor e gravação por
 * service_role. A tabela não tem policy de RLS, então não existe atalho do
 * navegador direto para o banco.
 *
 * O que NÃO faz: criar conta ou tocar `auth.users`. Preencher este formulário
 * não é se cadastrar — quem quiser testar passa pelo /signup que já existe.
 */

export const maxDuration = 30;

/**
 * Teto global por janela. A proteção real contra repetição é o índice único
 * em `phone`; este teto só impede que um script trivial encha a tabela, e é
 * alto o bastante para não barrar tráfego legítimo.
 *
 * Contado no banco, não em memória: na Vercel cada requisição pode cair em
 * uma instância diferente, e um contador em memória contaria do zero em cada.
 */
const MAX_LEADS_PER_WINDOW = 60;
const WINDOW_MINUTES = 10;

async function overGlobalLimit(): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const supabase = createServiceRoleSupabaseClient();
  const { count, error } = await supabase
    .from("market_research_leads")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if (error) throw error;
  return (count ?? 0) >= MAX_LEADS_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = leadCaptureSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: issue?.message ?? "Dados inválidos",
        // O campo permite à interface destacar o input certo em vez de
        // mostrar um erro genérico no rodapé do formulário.
        field: issue?.path?.[0] ?? null,
      },
      { status: 400 }
    );
  }

  if (!isSupabaseServiceConfigured) {
    return NextResponse.json({ error: "O envio não está disponível agora." }, { status: 503 });
  }

  try {
    if (await overGlobalLimit()) {
      return NextResponse.json(
        { error: "Muitos envios agora. Tente novamente em alguns minutos." },
        { status: 429, headers: { "Retry-After": "600" } }
      );
    }

    const result = await saveLead(parsed.data);
    if (!result.ok) {
      return NextResponse.json({ error: "Não foi possível enviar. Tente novamente." }, { status: 503 });
    }

    // Telefone que já se cadastrou: para quem preencheu é sucesso — os dados
    // dela estão gravados. Dizer "você já enviou" faria a pessoa achar que
    // perdeu o trabalho, e não há nada a corrigir.
    if (result.duplicate) {
      return NextResponse.json({ ok: true, duplicate: true, id: null });
    }

    // O aviso é conveniência: se falhar, o lead já está salvo. Por isso não
    // entra no status da resposta.
    const notified = await enqueueLeadNotification(result.lead);

    // O id volta para a interface poder acrescentar o contexto opcional
    // depois, sem um segundo cadastro.
    return NextResponse.json({ ok: true, duplicate: false, id: result.lead.id, notified });
  } catch (cause) {
    console.error("[api/leads]", cause);
    return NextResponse.json(
      { error: "Não foi possível enviar seus dados. Tente novamente." },
      { status: 500 }
    );
  }
}

/**
 * Contexto opcional, respondido na tela de confirmação.
 *
 * Silencioso de propósito: a pessoa já converteu, e um erro aqui não pode
 * virar mensagem de falha numa tela que acabou de dizer "tudo certo". O que
 * não puder ser gravado simplesmente não é.
 */
export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = leadContextSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  if (!isSupabaseServiceConfigured) {
    return NextResponse.json({ ok: true, saved: false });
  }

  try {
    const lead = await updateLeadContext(parsed.data);
    return NextResponse.json({ ok: true, saved: lead !== null });
  } catch (cause) {
    console.error("[api/leads:PATCH]", cause);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
