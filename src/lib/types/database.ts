// Firebase Database Types for Agenda Online SaaS - Multi-Tenant

// ===================== SAAS CORE =====================

export interface Company {
  id: string
  name: string
  slug: string
  logo_url: string | null
  cover_image_url: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  document: string | null // CNPJ/CPF
  address: string | null
  instagram: string | null
  about_text: string | null
  primary_color: string | null
  owner_id: string
  owner_name: string
  owner_email: string
  plan_id: string | null
  subscription_status: SubscriptionStatus
  trial_ends_at: string | null
  payment_due_date: string | null
  is_blocked: boolean
  gallery_images: string[]
  youtube_videos: string[]
  authorized_admin_emails?: string[] // Co-admin emails that can login as business_owner
  created_at: string
  updated_at: string
}

export interface SaaSPlan {
  id: string
  name: string
  price: number
  billing_cycle: "monthly" | "yearly"
  max_professionals: number
  max_appointments_month: number
  features: string[]
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface SaaSSubscription {
  id: string
  company_id: string
  plan_id: string
  plan_name: string
  status: SubscriptionStatus
  current_period_start: string
  current_period_end: string
  payment_due_date: string | null
  last_payment_at: string | null
  created_at: string
  updated_at: string
}

export interface SaaSPayment {
  id: string
  company_id: string
  company_name: string
  subscription_id: string | null
  amount: number
  method: string
  status: "pending" | "paid" | "overdue" | "cancelled"
  paid_at: string | null
  due_date: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SaaSUser {
  id: string
  company_id: string
  firebase_uid: string
  name: string
  email: string
  phone: string | null
  role: "master_admin" | "business_owner" | "admin" | "manager" | "receptionist" | "professional" | "attendant" | "financial" | "partner" | "viewer"
  permissions: string[]
  is_active: boolean
  created_at?: string
  updated_at: string
}

export type SubscriptionStatus = "trial" | "active" | "pending" | "overdue" | "cancelled" | "blocked"

// ===================== TENANT DATA =====================

export interface Category {
  id: string
  company_id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  company_id: string
  category_id: string | null
  name: string
  description: string | null
  service_code: string | null
  price: number
  promotional_price: number | null
  price_type: "fixed" | "starting_at" | null
  product_average_cost: number | null
  professional_product_average_cost: number | null
  disposable_expenses: number | null
  establishment_operational_cost: number | null
  professional_operational_cost: number | null
  duration_minutes: number
  image_url: string | null
  featured: boolean
  is_active: boolean
  display_order: number
  // New professional fields
  standard_service_id?: string | null
  color_hex?: string | null
  hide_from_online_booking?: boolean
  promotion_start_date?: string | null
  promotion_end_date?: string | null
  promotion_notes?: string | null
  created_at: string
  updated_at: string
}

// ---- Employee sub-types ----

export interface EmployeeSocialLinks {
  instagram?: string | null
  facebook?: string | null
  tiktok?: string | null
  youtube?: string | null
  website?: string | null
  other?: string | null
}

export interface EmployeePermissions {
  canAccessDashboard?: boolean
  canViewSchedule?: boolean
  canCreateAppointments?: boolean
  canEditAppointments?: boolean
  canCancelAppointments?: boolean
  canViewClients?: boolean
  canEditClients?: boolean
  canViewFinancial?: boolean
  canManageInventory?: boolean // Estoque
  canReceiveNotifications?: boolean
  showOnPublicBooking?: boolean
}

export interface EmployeeScheduleDay {
  enabled: boolean
  start: string
  end: string
  lunchStart?: string | null
  lunchEnd?: string | null
  breakStart?: string | null
  breakEnd?: string | null
}

export interface EmployeeProfessionalService {
  serviceId: string
  enabled: boolean
  customDuration?: number | null
  customPrice?: number | null
  customCommission?: number | null
}

export interface EmployeeAdditionalInfo {
  address?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  professionalDocument?: string | null
  pixKey?: string | null
  bank?: string | null
  bankBranch?: string | null
  bankAccount?: string | null
  accountType?: string | null
  financialNotes?: string | null
  hireDate?: string | null
  employmentType?: string | null
}

export interface EmployeePartnerInfo {
  isPartner: boolean
  
