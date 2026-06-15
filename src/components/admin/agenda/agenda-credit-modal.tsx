"use client"

import { useState, useMemo } from "react"
import { X, Search, User, Plus } from "lucide-react"
import { useAgendaStore } from "./agenda-store"
import { ClientTransactionModal } from "@/components/admin/client-transaction-modal"
import type { Client } from "@/lib/types/database"

interface Props {
  onClose: () => void
}

export function AgendaCreditModal({ onClose }: Props) {
  const store = useAgendaStore()
  const clients = store.clients

  const [clientSearch, setClientSearch] = useState("")
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

  const normalizePhone = (p: string) => p.replace(/\D/g, "")

  const filteredClients = useMemo(() => {
    if (clientSearch.length < 2) return []
    const q = clientSearch.toLowerCase().trim()
    const qPhone = normalizePhone(clientSearch)

    return clients.filter(c => {
      if (c.name?.toLowerCase().includes(q)) return true
      if ((c as any).nickname?.toLowerCase().includes(q)) return true
      if (c.phone && normalizePhone(c.phone).includes(qPhone) && qPhone.length >= 2) return true
      if (c.email?.toLowerCase().includes(q)) return true
      return false
    }).slice(0, 8)
  }, [clientSearch, clients])

  // If a client is selected, render the actual transaction modal
  if (selectedClient) {
    return (
      <ClientTransactionModal
        client={selectedClient}
        type="credit"
        onClose={onClose}
        onSuccess={onClose}
      />
    )
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem', border: '2px solid #e8ecf4', fontSize: '0.8125rem', color: '#1e1e2d', outline: 'none', background: '#fafbfc' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f3f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '1.25rem' }}>💰</span>
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.0625rem', fontWeight: 700, color: '#1e1e2d' }}>Buscar Cliente</h3>
              <p style={{ fontSize: '0.6875rem', color: '#8b8fa7' }}>
                Para adicionar crédito
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', padding: '0.375rem', cursor: 'pointer' }}>
            <X style={{ width: '20px', height: '20px', color: '#94a3b8' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', minHeight: '200px' }}>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#8b8fa7' }} />
            <input
              type="text"
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              placeholder="Buscar por nome, telefone ou email..."
              style={{ ...inputStyle, paddingLeft: '2.5rem' }}
              autoComplete="off"
              autoFocus
            />
          </div>

          {clientSearch.length >= 2 && (
            <div style={{ border: '1px solid #e8ecf4', borderRadius: '0.5rem', background: '#fff', overflow: 'hidden' }}>
              {filteredClients.length > 0 ? (
                filteredClients.map(c => (
                  <button key={c.id} onClick={() => setSelectedClient(c)}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.8125rem', textAlign: 'left', borderBottom: '1px solid #f5f5fa', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f5f3ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div>
                      <span style={{ fontWeight: 600, color: '#1e1e2d', display: 'block' }}>{c.name}</span>
                      {c.email && <span style={{ fontSize: '0.6875rem', color: '#8b8fa7' }}>{c.email}</span>}
                    </div>
                    <span style={{ color: '#8b8fa7', fontSize: '0.75rem', flexShrink: 0, marginLeft: '0.5rem' }}>{c.phone}</span>
                  </button>
                ))
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.8125rem', color: '#8b8fa7' }}>Nenhum cliente encontrado para "{clientSearch}"</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
