"use client"

import { useEffect, useState } from "react"
import { fetchCollection, createDocument, updateDocument, deleteDocument } from "@/lib/firebase/client-utils"
import { uploadToCloudinary } from "@/lib/cloudinary"
import type { Client, Appointment } from "@/lib/types/database"
import { formatCurrency, formatPhone, formatCPF } from "@/lib/utils"
import { Loader2, Plus, Pencil, Trash2, Search, UserCheck, AlertTriangle, Phone, Mail, DollarSign, Star, MapPin, LayoutGrid, List } from "lucide-react"
import { ExpandableImage } from "@/components/ui/expandable-image"
import { toast } from "sonner"
import { useTenant } from "@/lib/auth/tenant-context"
import { ClientFormModal } from "@/components/admin/client-form-modal"
import { useConfirm } from "@/components/ui/confirm-modal"
import { normalizeSearchText } from "@/lib/search"
import { usePermission } from "@/lib/rbac/usePermission"
import { PermissionGate } from "@/components/ui/permission-gate"
import { maskCPF, maskPhone, maskEmail } from "@/lib/rbac/rbac-utils"
import { createHistoryEvent } from "@/lib/firebase/history-service"
import { ExportButtons } from "@/components/ui/export-buttons"
import { type ColumnDef, formatDateForExport } from "@/lib/export-utils"

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const { isProfessional, saasUser } = useTenant()
  const { can } = usePermission()
  const canEdit = can("clients.edit")
  const canCreate = can("clients.create")
  const canDelete = can("clients.delete")
  const canViewEmail = can("security.email.view")
  const canViewPhone = can("security.phone.view")
  const canViewCPF = can("security.cpf.view")
  const [viewMode, setViewMode] = useState<"list" | "cards">("list")
  const { ConfirmationDialog, confirm } = useConfirm()

  const load = async () => {
    setLoading(true)
    const [c, a] = await Promise.all([
      fetchCollection<Client>("clients", "name"),
      fetchCollection<Appointment>("appointments"),
    ])
    setClients(c)
    setAppointments(a)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setShowForm(true) }
  const openEdit = (c: Client) => { setEditing(c); setShowForm(true) }

  const handleSave = async (data: any, photoFile: File | null, oldPhotoUrl: string | null) => {
    if (!canEdit) { toast.error('Sem permissão'); return }
    try {
      let photoUrl = data.photo_url || editing?.photo_url || null

      if (photoFile) {
        photoUrl = await uploadToCloudinary(photoFile, "salao/clientes")
      }

      const saveData = { ...data, photo_url: photoUrl }

      if (editing) {
        await updateDocument("clients", editing.id, saveData)
        
        if (!!editing.online_booking_blocked !== !!saveData.online_booking_blocked) {
          const actionType = saveData.online_booking_blocked ? "CLIENT_ONLINE_BOOKING_BLOCKED" : "CLIENT_ONLINE_BOOKING_UNBLOCKED"
          const actionTitle = saveData.online_booking_blocked ? "Agendamento Online Bloqueado" : "Agendamento Online Desbloqueado"
          const actionDesc = saveData.online_booking_blocked 
            ? "O cliente foi bloqueado e não poderá fazer agendamentos pela página pública." 
            : "O bloqueio foi removido e o cliente pode voltar a agendar online."
            
          await createHistoryEvent({
            client_id: editing.id,
            client_name: editing.name,
            action_type: actionType,
            action_title: actionTitle,
            action_description: actionDesc,
            performed_by_user_id: saasUser?.id || "system",
            performed_by_name: saasUser?.name || "Sistema",
            performed_by_email: saasUser?.email || null,
            performed_by_role: saasUser?.role || null
          })
        }

        toast.success("Cliente atualizado!")
      } else {
        await createDocument("clients", saveData)
        toast.success("Cliente cadastrado!")
      }
      setShowForm(false)
      load()
    } catch (err) {
      console.error("Erro ao salvar cliente:", err)
      toast.error(err instanceof Error ? err.message : "Erro ao salvar cliente")
      throw err
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!canEdit) { toast.error('Sem permissão'); return }
    const confirmed = await confirm({
      title: "Excluir cliente",
      message: `Tem certeza que deseja excluir este cliente?\n\nCliente: ${name}\n\nEssa ação não poderá ser desfeita.`,
      confirmText: "Excluir cliente",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return
    try {
      await deleteDocument("clients", id)
      toast.success("Cliente excluído")
      load()
    } catch { toast.error("Erro ao excluir cliente") }
  }

  const getClientAppointments = (clientName: string) => {
    return appointments.filter(a => a.client_name.toLowerCase() === clientName.toLowerCase())
  }

  // Advanced search: name, nickname, cpf, phone, whatsapp, email
  const onlyDigits = (s: string) => s.replace(/\D/g, "")
  const filtered = clients.filter(c => {
    const q = normalizeSearchText(search)
    const qDigits = onlyDigits(search)
    if (q) {
      const matchName = normalizeSearchText(c.name).includes(q)
      const matchNick = normalizeSearchText(c.nickname).includes(q)
      const matchEmail = normalizeSearchText(c.email).includes(q)
      const matchPhone = qDigits.length >= 2 && onlyDigits(c.phone || "").includes(qDigits)
      const matchWhatsapp = qDigits.length >= 2 && c.whatsapp && onlyDigits(c.whatsapp).includes(qDigits)
      const matchCpf = qDigits.length >= 3 && c.cpf && c.cpf.includes(qDigits)
      const matchInstagram = normalizeSearchText(c.instagram).includes(q)
      if (!matchName && !matchNick && !matchEmail && !matchPhone && !matchWhatsapp && !matchCpf && !matchInstagram) return false
    }
    if (statusFilter === "vip") return c.is_vip === true
    if (statusFilter !== "all" && c.status !== statusFilter) return false
    return true
  })

  const totalDebt = clients.reduce((sum, c) => sum + (c.debt_amount || 0), 0)
  const debtors = clients.filter(c => c.status === "debtor").length
  const vips = clients.filter(c => c.is_vip).length

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#7c5cfc]" /></div>

  const exportColumns: ColumnDef<Client>[] = [
    { header: "Nome", key: "name" },
    { header: "Telefone", key: "phone" },
    { header: "Email", key: "email" },
    { header: "CPF", key: "cpf", format: (v) => v || "—" },
    { header: "Nascimento", key: "birth_date", format: formatDateForExport },
    { header: "Status", key: "status", format: (v) => v === "debtor" ? "Devedor" : v === "active" ? "Ativo" : "Inativo" },
    { header: "Data Cadastro", key: "created_at", format: formatDateForExport },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
        {[
          { label: "Total", value: clients.length, icon: UserCheck, gradient: "linear-gradient(135deg, #7c5cfc, #a78bfa)", shadow: "rgba(124,92,252,0.25)" },
          { label: "Ativos", value: clients.filter(c => c.status === "active").length, icon: UserCheck, gradient: "linear-gradient(135deg, #22c997, #5ee0b8)", shadow: "rgba(34,201,151,0.25)" },
          { label: "VIP", value: vips, icon: Star, gradient: "linear-gradient(135deg, #ffb547, #ffd08a)", shadow: "rgba(255,181,71,0.25)" },
          { label: "Devedores", value: debtors, icon: AlertTriangle, gradient: "linear-gradient(135deg, #f25c5c, #f78888)", shadow: "rgba(242,92,92,0.25)" },
          { label: "Dívida Total", value: formatCurrency(totalDebt), icon: DollarSign, gradient: "linear-gradient(135deg, #ea580c, #f97316)", shadow: "rgba(234,88,12,0.25)" },
        ].map((stat, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: '1rem', padding: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
              <div style={{ width: '2rem', height: '2rem', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: stat.gradient, boxShadow: `0 3px 10px ${stat.shadow}` }}>
                <stat.icon style={{ width: '1rem', height: '1rem', color: '#fff' }} />
              </div>
              <span style={{ fontSize: '0.6875rem', color: '#6b7280', fontWeight: 600 }}>{stat.label}</span>
            </div>
            <p style={{ fontSize: '1.375rem', fontWeight: 800, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + Add */}
      <div style={{ background: '#fff', borderRadius: '1rem', padding: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#9ca3af' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '0.75rem 1rem', paddingLeft: '2.5rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#1e1e2d', fontSize: '0.875rem', fontWeight: 500, outline: 'none' }}
            placeholder="Buscar: nome, CPF, telefone, email, Instagram..." />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#1e1e2d', fontSize: '0.875rem', fontWeight: 500, outline: 'none', cursor: 'pointer', minWidth: '130px' }}>
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="debtor">Devedores</option>
          <option value="inactive">Inativos</option>
          <option value="vip">VIP ⭐</option>
        </select>
        <PermissionGate permission="clients.create">
          <button onClick={openNew}
            style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', boxShadow: '0 4px 14px rgba(124,92,252,0.3)', whiteSpace: 'nowrap' }}>
            <Plus style={{ width: '1rem', height: '1rem' }} /> Novo Cliente
          </button>
        </PermissionGate>
        <ExportButtons
          data={filtered}
          columns={exportColumns}
          fileName={`clientes-${new Date().toISOString().split('T')[0]}`}
          title="Relatório de Clientes"
          importModule="clientes"
        />
        <div style={{ display: 'flex', gap: '0.375rem', background: '#f8fafc', padding: '0.25rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginLeft: 'auto' }}>
          <button 
            onClick={() => setViewMode("cards")}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
              border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.15s',
              background: viewMode === "cards" ? '#fff' : 'transparent',
              color: viewMode === "cards" ? '#7c5cfc' : '#64748b',
              boxShadow: viewMode === "cards" ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <LayoutGrid style={{ width: '14px', height: '14px' }} /> Cards
          </button>
          <button 
            onClick={() => setViewMode("list")}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
              border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.15s',
              background: viewMode === "list" ? '#fff' : 'transparent',
              color: viewMode === "list" ? '#7c5cfc' : '#64748b',
              boxShadow: viewMode === "list" ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <List style={{ width: '14px', height: '14px' }} /> Lista
          </button>
        </div>
      </div>

      {/* Client List */}
      {viewMode === "list" ? (
        <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e8ecf4', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ minWidth: '900px' }}>
            {/* Header */}
            <div style={{ display: 'flex', padding: '0.625rem 1.25rem', gap: '0.75rem', alignItems: 'center', background: '#fafbfc', borderBottom: '1px solid #f1f3f9' }}>
              <span style={{ width: '2.75rem', flexShrink: 0 }} /> {/* Avatar Spacer */}
              <span style={{ flex: 2, fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cliente</span>
              <span style={{ flex: 1.5, fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contato / Local</span>
              <span style={{ width: '5rem', fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', flexShrink: 0 }}>Status</span>
              <span style={{ width: '6rem', fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', flexShrink: 0 }}>Visitas</span>
              <span style={{ width: '6rem', fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right', flexShrink: 0 }}>Gasto Total</span>
              <span style={{ width: '6rem', fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right', flexShrink: 0 }}>Saldos</span>
              <span style={{ width: '4.5rem', fontSize: '0.5625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', flexShrink: 0 }}>Ações</span>
            </div>

            {filtered.length > 0 ? filtered.map((client) => {
              const clientApts = getClientAppointments(client.name)
              const completedApts = clientApts.filter(a => a.status === "completed" || a.status === "closed")
              const totalSpent = completedApts.reduce((s, a) => s + (a.service_price || 0), 0)
              const sortedApts = [...completedApts].sort((a,b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime())
              const lastAptDate = sortedApts.length > 0 ? sortedApts[0].appointment_date.split('-').reverse().join('/') : '—'

              return (
                <div key={client.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1.25rem',
                    borderBottom: '1px solid #f5f5fa', transition: 'all 0.15s',
                    background: client.status === "debtor" ? '#fffafa' : '#fff'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = client.status === "debtor" ? '#fef2f2' : '#faf8ff'; e.currentTarget.style.transform = 'translateX(2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = client.status === "debtor" ? '#fffafa' : '#fff'; e.currentTarget.style.transform = 'none' }}
                >
                  {/* Avatar */}
                  {client.photo_url ? (
                    <ExpandableImage src={client.photo_url} alt={client.name} style={{
                      width: '2.75rem', height: '2.75rem', borderRadius: '0.625rem', objectFit: 'cover', flexShrink: 0,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)', border: client.is_vip ? '2px solid #ffb547' : 'none'
                    }} />
                  ) : (
                    <div style={{
                      width: '2.75rem', height: '2.75rem', borderRadius: '0.625rem', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: client.status === "debtor" ? 'linear-gradient(135deg, #f25c5c, #f78888)' : 'linear-gradient(135deg, #7c5cfc, #a78bfa)',
                      color: '#fff', fontSize: '1rem', fontWeight: 800,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)', border: client.is_vip ? '2px solid #ffb547' : 'none'
                    }}>
                      {client.name.charAt(0)}
                    </div>
                  )}

                  {/* Name & Email */}
                  <div style={{ flex: 2, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e1e2d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      {client.name}
                      {client.is_vip && <span title="Cliente VIP"><Star style={{ width: '12px', height: '12px', color: '#d97706', fill: '#d97706' }} /></span>}
                    </p>
                    <p style={{ fontSize: '0.6875rem', color: '#8b8fa7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {canViewEmail ? (client.email || <span style={{ color: '#d1d5db' }}>Sem e-mail</span>) : maskEmail(client.email)}
                      {client.nickname && <span style={{ fontWeight: 500, color: '#6b7280', marginLeft: '0.375rem' }}>({client.nickname})</span>}
                    </p>
                  </div>

                  {/* Contact & Location */}
                  <div style={{ flex: 1.5, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                    <p style={{ fontSize: '0.75rem', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Phone style={{ width: '10px', height: '10px', color: '#9ca3af' }} />
                      {canViewPhone ? (client.phone ? formatPhone(client.phone) : '—') : maskPhone(client.phone)}
                    </p>
                    <p style={{ fontSize: '0.6875rem', color: '#8b8fa7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <MapPin style={{ width: '10px', height: '10px', color: '#d1d5db' }} />
                      {client.address?.city ? `${client.address.city}${client.address.state ? `/${client.address.state}` : ''}` : '—'}
                      {client.cpf && <span style={{ marginLeft: '0.25rem', color: '#9ca3af' }}>| CPF: {canViewCPF ? formatCPF(client.cpf) : maskCPF(client.cpf)}</span>}
                    </p>
                  </div>

                  {/* Status */}
                  <div style={{ width: '5rem', justifyContent: 'center', display: 'flex', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '0.5625rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '999px',
                      background: client.status === "debtor" ? '#fef2f2' : client.status === "active" ? '#ecfdf5' : '#f3f4f6',
                      color: client.status === "debtor" ? '#ef4444' : client.status === "active" ? '#059669' : '#6b7280',
                      border: `1px solid ${client.status === "debtor" ? '#fecaca' : client.status === "active" ? '#a7f3d0' : '#e5e7eb'}`,
                    }}>
                      {client.status === "debtor" ? "Devedor" : client.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  {/* Visitas & Ultimo Atendimento */}
                  <div style={{ width: '6rem', textAlign: 'center', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#374151' }}>{clientApts.length}</span>
                    <span style={{ fontSize: '0.5625rem', color: '#8b8fa7' }}>Último: {lastAptDate}</span>
                  </div>

                  {/* Gasto Total */}
                  <div style={{ width: '6rem', textAlign: 'right', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#059669' }}>{formatCurrency(totalSpent)}</span>
                  </div>

                  {/* Saldos (Credito / Debito) */}
                  <div style={{ width: '6rem', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.125rem', flexShrink: 0 }}>
                    {client.debt_amount > 0 && (
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#ef4444' }}>
                        -{formatCurrency(client.debt_amount)}
                      </span>
                    )}
                    {client.credit_amount > 0 && (
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#16a34a' }}>
                        +{formatCurrency(client.credit_amount)}
                      </span>
                    )}
                    {(!client.debt_amount && !client.credit_amount) && (
                      <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#d1d5db' }}>—</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ width: '4.5rem', display: 'flex', justifyContent: 'center', gap: '0.375rem', flexShrink: 0 }}>
                    <PermissionGate permission="clients.edit">
                      <button onClick={e => { e.stopPropagation(); openEdit(client) }} title="Editar Cliente" style={{
                        padding: '0.375rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', background: '#fff',
                        cursor: 'pointer', display: 'flex', transition: 'all 0.15s',
                      }} onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <Pencil style={{ width: '13px', height: '13px', color: '#7c5cfc' }} />
                      </button>
                    </PermissionGate>
                    <PermissionGate permission="clients.delete">
                      <button onClick={e => { e.stopPropagation(); handleDelete(client.id, client.name) }} title="Excluir Cliente" style={{
                        padding: '0.375rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', background: '#fff',
                        cursor: 'pointer', display: 'flex', transition: 'all 0.15s',
                      }} onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <Trash2 style={{ width: '13px', height: '13px', color: '#ef4444' }} />
                      </button>
                    </PermissionGate>
                  </div>
                </div>
              )
            }) : (
              <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <UserCheck style={{ width: '1.75rem', height: '1.75rem', color: '#9ca3af' }} />
                </div>
                <p style={{ color: '#1e1e2d', fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.25rem' }}>Nenhum cliente encontrado</p>
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Cadastre seu primeiro cliente ou altere os filtros</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {filtered.length > 0 ? filtered.map((client) => {
            const clientApts = getClientAppointments(client.name)
            const completedApts = clientApts.filter(a => a.status === "completed" || a.status === "closed")
            const totalSpent = completedApts.reduce((s, a) => s + (a.service_price || 0), 0)
            const sortedApts = [...completedApts].sort((a,b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime())
            const lastAptDate = sortedApts.length > 0 ? sortedApts[0].appointment_date.split('-').reverse().join('/') : '—'

            return (
              <div key={client.id}
                style={{
                  background: '#fff', borderRadius: '1rem', border: '1px solid #e8ecf4', overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.15s',
                  position: 'relative'
                }}
                onMouseEnter={ev => { ev.currentTarget.style.transform = 'translateY(-2px)'; ev.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)' }}
                onMouseLeave={ev => { ev.currentTarget.style.transform = 'none'; ev.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <div style={{ height: '4px', background: client.status === "debtor" ? 'linear-gradient(135deg, #f25c5c, #f78888)' : 'linear-gradient(135deg, #7c5cfc, #a78bfa)' }} />
                <div style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    {client.photo_url ? (
                      <ExpandableImage src={client.photo_url} alt={client.name} style={{ width: '3.5rem', height: '3.5rem', borderRadius: '0.75rem', objectFit: 'cover', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.1)', border: client.is_vip ? '2px solid #ffb547' : 'none' }} />
                    ) : (
                      <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '0.75rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: client.status === "debtor" ? 'linear-gradient(135deg, #f25c5c, #f78888)' : 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff', fontSize: '1.25rem', fontWeight: 800, boxShadow: '0 2px 6px rgba(0,0,0,0.1)', border: client.is_vip ? '2px solid #ffb547' : 'none' }}>
                        {client.name.charAt(0)}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, color: '#1e1e2d', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        {client.name}
                        {client.is_vip && <span title="Cliente VIP"><Star style={{ width: '12px', height: '12px', color: '#d97706', fill: '#d97706' }} /></span>}
                      </p>
                        {canViewEmail ? (client.email || "Sem e-mail") : maskEmail(client.email)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', padding: '0.75rem', background: '#fafbfc', borderRadius: '0.75rem', border: '1px solid #f1f3f9' }}>
                    <p style={{ fontSize: '0.75rem', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Phone style={{ width: '12px', height: '12px', color: '#9ca3af' }} />
                      <span style={{ fontWeight: 500 }}>{canViewPhone ? (client.phone ? formatPhone(client.phone) : '—') : maskPhone(client.phone)}</span>
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <MapPin style={{ width: '12px', height: '12px', color: '#d1d5db' }} />
                      <span style={{ fontWeight: 500 }}>{client.address?.city ? `${client.address.city}${client.address.state ? `/${client.address.state}` : ''}` : '—'}</span>
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase' }}>Visitas ({clientApts.length})</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e1e2d' }}>Último: {lastAptDate}</span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.625rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase' }}>Gasto Total</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#059669' }}>{formatCurrency(totalSpent)}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderTop: '1px dashed #e2e8f0' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase' }}>Status / Saldo</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {client.debt_amount > 0 && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444' }}>-{formatCurrency(client.debt_amount)}</span>}
                      {client.credit_amount > 0 && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a' }}>+{formatCurrency(client.credit_amount)}</span>}
                      <span style={{
                        fontSize: '0.625rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '999px',
                        background: client.status === "debtor" ? '#fef2f2' : client.status === "active" ? '#ecfdf5' : '#f3f4f6',
                        color: client.status === "debtor" ? '#ef4444' : client.status === "active" ? '#059669' : '#6b7280',
                        border: `1px solid ${client.status === "debtor" ? '#fecaca' : client.status === "active" ? '#a7f3d0' : '#e5e7eb'}`,
                      }}>
                        {client.status === "debtor" ? "Devedor" : client.status === "active" ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid #f1f3f9', paddingTop: '1rem' }}>
                      <PermissionGate permission="clients.edit">
                        <button
                          onClick={(ev) => { ev.stopPropagation(); openEdit(client) }}
                          style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', background: '#f5f3ff', color: '#7c5cfc', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}
                        >
                          <Pencil style={{ width: '13px', height: '13px' }} /> Editar
                        </button>
                      </PermissionGate>
                      <PermissionGate permission="clients.delete">
                        <button
                          onClick={(ev) => { ev.stopPropagation(); handleDelete(client.id, client.name) }}
                          style={{ padding: '0.5rem', borderRadius: '0.5rem', background: '#fef2f2', color: '#ef4444', border: 'none', cursor: 'pointer' }}
                        >
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                        </button>
                      </PermissionGate>
                    </div>
                </div>
              </div>
            )
          }) : (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', gridColumn: '1 / -1', background: '#fff', borderRadius: '1rem', border: '1px solid #e8ecf4' }}>
              <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <UserCheck style={{ width: '1.75rem', height: '1.75rem', color: '#9ca3af' }} />
              </div>
              <p style={{ color: '#1e1e2d', fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.25rem' }}>Nenhum cliente encontrado</p>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Cadastre seu primeiro cliente ou altere os filtros</p>
            </div>
          )}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <ClientFormModal
          client={editing}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
        />
      )}
      <ConfirmationDialog />
    </div>
  )
}
