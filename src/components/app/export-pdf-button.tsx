"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMonthAgendaAction } from "@/app/app/(dashboard)/pdf-actions";
import { formatFullDateLocal, formatTimeLocal } from "@/lib/format";
import { BOOKING_STATUS_LABELS } from "@/lib/booking-status";
import type { Booking, BookingStatus, Service } from "@/lib/types";

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function buildPdf(studioName: string, subtitle: string, rows: string[][]): jsPDF {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(studioName, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(subtitle, 14, 25);
  autoTable(doc, {
    startY: 30,
    head: [["Horário", "Cliente", "Telefone", "Serviço", "Status"]],
    body: rows,
    headStyles: { fillColor: [124, 58, 237] },
    styles: { fontSize: 9 },
  });
  return doc;
}

export function ExportPdfButton({
  studioName,
  date,
  bookings,
  serviceById,
}: {
  studioName: string;
  date: string;
  bookings: Booking[];
  serviceById: Map<string, Service>;
}) {
  const [loadingMonth, setLoadingMonth] = useState(false);

  function exportDay() {
    if (bookings.length === 0) {
      toast.info("Nenhum agendamento para exportar neste dia.");
      return;
    }
    const rows = bookings.map((b) => [
      `${formatTimeLocal(new Date(b.start_at))}–${formatTimeLocal(new Date(b.end_at))}`,
      b.client_name,
      b.client_phone,
      serviceById.get(b.service_id)?.name ?? "—",
      BOOKING_STATUS_LABELS[b.status],
    ]);
    const doc = buildPdf(
      studioName,
      `Agenda do dia — ${formatFullDateLocal(new Date(`${date}T12:00:00`))}`,
      rows
    );
    doc.save(`agenda-${date}.pdf`);
  }

  async function exportMonth() {
    setLoadingMonth(true);
    try {
      const [year, month] = date.split("-").map(Number);
      const data = await getMonthAgendaAction(year, month);
      if (data.rows.length === 0) {
        toast.info("Nenhum agendamento para exportar neste mês.");
        return;
      }
      const rows = data.rows.map((r) => [
        `${formatFullDateLocal(new Date(r.startAt))} ${formatTimeLocal(new Date(r.startAt))}`,
        r.clientName,
        r.clientPhone,
        r.serviceName,
        BOOKING_STATUS_LABELS[r.status as BookingStatus],
      ]);
      const doc = buildPdf(data.studioName, `Agenda de ${MONTH_NAMES[month - 1]} de ${year}`, rows);
      doc.save(`agenda-${year}-${String(month).padStart(2, "0")}.pdf`);
    } catch {
      toast.error("Não foi possível gerar o PDF do mês.");
    } finally {
      setLoadingMonth(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
        <FileDown className="size-4" />
        Exportar PDF
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportDay}>Agenda do dia</DropdownMenuItem>
        <DropdownMenuItem onClick={exportMonth} disabled={loadingMonth}>
          {loadingMonth ? "Gerando..." : "Agenda do mês"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
