/* ─── Status Config (shared across agenda components) ─────── */
export const statusCfg: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  pending:         { label: "Pendente",          color: "#d97706", bg: "#fffbeb", border: "#fde68a", dot: "#f59e0b" },
  confirmed:       { label: "Confirmado",        color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", dot: "#3b82f6" },
  waiting:         { label: "Em Espera",         color: "#ea580c", bg: "#fff7ed", border: "#fed7aa", dot: "#f97316" },
  in_progress:     { label: "Em Atendimento",    color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", dot: "#06b6d4" },
  completed:       { label: "Concluído",         color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", dot: "#10b981" },
  payment_pending: { label: "Aguard. Pagamento", color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe", dot: "#a78bfa" },
  closed:          { label: "Pago ✅",           color: "#047857", bg: "#d1fae5", border: "#6ee7b7", dot: "#10b981" },
  cancelled:       { label: "Cancelado",         color: "#ef4444", bg: "#fef2f2", border: "#fecaca", dot: "#ef4444" },
  no_show:         { label: "Faltou",            color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb", dot: "#9ca3af" },
}
