import { formatDateLocal, formatTimeLocal } from "@/lib/format";

export function buildWhatsAppUrl(params: {
  whatsapp: string;
  serviceName: string;
  clientName: string;
  startAt: Date;
}): string {
  const { whatsapp, serviceName, clientName, startAt } = params;
  const text =
    `Olá! Agendei ${serviceName} para ${formatDateLocal(startAt)} às ${formatTimeLocal(startAt)}. ` +
    `Nome: ${clientName}.`;
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`;
}
