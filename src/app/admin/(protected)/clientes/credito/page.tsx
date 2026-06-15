"use client"

import { useEffect, useState } from "react"
import { fetchCollection } from "@/lib/firebase/client-utils"
import type { Client, ClientTransaction } from "@/lib/types/database"
import { formatCurrency } from "@/lib/utils"
import { Loader2, Search, Wallet, Plus, History, UserCheck, Minus } from "lucide-react"
import { ExpandableImage } from "@/components/ui/expandable-image"
import { ClientTransactionModal } from "@/components/admin/client-transaction-modal"
import { useTenant } from "@/lib/auth/tenant-context"
import { normalizeSearchText } from "@/lib/search"
import { ExportButtons } from "@/components/ui/export-buttons"

export default function CreditoClientePage() {
  const [clients, setClients] = useState<Client[]>([])
  const [transactions, setTransactions] = useState<ClientTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [autoSearch, setAutoSearch] = useState("")
  const [showAutoDropdown, setShowAutoDropdown] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [transactionType, setTransactionType] = useState<"credit" | "use_credit">("credit")
  const [showHistoryClient, setShowHistoryClient] = useState<Client | null>(null)
  
  const { isProfessional, permissions } = useTenant()
  const canEdit = !isProfessional || permissions.canEditClients

  const load = async () => {
    setLoading(true)
    const [c, t] = await Promise.all([
      fetchCollection<Client>("clients", "name"),
      fetchCollection<ClientTransaction>("client_transactions", "created_at", "desc"),
    ])
    setClients(c)
    setTransactions(t.filter(tx => tx.type === "credit" || tx.type === "use_credit"))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const onlyDigits = (s: string) => s.replace(/\D/g, "")
  const autoNorm = normalizeSearchText(autoSearch)
  const autoDigits = onlyDigits(autoSearch)

  const filtered = clients
    .filter(c => c.credit_amount > 0)
    .filter(c => {
      if (!autoNorm) return true
      const matchName = normalizeSearchText(c.name).includes(autoNorm)
      const matchPhone = autoDigits.length >= 4 && onlyDigits(c.phone || "").includes(autoDigits)
      const matchCpf = autoDigits.length >= 3 && c.cpf && onlyDigits(c.cpf).includes(autoDigits)
      const matchEmail = c.email && normalizeSearchText(c.email).includes(autoNorm)
      return matchName || matchPhone || matchCpf || matchEmail
    })

  const autocompleteResults = clients.filter(c => {
    if (!autoNorm) return false
    const matchName = normalizeSearchText(c.name).includes(autoNorm)
    const matchPhone = autoDigits.length >= 4 && onlyDigits(c.phone || "").includes(autoDigits)
    const matchCpf = autoDigits.length >= 3 && c.cpf && onlyDigits(c.cpf).includes(autoDigits)
    const matchEmail = c.email && normalizeSearchText(c.email).includes(autoNorm)
    return matchName || matchPhone || matchCpf || matchEmail
  }).slice(0, 8)

  const totalCredit = clients.reduce((sum, c) => sum + (c.credit_amount || 0), 0)

  const exportConfig = {
    title: `Clientes com Saldo de Crédito`,
    fileName: `clientes_credito`,
    data: filtered,
    columns: [
      { header: "Cliente", key: "name" },
      { header: "Telefone", key: "phone", format: (v: any) => v || "—" },
      { header: "CPF", key: "cpf", format: (v: any) => v || "—" },
      { header: "Saldo de Crédito", key: "credit_amount", format: (v: any) => formatCurrency(Number(v)) }
    ]
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#7c5cfc]" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '2rem', height: '2rem', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #22c997, #5ee0b8)', boxShadow: '0 3px 10px rgba(34,201,151,0.25)' }}>
              <Wallet style={{ width: '1rem', height: '1rem', color: '#fff' }} />
            </div>
            <span style={{ fontSize: '0.6875rem', color: '#6b7280', fontWeight: 600 }}>Total em Créditos</span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>{formatCurrency(totalCredit)}</p>
        </div>
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '2rem', height: '2rem', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', boxShadow: '0 3px 10px rgba(124,92,252,0.25)' }}>
              <UserCheck style={{ width: '1rem', height: '1rem', color: '#fff' }} />
            </div>
            <span style={{ fontSize: '0.6875rem', color: '#6b7280', fontWeight: 600 }}>Clientes com Crédito</span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>{clients.filter(c => c.credit_amount > 0).length}</p>
        </div>
      </div>

      {/* Adicionar Crédito (Autocomplete) */}
      <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e1e2d', fontFamily: "var(--font-heading)", margin: 0 }}>Adicionar Crédito</h3>
          <ExportButtons 
            data={exportConfig.data}
            columns={exportConfig.columns}
            fileName={exportConfig.fileName}
            title={exportConfig.title}
            exportPermissionKey="clients.credit.export"
            moduleName="credito"
          />
        </div>
        <div style={{ position: 'relative', flex: 1, zIndex: 20 }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '1.25rem', height: '1.25rem', color: '#9ca3af' }} />
          <input type="text" value={autoSearch} onChange={e => { setAutoSearch(e.target.value); setShowAutoDropdown(true) }}
            onFocus={() => setShowAutoDropdown(true)}
            onBlur={() => setTimeout(() => setShowAutoDropdown(false), 200)}
            style={{ width: '100%', padding: '0.875rem 1rem 0.875rem 3rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', fontSize: '0.875rem', outline: 'none' }}
            placeholder="Buscar cliente por Nome, CPF ou Telefone para adicionar crédito..." />
          
          {showAutoDropdown && autoSearch.trim() !== "" && (
            <div style={{ position: 'absolute', top: 'calc(100% + 0.5rem)', left: 0, right: 0, background: '#fff', borderRadius: '0.75rem', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {autocompleteResults.length > 0 ? (
                autocompleteResults.map(client => (
                  <div key={client.id}
                    onClick={() => {
                      setSelectedClient(client)
                      setTransactionType("credit")
                      setAutoSearch("")
                      setShowAutoDropdown(false)
                    }}
                    style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>{client.name}</p>
                      <p style={{ fontSize: '0.75rem', color: '#64748b' }}>{client.phone} {client.cpf && `• CPF: ${client.cpf}`}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', background: '#dcfce7', padding: '0.125rem 0.5rem', borderRadius: '1rem' }}>
                        Crédito: {formatCurrency(client.credit_amount || 0)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>Nenhum cliente encontrado.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>Clientes</h2>
        </div>
        
        {filtered.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Cliente</th>
                <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Saldo de Crédito</th>
                <th style={{ padding: '0.75rem 1.25rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(client => (
                <tr key={client.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {client.photo_url ? (
                        <ExpandableImage src={client.photo_url} alt={client.name} style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                          {client.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.875rem' }}>{client.name}</p>
                        <p style={{ fontSize: '0.75rem', color: '#64748b' }}>{client.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                    <span style={{ fontWeight: 800, color: client.credit_amount > 0 ? '#059669' : '#94a3b8', fontSize: '1rem' }}>
                      {formatCurrency(client.credit_amount || 0)}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button onClick={() => setShowHistoryClient(client)} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                        <History style={{ width: '0.875rem', height: '0.875rem' }} /> Histórico
                      </button>
                      {canEdit && (
                        <button onClick={() => { setSelectedClient(client); setTransactionType("credit") }} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: 'none', background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                          <Plus style={{ width: '0.875rem', height: '0.875rem' }} /> Adicionar
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => { setSelectedClient(client); setTransactionType("use_credit") }} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: 'none', background: '#fef3c7', color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                          <Minus style={{ width: '0.875rem', height: '0.875rem' }} /> Usar/Remover
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            Nenhum cliente encontrado.
          </div>
        )}
      </div>

      {selectedClient && (
        <ClientTransactionModal
          client={selectedClient}
          type={transactionType}
          onClose={() => setSelectedClient(null)}
          onSuccess={load}
        />
      )}

      {/* Modal Histórico (Simplificado) */}
      {showHistoryClient && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowHistoryClient(null)} />
          <div style={{ position: 'relative', background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '1.25rem', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>Histórico de Crédito</h2>
                <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>{showHistoryClient.name}</p>
              </div>
              <button onClick={() => setShowHistoryClient(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem' }}>X</button>
            </div>
            <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
              {transactions.filter(t => t.client_id === showHistoryClient.id).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {transactions.filter(t => t.client_id === showHistoryClient.id).map(tx => (
                    <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: tx.type === "credit" ? '#16a34a' : '#ca8a04' }}>
                          {tx.type === "credit" ? "+" : "-"} {formatCurrency(tx.amount)}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{new Date(tx.created_at).toLocaleString('pt-BR')}</p>
                        {tx.notes && <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.5rem', fontStyle: 'italic' }}>"{tx.notes}"</p>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Origem: {tx.origin}</p>
                        <p style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '0.25rem' }}>Por: {tx.created_by_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>Nenhum histórico encontrado.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
