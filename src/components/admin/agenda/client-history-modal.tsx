"use client"
import { useState, useEffect } from "react"
import { X, Calendar, Clock, User, DollarSign, FileText, Loader2, AlertCircle } from "lucide-react"
import { ExpandableImage } from "@/components/ui/expandable-image"
import { fetchCollectionWhere } from "@/lib/firebase/client-utils"
import type { Appointment, Client } from "@/lib/types/database"
import { formatCurrency } from "@/lib/utils"
import { statusCfg } from "./status-config"

interface Props {
  client: Client
  onClose: () => void
}

export function ClientHistoryModal({ client, onClose }: Props) {
  const [history, setHistory] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const apts = await fetchCollectionWhere<Appointment>("appointments", "client_id", "==", client.id)
        
        // Filter out blocks and absences, sort by date desc
        const validApts = apts
          .filter(a => a.type !== "block" && a.type !== "absence" && a.type !== "free")
          .sort((a, b) => {
            const dateA = new Date(`${a.appointment_date}T${a.appointment_time}`)
            const dateB = new Date(`${b.appointment_date}T${b.appointment_time}`)
            return dateB.getTime() - dateA.getTime()
          })
          
        setHistory(validApts)
      } catch (err) {
        console.error("Erro ao carregar histórico:", err)
      } finally {
        setLoading(false)
      }
    }
    
    if (client?.id) load()
  }, [client.id])

  // Count valid attendances (exclude cancelled)
  const validAttendances = history.filter(a => a.status !== "cancelled" && a.status !== "no_show")

  let totalSpent = 0
  let uniqueAttendancesCount = 0
  const processedGroups = new Set<string>()

  validAttendances.forEach(apt => {
    if (apt.is_shared_service && apt.shared_group_id) {
      if (!processedGroups.has(apt.shared_group_id)) {
        processedGroups.add(apt.shared_group_id)
        totalSpent += (apt.service_total_value || apt.service_price || 0)
        uniqueAttendancesCount++
      }
    } else {
      totalSpent += (apt.service_price || 0)
      uniqueAttendancesCount++
    }
  })

  const lastVisit = validAttendances.length > 0 ? validAttendances[0].appointment_date : null
  const firstVisit = validAttendances.length > 0 ? validAttendances[validAttendances.length - 1].appointment_date : null

  const MONTHS_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  const fmtDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null
    const d = dateStr.split('T')[0]
    const parts = d.split('-')
    if (parts.length < 3) return d
    return `${parseInt(parts[2])} ${MONTHS_SHORT[parseInt(parts[1]) - 1]} ${parts[0]}`
  }
  const clientSinceRaw = client.created_at || firstVisit
  const clientSince = fmtDate(clientSinceRaw) || 'Não informado'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f3f9', background: '#f8fafc', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', fontWeight: 700, color: '#1e293b' }}>
              Histórico de Atendimentos
            </h3>
            <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
              Cliente: <span style={{ fontWeight: 600, color: '#334155' }}>{client.name}</span>
            </p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#e2e8f0', borderRadius: '0.5rem', padding: '0.375rem', cursor: 'pointer', display: 'flex' }}>
            <X style={{ width: '18px', height: '18px', color: '#64748b' }} />
          </button>
        </div>

        {/* Client summary card */}
        <div style={{ padding: '1rem 1.5rem 0', background: '#fff', flexShrink: 0 }}>
          <div style={{
            padding: '1rem', borderRadius: '0.75rem',
            background: '#fafbfc', border: '1px solid #e8ecf4',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              {client.photo_url && !imgError ? (
                <ExpandableImage
                  src={client.photo_url}
                  alt={client.name}
                  onError={() => setImgError(true)}
                  style={{
                    width: '3.25rem', height: '3.25rem', borderRadius: '50%',
                    objectFit: 'cover', flexShrink: 0, border: '2px solid #e8ecf4',
                  }}
                />
              ) : (
                <div style={{
                  width: '3.25rem', height: '3.25rem', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '1.25rem', fontWeight: 800, flexShrink: 0,
                  border: '2px solid #e8ecf4', textTransform: 'uppercase'
                }}>
                  {client.name ? client.name.charAt(0) : <User style={{ width: '1.5rem', height: '1.5rem' }} />}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {client.name || 'Cliente não informado'}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
                  Gênero: {client.gender
                    ? ({ masculino: 'Masculino', feminino: 'Feminino', outro: 'Outro', nao_informado: 'Não informado' }[client.gender] || client.gender)
                    : 'Não informado'}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
                  Nascimento: {client.birth_date
                    ? client.birth_date.split('-').reverse().join('/')
                    : 'Não informado'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', padding: '1rem 1.5rem', background: '#fff', borderBottom: '1px solid #f1f3f9', flexShrink: 0 }}>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total de Atendimentos</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{uniqueAttendancesCount}</p>
          </div>
          <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '0.75rem', border: '1px solid #bbf7d0' }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Gasto</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d' }}>{formatCurrency(totalSpent)}</p>
          </div>
          <div style={{ padding: '1rem', background: '#fefce8', borderRadius: '0.75rem', border: '1px solid #fef08a' }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#854d0e', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Cliente Desde</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#a16207' }}>{clientSince}</p>
          </div>
          <div style={{ padding: '1rem', background: '#eff6ff', borderRadius: '0.75rem', border: '1px solid #bfdbfe' }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Última Visita</p>
            <p style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1d4ed8' }}>
              {lastVisit ? new Date(lastVisit + 'T00:00:00').toLocaleDateString('pt-BR') : 'Nenhuma'}
            </p>
          </div>
        </div>

        {/* Lista */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', gap: '0.5rem' }}>
              <Loader2 style={{ width: '24px', height: '24px', color: '#cbd5e1', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Buscando histórico...</p>
            </div>
          ) : history.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', gap: '0.5rem', background: '#fff', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
              <AlertCircle style={{ width: '24px', height: '24px', color: '#94a3b8' }} />
              <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 500 }}>Nenhum histórico de agendamento encontrado.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {history.map(apt => {
                const status = statusCfg[apt.status] || { label: apt.status, bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' }
                
                return (
                  <div key={apt.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#fff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: '90px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#334155', fontWeight: 600, fontSize: '0.875rem' }}>
                          <Calendar style={{ width: '14px', height: '14px', color: '#94a3b8' }} />
                          {new Date(apt.appointment_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#64748b', fontSize: '0.75rem', marginTop: '0.125rem' }}>
                          <Clock style={{ width: '12px', height: '12px' }} />
                          {apt.appointment_time}
                        </div>
                      </div>

                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem', marginBottom: '0.125rem' }}>
                          {apt.service_name || 'Serviço não informado'}
                        </p>
                        <p style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#64748b', fontSize: '0.75rem' }}>
                          <User style={{ width: '12px', height: '12px' }} />
                          {apt.employee_name || 'Profissional não informado'}
                        </p>
                      </div>

                      <div style={{ minWidth: '100px', textAlign: 'right' }}>
                        <p style={{ fontWeight: 700, color: '#334155', fontSize: '0.875rem' }}>
                          {formatCurrency(apt.service_price || 0)}
                        </p>
                        {apt.payment_method && (
                          <p style={{ color: '#94a3b8', fontSize: '0.6875rem', textTransform: 'uppercase' }}>
                            {apt.payment_method}
                          </p>
                        )}
                      </div>

                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '120px', justifyContent: 'flex-end' }}>
                      <span style={{ padding: '0.25rem 0.625rem', borderRadius: '1rem', fontSize: '0.6875rem', fontWeight: 600, background: status.bg, color: status.color, border: `1px solid ${status.border}` }}>
                        {status.label}
                      </span>
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
