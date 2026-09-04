import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BellRing,
  CalendarClock,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { getStudioDetail } from "@/lib/data/platformMetrics";
import { getStudioBilling, isBillingSchemaReady } from "@/lib/data/billing";
import { KpiTile } from "@/components/superadmin/kpi-tile";
import { ChartCard } from "@/components/superadmin/chart-card";
import { CategoryBars } from "@/components/superadmin/category-bars";
import { TrendChart } from "@/components/superadmin/trend-chart";
import { InvoicesTable } from "@/components/superadmin/invoices-table";
import { MigrationNotice } from "@/components/superadmin/migration-notice";
import { Badge } from "@/components/ui/badge";
import {
  PAYMENT_METHOD_LABELS,
  PLAN_INTERVAL_LABELS,
  SUBSCRIPTION_STATUS_DOT,
  SUBSCRIPTION_STATUS_LABELS,
  formatPercent,
} from "@/lib/billing";
import { BOOKING_STATUS_DOT, BOOKING_STATUS_LABELS, BOOKING_STATUS_ORDER } from "@/lib/booking-status";
import {
  formatDateLocal,
  formatDurationMin,
  formatFullDateLocal,
  formatPhoneDisplay,
  formatPriceCents,
  formatTimeLocal,
  getStudioPublicUrl,
} from "@/lib/format";
import { utcToLocalDate } from "@/lib/availability";
import { cn } from "@/lib/utils";
import type { WhatsAppConnectionStatus } from "@/lib/types";

interface StudioDetailPageProps {
  params: Promise<{ id: string }>;
}

const WHATSAPP_LABELS: Record<WhatsAppConnectionStatus, string> = {
  conectado: "Conectado",
  conectando: "Aguardando leitura do QR",
  desconectado: "Desconectado",
  erro: "Com erro",
};

export async function generateMetadata({ params }: StudioDetailPageProps) {
  const { id } = await params;
  const detail = await getStudioDetail(id);
  return { title: detail ? `${detail.studio.name} — Timely Admin` : "Cliente — Timely Admin" };
}

/**
 * Ficha de um cliente da plataforma.
 *
 * Ordem das seções segue a ordem das perguntas que se fazem sobre um cliente:
 * ele paga (assinatura e faturas), ele usa (agenda, clientes, ocupação), e o
 * que está quebrado (WhatsApp, lembretes). O bloco de identificação fica no
 * topo porque é o que confirma que estamos olhando o estúdio certo.
 */
