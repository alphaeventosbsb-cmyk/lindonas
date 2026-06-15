"use client"
import { useState, useEffect } from "react"
import { History, Loader2, ArrowRight } from "lucide-react"
import { fetchCollectionWhere } from "@/lib/firebase/client-utils"
import type { Appointment, Client } from "@/lib/types/database"
import { formatCurrency } from "@/lib/utils"
import { ClientHistoryModal } from "./client-history-modal"

export function ClientHistorySummary({ clientId, clientName }: { clientId: string, clientName: string }) {
  const [history, setHistory] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const apts = await fetchCollectionWhere<Appointment>("appointments", "client_id", "==", clientId)
        const validApts = apts.filter(a => a.type !== "block" && a.type !== "absence" && a.type !== "free")
        setHistory(validApts)
      } catch (err) {
        console.error("Erro ao carregar histórico:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [clientId])

  if (loading) {
    return (
      <div style={{ background: '#fafbfc', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #e8ecf4', display: 'flex', justifyContent: 'center' }}>
        <Loader2 style={{ width: '16px', height: '16px', color: '#94a3b8', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  const validAttendances = history.filter(a => a.status === "completed" || a.status === "closed")
  const totalSpent = validAttendances.reduce((acc, curr) => acc + (curr.service_price || 0), 0)
  const ticketMedio = validAttendances.length > 0 ? totalSpent / validAttendances.length : 0
  
  // sort to find last visit
  const sorted = [...validAttendances].sort((a, b) => {
    const dateA = new Date(`${a.appointment_date}T${a.appointment_time}`)
    const dateB = new Date(`${b.appointment_date}T${b.appointment_time}`)
    return dateB.getTime() - dateA.getTime()
  })
  const lastVisit = sorted.length > 0 ? sorted[0].appointment_date : null

  return (
    <>
      <div style={{ background: '#fafbfc', borderRadius: '0.75rem', padding: '0.75rem', border: '1px solid #e8ecf4' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <History style={{ width: '0.75rem', height: '0.75rem', color: '#7c5cfc' }} />
            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#1e1e2d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Histórico do Cliente</span>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.625rem', color: '#7c5cfc', fontWeight: 700, background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            Ver detalhes <ArrowRight style={{ width: '10px', height: '10px' }} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 600 }}>ATENDIMENTOS</p>
            <p style={{ fontSize: '0.8125rem', color: '#1e1e2d', fontWeight: 700 }}>{validAttendances.length}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 600 }}>ÚLTIMA VISITA</p>
            <p style={{ fontSize: '0.8125rem', color: '#1e1e2d', fontWeight: 700 }}>{lastVisit ? new Date(lastVisit + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 600 }}>TOTAL GASTO</p>
            <p style={{ fontSize: '0.8125rem', color: '#10b981', fontWeight: 700 }}>{formatCurrency(totalSpent)}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.5625rem', color: '#8b8fa7', fontWeight: 600 }}>TICKET MÉDIO</p>
            <p style={{ fontSize: '0.8125rem', color: '#f59e0b', fontWeight: 700 }}>{formatCurrency(ticketMedio)}</p>
          </div>
        </div>
      </div>

      {showModal && (
        <ClientHistoryModal 
          client={{ id: clientId, name: clientName } as Client} 
          onClose={() => setShowModal(false)} 
        />
      )}
    </>
  )
}