  // DADOS DA EMPRESA / MEI
  partnerCompanyName?: string | null
  partnerTradeName?: string | null
  partnerCnpj?: string | null
  partnerMunicipalRegistration?: string | null
  partnerType?: string | null
  
  // CONTRATO / PARCERIA
  contractNumber?: string | null
  startDate?: string | null
  endDate?: string | null
  contractStatus?: string | null
  contractNotes?: string | null

  // REPASSE / PAGAMENTO
  transferPercent?: number | null
  transferMethod?: string | null
  paymentDay?: number | null
  transferType?: string | null
  
  pixKeyType?: string | null
  pixKey?: string | null
  bank?: string | null
  agency?: string | null
  account?: string | null
  accountType?: string | null
  accountHolderName?: string | null
  accountHolderDocument?: string | null

  // DOCUMENTOS (status tracking)
  hasMeiCertificate?: boolean | null
  hasSignedContract?: boolean | null
  hasPersonalDocument?: boolean | null
  hasBankProof?: boolean | null
  hasAddressProof?: boolean | null
  hasLicense?: boolean | null
}

export type EmployeeStatus = "active" | "inactive" | "blocked" | "vacation" | "away"
export type EmployeeGender = "female" | "male" | "not_informed" | "other"

export interface Employee {
  id: string
  company_id: string
  user_id: string | null
  name: string
  nickname?: string | null
  cpf?: string | null
  gender?: EmployeeGender | null
  birth_date?: string | null
  photo_url: string | null
  phone: string | null
  whatsapp?: string | null
  is_whatsapp?: boolean
  email: string | null
  social_links?: EmployeeSocialLinks | null
  specialty: string | null
  bio: string | null
  commission_percent: number
  status?: EmployeeStatus
  notes?: string | null
  calendar_color?: string | null
  permissions?: EmployeePermissions | null
  service_ids: string[]
  professional_services?: EmployeeProfessionalService[] | null
  workdays: number[]
  working_hours_start: string
  working_hours_end: string
  schedule_by_day?: Record<string, EmployeeScheduleDay> | null
  additional_info?: EmployeeAdditionalInfo | null
  partner_info?: EmployeePartnerInfo | null
  // Auth & Access fields
  auth_uid?: string | null
  google_email?: string | null
  access_enabled?: boolean
  role?: "owner" | "professional"
  invite?: EmployeeInvite | null
  has_schedule?: boolean
  // RBAC fields
  rbac_profile_id?: string | null
  rbac_permissions?: string[] | null
  rbac_profile_custom?: boolean
  rbac_updated_at?: string | null
  rbac_updated_by?: string | null
  is_active: boolean
  is_online?: boolean
  last_seen?: string | null
  created_at: string
  updated_at: string
}

export type EmployeeInviteStatus = "not_sent" | "sent" | "awaiting_login" | "active" | "expired" | "revoked"

export interface EmployeeInvite {
  token_hash: string
  status: EmployeeInviteStatus
  expires_at: string
  created_at: string
  sent_at?: string | null
  accepted_at?: string | null
  revoked_at?: string | null
  last_login_at?: string | null
}

export interface AdditionalService {
  service_id: string
  service_name: string
  price: number
  duration_minutes: number
  is_repeated?: boolean
  employee_id?: string | null
  employee_name?: string | null
}

export interface AppointmentLog {
  id: string
  appointment_id: string
  action_type: string
  action_label: string
  description: string
  user_id: string
  user_name: string
  user_role?: string
  created_at: string
}

export interface Appointment {
  id: string
  company_id: string
  service_id: string | null
  service_name: string
  service_price: number
  employee_id: string | null
  employee_name: string | null
  client_id: string | null
  client_name: string
  client_phone: string
  client_email: string | null
  appointment_date: string
  appointment_time: string
  end_time: string | null
  duration_minutes: number
  status: AppointmentStatus
  payment_method: PaymentMethod | null
  payment_status: PaymentStatus
  notes: string | null
  priority_color: string | null
  label_ids: string[]
  additional_services?: AdditionalService[]
  is_shared_service?: boolean | null
  shared_group_id?: string | null
  service_total_value?: number | null
  professional_service_value?: number | null
  type?: "appointment" | "absence" | "free" | "block"
  source?: string
  created_at: string
  updated_at: string
  created_by_user_id?: string
  created_by_name?: string
  updated_by_user_id?: string
  updated_by_name?: string
  last_action_by_user_id?: string
  last_action_by_name?: string
  last_action_type?: string
}

export type ClientGender = "masculino" | "feminino" | "outro" | "nao_informado"
export type ClientMaritalStatus = "solteiro" | "casado" | "divorciado" | "viuvo" | "outro"
export type ClientReferralSource = "instagram" | "facebook" | "google" | "indicacao" | "passando_pela_rua" | "outro"

export interface ClientAddress {
  cep?: string
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
}

export interface Client {
  id: string
  company_id: string
  // Dados pessoais
  name: string
  nickname?: string | null
  cpf?: string | null
  rg?: string | null
  birth_date?: string | null
  gender?: ClientGender | null
  marital_status?: ClientMaritalStatus | null
  // Contato
  phone: string
  whatsapp?: string | null
  is_whatsapp?: boolean
  email: string | null
  // Endereço
  address?: ClientAddress | null
  // Informações extras
  notes: string | null
  photo_url?: string | null
  instagram?: string | null
  referral_source?: ClientReferralSource | null
  referred_by?: string | null
  is_vip?: boolean
  // Controle
  total_spent: number
  credit_amount: number
  debt_amount: number
  status: ClientStatus
  appointment_count: number
  last_visit: string | null
  online_booking_blocked?: boolean
  created_at: string
  updated_at: string
}

export interface FinancialEntry {
  id: string
  company_id: string
  cash_register_id?: string | null
  created_by_user_id?: string | null
  created_by_name?: string | null
  type: "income" | "expense"
  category: string
  description: string
  amount: number
  payment_method: PaymentMethod
  reference_id: string | null
  reference_type: string | null
  date: string
  is_refunded?: boolean
  refund_notes?: string | null
  paid_amount?: number
  notes?: string | null
  client_name?: string | null
  client_phone?: string | null
  service_name?: string | null
  discount?: number | null
  employee_id?: string | null
  employee_name?: string | null
  payment_status?: string | null
  created_at: string
  updated_at: string
}

export type ClientTransactionType = "credit" | "debit" | "use_credit"
export type ClientTransactionStatus = "active" | "used" | "paid" | "partial"

export interface ClientTransaction {
  id: string
  company_id: string
  client_id: string
  client_name: string
  type: ClientTransactionType
  amount: number
  remaining_amount: number
  status: ClientTransactionStatus
  origin: string
  notes: string | null
  due_date: string | null
  created_by_id: string
  created_by_name: string
  created_at: string
  updated_at: string
}

export interface CashRegister {
  id: string
  company_id: string
  opened_by_user_id?: string | null
  opened_by_name?: string | null
  professional_id?: string | null
  date: string
  opening_amount: number
  closing_amount: number | null
  expected_amount: number | null
  difference: number | null
  status: "open" | "closed"
  notes: string | null
  opened_at: string
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface ProfessionalPayment {
  id: string
  company_id: string
  employee_id: string
  employee_name: string
  period_start: string
  period_end: string
  total_services: number
  total_revenue: number
  commission_percent: number
  commission_amount: number
  status: "pending" | "paid"
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface Commission {
  id: string
  company_id: string
  appointment_id: string
  service_id: string | null
  professional_id: string
  client_id: string | null
  payment_id: string | null
  cash_register_id: string | null
  service_name_snapshot: string
  professional_name_snapshot: string
  client_name_snapshot: string
  service_amount: number
  paid_amount: number
  commission_percentage: number
  commission_amount: number
  commission_calculated_amount?: number
  commission_adjusted_amount?: number
  commission_final_amount?: number
  commission_adjustment_reason?: string | null
  commission_adjusted_by_user_id?: string | null
  commission_adjusted_at?: string | null
  commission_release_date?: string | null
  status: "pending" | "paid" | "cancelled"
  performed_at: string
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  company_id: string
  appointment_id: string | null
  client_name: string
  client_phone: string
  service_name: string
  amount: number
  payment_method: PaymentMethod
  cnpj: string | null
  company_name: string | null
  invoice_number: string
  status: "draft" | "issued" | "cancelled"
  issued_at: string | null
  created_at: string
  updated_at: string
}

export interface UserRole {
  id: string
  company_id: string
  user_email: string
  user_name: string
  role: Role
  permissions: Permission[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BusinessSettings {
  id: string
  company_id: string
  business_name: string
  whatsapp: string
  phone: string | null
  email: string | null
  address: string | null
  instagram: string | null
  logo_url: string | null
  primary_color: string | null
  off_day_color?: string | null
  cnpj: string | null
  company_legal_name: string | null
  booking_rules: BookingRules | null
  notification_settings: NotificationSettings | null
  created_at: string
  updated_at: string
}

export interface BookingRules {
  max_appointments_per_day: number
  min_advance_hours: number
  max_advance_days: number
  allow_cancellation: boolean
  cancellation_deadline_hours: number
  auto_confirm: boolean
  break_minutes: number
}

export interface NotificationSettings {
  appointment_created: boolean
  appointment_confirmed: boolean
  appointment_cancelled: boolean
  payment_overdue: boolean
  whatsapp_enabled: boolean
  email_enabled: boolean
}

export interface BusinessHour {
  id: string
  company_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
  created_at: string
}

export interface BlockedDate {
  id: string
  company_id: string
  date: string
  reason: string | null
  created_at: string
}

export interface AppointmentLabel {
  id: string
  company_id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  company_id: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  reference_id: string | null
  created_at: string
}

// ===================== ENUMS =====================

export type AppointmentStatus = "pending" | "confirmed" | "waiting" | "in_progress" | "completed" | "payment_pending" | "closed" | "cancelled" | "no_show"
export type PaymentMethod = "cash" | "pix" | "credit_card" | "debit_card"
export type PaymentStatus = "pending" | "paid" | "partial" | "refunded"
export type ClientStatus = "active" | "debtor" | "inactive"
export type Role = "master_admin" | "business_owner" | "manager" | "professional" | "client"
export type NotificationType = "appointment_created" | "appointment_confirmed" | "appointment_cancelled" | "payment_overdue" | "subscription_expiring" | "trial_ending" | "new_client"

export type Permission =
  | "view_dashboard"
  | "view_appointments" | "edit_appointments" | "delete_appointments"
  | "view_services" | "edit_services" | "delete_services"
  | "view_professionals" | "edit_professionals" | "delete_professionals"
  | "view_clients" | "edit_clients" | "delete_clients"
  | "view_financial" | "edit_financial" | "delete_financial"
  | "view_cashier" | "edit_cashier"
  | "view_reports"
  | "view_invoices" | "edit_invoices"
  | "view_settings" | "edit_settings"
  | "manage_permissions"

export type ServiceWithCategory = Service & {
  category: Category | null
}

export interface CustomRBACProfile {
  id: string
  company_id: string
  name: string
  description: string
  permissions: string[]
  is_system: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

// ===================== STOCK / INVENTORY =====================

export interface Product {
  id: string
  company_id: string
  name: string
  unit: string
  cost_price: number
  sell_price: number | null
  stock_quantity: number
  min_stock: number | null
  supplier?: string | null
  manufacturer?: string | null
  category?: string | null
  sku?: string | null
  barcode?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ServiceProduct {
  id: string
  company_id: string
  service_id: string
  product_id: string
  product_name_snapshot: string
  quantity: number
  unit: string
  add_to_total_mode: "none" | "add_cost" | "add_price"
  cost_snapshot: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InventoryMovement {
  id: string
  company_id: string
  product_id: string
  appointment_id: string | null
  service_id: string | null
  quantity: number
  unit: string
  type: "in" | "out" | "adjustment"
  reason: string
  created_by_id: string | null
  created_by_name: string | null
  created_at: string
}