export default async function StudioDetailPage({ params }: StudioDetailPageProps) {
  const { id } = await params;

  const [detail, billingReady] = await Promise.all([getStudioDetail(id), isBillingSchemaReady()]);
  if (!detail) notFound();

  const billing = billingReady ? await getStudioBilling(id) : null;
  const { studio } = detail;
  const today = utcToLocalDate(new Date());
  const subscription = billing?.current;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Link
        href="/superadmin/studios"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar para clientes
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{studio.name}</h1>
            {detail.isAtRisk && <Badge variant="destructive">Sem agenda 14d+</Badge>}
            {billing && billing.overdueInvoices > 0 && (
              <Badge variant="destructive">
                {formatPriceCents(billing.overdueCents)} em atraso
              </Badge>
            )}
            {subscription && (
              <Badge variant="secondary">
                <span
                  className={cn("size-2 rounded-full", SUBSCRIPTION_STATUS_DOT[subscription.subscription.status])}
                  aria-hidden
                />
                {SUBSCRIPTION_STATUS_LABELS[subscription.subscription.status]}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            /{studio.slug} · cliente desde {formatFullDateLocal(new Date(studio.created_at))}
          </p>
        </div>
        <Link
          href={getStudioPublicUrl(studio.slug)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Abrir página pública <ExternalLink className="size-3.5" />
        </Link>
      </header>

      {!billingReady && (
        <MigrationNotice migration="0011_billing.sql" feature="A cobrança deste cliente" />
      )}

      {/* --- Identificação --- */}
      <section className="panel p-4">
        <p className="section-label mb-3">Cadastro</p>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Responsável" value={studio.owner_name ?? "não informado"} />
          <Field label="WhatsApp do estúdio" value={formatPhoneDisplay(studio.whatsapp)} />
          <Field
            label="Nascimento"
            value={
              studio.owner_birth_date
                ? formatFullDateLocal(new Date(`${studio.owner_birth_date}T12:00:00Z`))
                : "não informado"
            }
          />
          {/* CPF aparece mascarado de propósito: para conferir identidade
              contra um documento bastam os dígitos verificadores, e este
              painel é lido por quem não precisa do número inteiro. */}
          <Field label="CPF" value={maskCpf(studio.owner_cpf)} />
          <Field
            label="Aquisição"
            value={
              studio.acquired_at
                ? formatFullDateLocal(new Date(`${studio.acquired_at}T12:00:00Z`))
                : "não informada"
            }
          />
          <Field
            label="Primeiro agendamento"
            value={
              detail.firstBookingAt
                ? formatFullDateLocal(new Date(detail.firstBookingAt))
                : "nenhum ainda"
            }
          />
          <Field
            label="Última movimentação"
            value={
              detail.lastBookingAt
                ? `${formatFullDateLocal(new Date(detail.lastBookingAt))} (${detail.daysSinceLastBooking} dia${detail.daysSinceLastBooking === 1 ? "" : "s"})`
                : "nenhuma"
            }
          />
          <Field label="Cor da marca" value={studio.brand_color} />
        </dl>
      </section>

      {/* --- Assinatura e faturas --- */}
      {billing && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-foreground">Assinatura e faturamento</h2>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile
              label="Plano"
              value={subscription?.plan?.name ?? "sem assinatura"}
              sublabel={
                subscription
                  ? `${formatPriceCents(subscription.subscription.amount_cents)}${PLAN_INTERVAL_LABELS[subscription.interval]}`
                  : "nunca contratou"
              }
            />
            <KpiTile
              label="MRR deste cliente"
              value={
                subscription && subscription.subscription.status !== "trial"
                  ? formatPriceCents(subscription.monthlyCents)
                  : formatPriceCents(0)
              }
              sublabel={
                subscription?.subscription.status === "trial"
                  ? "em teste — ainda não conta como receita"
                  : subscription
                    ? `renova ${formatFullDateLocal(new Date(subscription.subscription.current_period_end))}`
                    : undefined
              }
            />
            <KpiTile
              label="Já pagou"
              value={formatPriceCents(billing.lifetimeCents)}
              sublabel={`${billing.paidInvoices} fatura${billing.paidInvoices === 1 ? "" : "s"} paga${billing.paidInvoices === 1 ? "" : "s"} · líquido ${formatPriceCents(billing.netLifetimeCents)}`}
            />
            <KpiTile
              label="Em atraso"
              value={formatPriceCents(billing.overdueCents)}
              sublabel={
                billing.averageDaysToPay !== null
                  ? billing.averageDaysToPay <= 0
                    ? `paga em média ${Math.abs(billing.averageDaysToPay)} dia(s) antes do vencimento`
                    : `paga em média ${billing.averageDaysToPay} dia(s) depois do vencimento`
                  : "sem histórico de pagamento"
              }
              tone={billing.overdueCents > 0 ? "warning" : "neutral"}
            />
          </div>

          <div className="panel p-4">
            <p className="section-label mb-3">Cobrança</p>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Field
                label="Início"
                value={
                  subscription
                    ? formatFullDateLocal(new Date(subscription.subscription.started_at))
                    : "—"
                }
              />
              <Field
                label="Fim do teste"
                value={
                  subscription?.subscription.trial_ends_at
                    ? formatFullDateLocal(new Date(subscription.subscription.trial_ends_at))
                    : "—"
                }
              />
              <Field
                label="Forma de pagamento"
                value={
                  subscription?.subscription.default_payment_method
                    ? PAYMENT_METHOD_LABELS[subscription.subscription.default_payment_method]
                    : billing.lastPaymentMethod
                      ? `${PAYMENT_METHOD_LABELS[billing.lastPaymentMethod]} (último uso)`
                      : "nenhuma cadastrada"
                }
              />
              <Field
                label="Gateway"
                value={subscription?.subscription.gateway ?? "não integrado"}
              />
              <Field
                label="Cancelamento agendado"
                value={subscription?.subscription.cancel_at_period_end ? "sim, no fim do ciclo" : "não"}
              />
              <Field
                label="A receber em aberto"
                value={formatPriceCents(billing.openCents)}
              />
              <Field
                label="Último pagamento"
                value={
                  billing.lastPaymentAt
                    ? formatFullDateLocal(new Date(billing.lastPaymentAt))
                    : "nenhum"
                }
              />
              <Field
                label="Assinaturas encerradas"
                value={String(billing.history.length)}
              />
            </dl>
          </div>

          <InvoicesTable
            rows={billing.invoices}
            showStudio={false}
            today={today}
            emptyLabel="Nenhuma fatura emitida para este cliente ainda."
          />
        </section>
      )}

      {/* --- Uso --- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Uso do produto</h2>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            label="Agendamentos"
            value={detail.totalBookings.toLocaleString("pt-BR")}
            sublabel={`${detail.bookings30d} em 30 dias · ${detail.bookings7d} em 7`}
          />
          <KpiTile
            label="Cancelamento"
            value={formatPercent(detail.cancellationRate)}
            sublabel={`${detail.bookingsByStatus.cancelado} cancelados no total`}
          />
          <KpiTile
            label="Volume atendido (30d)"
            value={formatPriceCents(detail.attendedVolume30dCents)}
            sublabel={`${detail.attended30d} atendimentos · ticket médio ${formatPriceCents(detail.averageTicketCents)}`}
            hint="Receita do estúdio, não da plataforma."
          />
          <KpiTile
            label="Ocupação (30d)"
            value={formatPercent(detail.occupancyRate30d, 0)}
            sublabel={`${Math.round(detail.bookedMinutes30d / 60)}h ocupadas de ${Math.round(detail.availableMinutes30d / 60)}h abertas`}
            hint="Estimativa: ignora folgas e bloqueios pontuais."
          />
          <KpiTile
            label="Clientes cadastrados"
            value={detail.clientsCount.toLocaleString("pt-BR")}
            sublabel={`+${detail.newClients30d} em 30 dias`}
          />
          <KpiTile
            label="Recorrência"
            value={formatPercent(detail.returnRate, 0)}
            sublabel={`${detail.returningClients} clientes com 2+ atendimentos`}
          />
          <KpiTile
            label="Serviços"
            value={String(detail.activeServicesCount)}
            sublabel={`${detail.archivedServicesCount} arquivados`}
          />
          <KpiTile
            label="Agenda semanal"
            value={`${Math.round(detail.weeklyOpenMinutes / 60)}h`}
            sublabel={`${detail.blocksNext30d} bloqueio(s) nos próximos 30 dias`}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <ChartCard
            title="Agendamentos por dia"
            subtitle="Últimos 30 dias neste estúdio"
            data={{
              columns: ["Dia", "Agendamentos"],
              rows: detail.bookingsTrend.map((point) => [point.date, String(point.count)]),
            }}
          >
            <TrendChart data={detail.bookingsTrend} color="var(--chart-1)" />
          </ChartCard>

          <ChartCard title="Situação dos agendamentos" subtitle="Todo o histórico do estúdio">
            <CategoryBars
              bars={BOOKING_STATUS_ORDER.map((status) => ({
                key: status,
                label: BOOKING_STATUS_LABELS[status],
                value: detail.bookingsByStatus[status],
                formatted: detail.bookingsByStatus[status].toLocaleString("pt-BR"),
                color:
                  status === "cancelado"
                    ? "var(--muted-foreground)"
                    : status === "finalizado"
                      ? "var(--wa)"
                      : status === "em_atendimento"
                        ? "var(--chart-2)"
                        : "var(--chart-1)",
              }))}
              emptyLabel="Nenhum agendamento registrado."
            />
          </ChartCard>
        </div>

        {detail.services.length > 0 && (
          <div className="panel overflow-hidden">
            <p className="section-label px-4 pt-4">Serviços</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-y border-border text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Serviço</th>
                    <th className="px-4 py-2 font-medium text-right">Preço</th>
                    <th className="px-4 py-2 font-medium text-right">Duração</th>
                    <th className="px-4 py-2 font-medium text-right">Agendamentos</th>
                    <th className="px-4 py-2 font-medium text-right">Atendidos</th>
                    <th className="px-4 py-2 font-medium text-right">Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {detail.services.map(({ service, bookings, attended, volumeCents }) => (
                    <tr key={service.id}>
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: service.color }}
                            aria-hidden
                          />
                          <span className="text-foreground">{service.name}</span>
                          {service.archived_at && (
                            <Badge variant="outline" className="ml-1">
                              arquivado
                            </Badge>
                          )}
                          {!service.active && !service.archived_at && (
                            <Badge variant="outline" className="ml-1">
                              inativo
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {formatPriceCents(service.price_cents)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {formatDurationMin(service.duration_min)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-foreground">{bookings}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {attended}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-foreground">
                        {formatPriceCents(volumeCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="panel p-4">
            <p className="section-label mb-3">Clientes mais frequentes</p>
            {detail.topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum atendimento registrado ainda.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {detail.topClients.map((client) => (
                  <li key={client.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{client.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPhoneDisplay(client.phone)}
                        {client.lastBookingAt &&
                          ` · último ${formatDateLocal(new Date(client.lastBookingAt))}`}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {client.bookings} {client.bookings === 1 ? "visita" : "visitas"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel p-4">
            <p className="section-label mb-3">Últimos agendamentos</p>
            {detail.recentBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum agendamento registrado ainda.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {detail.recentBookings.map((booking) => {
                  const start = new Date(booking.start_at);
                  return (
                    <li key={booking.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">{booking.client_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateLocal(start)} · {formatTimeLocal(start)}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          className={cn("size-2 rounded-full", BOOKING_STATUS_DOT[booking.status])}
                          aria-hidden
                        />
                        {BOOKING_STATUS_LABELS[booking.status]}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* --- Automação: o que costuma estar quebrado sem o dono saber --- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Automação</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="panel flex flex-col gap-1.5 p-4">
            <p className="section-label flex items-center gap-1.5">
              <MessageCircle className="size-3.5" /> WhatsApp
            </p>
            <p className="text-sm font-medium text-foreground">
              {detail.whatsapp ? WHATSAPP_LABELS[detail.whatsapp.status] : "Nunca conectou"}
            </p>
            <p className="text-xs text-muted-foreground">
              {detail.whatsapp?.connected_phone
                ? formatPhoneDisplay(detail.whatsapp.connected_phone)
                : "nenhum número vinculado"}
            </p>
            {detail.whatsapp?.last_error && (
              <p className="text-xs text-destructive">{detail.whatsapp.last_error}</p>
            )}
          </div>

          <div className="panel flex flex-col gap-1.5 p-4">
            <p className="section-label flex items-center gap-1.5">
              <BellRing className="size-3.5" /> Lembretes
            </p>
            <p className="text-sm font-medium text-foreground">
              {detail.reminders?.enabled ? "Ligados" : "Desligados"}
            </p>
            <p className="text-xs text-muted-foreground">
              {detail.reminders
                ? `${Math.round(detail.reminders.lead_time_minutes / 60)}h de antecedência`
                : "nunca configurados"}
            </p>
          </div>

          <div className="panel flex flex-col gap-1.5 p-4">
            <p className="section-label flex items-center gap-1.5">
              <CalendarClock className="size-3.5" /> Fila de mensagens
            </p>
            <p className="text-sm font-medium text-foreground">
              {detail.messagesSent30d} enviadas em 30 dias
            </p>
            <p className="text-xs text-muted-foreground">
              {detail.messagesPending} na fila · {detail.messagesFailed30d} falharam
            </p>
            {detail.lastMessageAt && (
              <p className="text-xs text-muted-foreground">
                última {formatFullDateLocal(new Date(detail.lastMessageAt))}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-foreground">{value}</dd>
    </div>
  );
}

/** Só os dígitos verificadores: suficiente para conferir, insuficiente para vazar. */
function maskCpf(cpf: string | null): string {
  if (!cpf) return "não informado";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return "cadastro inválido";
  return `•••.•••.•••-${digits.slice(-2)}`;
}
