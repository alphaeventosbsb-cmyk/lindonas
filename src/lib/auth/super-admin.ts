export const SUPER_ADMIN_EMAILS = [
  "alphaeventos.bsb@gmail.com",
  "alphaeventosbsb@gmail.com",
  "carbeto34@gmail.com",
] as const

export function normalizeAuthEmail(email?: string | null): string {
  return (email || "").trim().toLowerCase()
}

export function isSuperAdmin(email?: string | null): boolean {
  const normalized = normalizeAuthEmail(email)
  return normalized.length > 0 && SUPER_ADMIN_EMAILS.includes(normalized as typeof SUPER_ADMIN_EMAILS[number])
}
