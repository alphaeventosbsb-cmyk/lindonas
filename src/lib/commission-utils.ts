export function isCommissionableAppointment(status?: string | null): boolean {
  if (!status) return false;
  
  const normalizedStatus = status.trim().toLowerCase();

  const commissionableStatuses = [
    "completed",
    "finished",
    "concluido",
    "finalizado",
    "paid",
    "pago",
    "closed"
  ];

  return commissionableStatuses.includes(normalizedStatus);
}

export function isCancelledOrNoShowStatus(status?: string | null): boolean {
  if (!status) return false;
  
  const normalizedStatus = status.trim().toLowerCase();

  const cancelledStatuses = [
    "cancelado",
    "canceled",
    "cancelled",
    "faltou",
    "no_show",
    "missed",
    "ausente"
  ];

  return cancelledStatuses.includes(normalizedStatus);
}
