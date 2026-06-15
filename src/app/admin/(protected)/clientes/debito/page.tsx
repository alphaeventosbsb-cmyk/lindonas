"use client"

import { useEffect, useState } from "react"
import { fetchCollection, updateDocument } from "@/lib/firebase/client-utils"
import type { Client, ClientTransaction } from "@/lib/types/database"
import { formatCurrency } from "@/lib/utils"
import { Loader2, Search, AlertCircle, Plus, History, UserCheck, CheckCircle } from "lucide-react"
import { ExpandableImage } from "@/components/ui/expandable-image"
import { ClientTransactionModal } from "@/components/admin/client-transaction-modal"
import { useTenant } from "@/lib/auth/tenant-context"
import { toast } from "sonner"
import { useConfirm } from "@/components/ui/confirm-modal"
import { normalizeSearchText } from "@/lib/search"
import { ExportButtons } from "@/components/ui/export-buttons"

export default function DebitoClientePage() {
  const [clients, setClients] = useState<Client[]>([])
  const [transactions, setTransactions] = useState<ClientTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showHistoryClient, setShowHistoryClient] = useState<Client | null>(null)
  
  const { isProfessional, permissions } = useTenant()
  const canEdit = !isProfessional || permissions.canEditClients
  const { ConfirmationDialog, confirm } = useConfirm()

  const load = async () => {
    setLoading(true)
    const [c, t] = await Promise.all([
      fetchCollection<Client>("clients", "name"),
      fetchCollection<ClientTransaction>("client_transactions", "created_at", "desc"),
    ])
    setClients(c)
    setTransactions(t.filter(tx => tx.type === "debit"))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleQuitarDebito = async (client: Client) => {
    if (!canEdit) return
    const confirmed = await confirm({
      title: "Quitar débito",
      message: `Confirmar quitação total do débito de ${formatCurrency(client.debt_amount)} do cliente ${client.name}?`,
      confirmText: "Quitar débito",
      cancelText: "Cancelar",
    })
    if (!confirmed) return
    
    try {
      setLoading(true)
      await updateDocument("clients", client.id, {
        debt_amount: 0,
        status: "active"
      })
      toast.success("Débito quitado com sucesso!")
      load()
    } catch (err) {
      toast.error("Erro ao quitar débito")
    } finally {
      setLoading(false)
    }
  }

  const filtered = clients
    .filter(c => c.debt_amount > 0 || search.trim() !== "")
    .filter(c => normalizeSearchText(c.name).includes(normalizeSearchText(search)))

  const totalDebit = clients.reduce((sum, c) => sum + (c.debt_amount || 0), 0)
  const totalDebtors = clients.filter(c => c.debt_amount > 0).length

  const exportData = transactions.filter(tx => 
    filtered.some(c => c.id === tx.client_id)
  )

  const exportConfig = {
    title: `Transações de Débito de Clientes`,
    fileName: `transacoes_debito`,
    data: exportData,
    columns: [
      { header: "Cliente", key: "client_id", format: (v: any) => clients.find(c => c.id === v)?.name || "Desconhecido" },
      { header: "Valor (Débito)", key: "amount", format: (v: any) => formatCurrency(Number(v)) },
      { header: "Origem", key: "origin", format: (v: any) => v || "—" },
      { header: "Observações", key: "notes", format: (v: any) => v || "—" },
      { header: "Data", key: "created_at", format: (v: any) => new Date(String(v)).toLocaleString('pt-BR') },
      { header: "Responsável", key: "created_by_name", format: (v: any) => v || "Sistema" }
    ]
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#7c5cfc]" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '2rem', height: '2rem', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f25c5c, #f78888)', boxShadow: '0 3px 10px rgba(242,92,92,0.25)' }}>
              <AlertCircle style={{ width: '1rem', height: '1rem', color: '#fff' }} />
            </div>
            <span style={{ fontSize: '0.6875rem', color: '#6b7280', fontWeight: 600 }}>Dívida Total</span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>{formatCurrency(totalDebit)}</p>
        </div>
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '2rem', height: '2rem', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #ea580c, #f97316)', boxShadow: '0 3px 10px rgba(234,88,12,0.25)' }}>
              <UserCheck style={{ width: '1rem', height: '1rem', color: '#fff' }} />
            </div>
            <span style={{ fontSize: '0.6875rem', color: '#6b7280', fontWeight: 600 }}>Clientes Devedores</span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>{totalDebtors}</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: '1rem', padding: '1rem', border: '1px solid #e5e7eb', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
          <Search style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#9ca3af' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', fontSize: '0.875rem', outline: 'none' }}
            placeholder="Buscar cliente para adicionar débito..." />
        </div>
        <ExportButtons 
          data={exportConfig.data}
          columns={exportConfig.columns}
          fileName={exportConfig.fileName}
          title={exportConfig.title}
        />
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
                <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Saldo Devedor</th>
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
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: client.debt_amount > 0 ? 'linear-gradient(135deg, #f25c5c, #f78888)' : 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
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
                    <span style={{ fontWeight: 800, color: client.debt_amount > 0 ? '#dc2626' : '#94a3b8', fontSize: '1rem' }}>
                      {formatCurrency(client.debt_amount || 0)}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button onClick={() => setShowHistoryClient(client)} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                        <History style={{ width: '0.875rem', height: '0.875rem' }} /> Histórico
                      </button>
                      {canEdit && client.debt_amount > 0 && (
                        <button onClick={() => handleQuitarDebito(client)} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: 'none', background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                          <CheckCircle style={{ width: '0.875rem', height: '0.875rem' }} /> Quitar
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => setSelectedClient(client)} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: 'none', background: '#fee2e2', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                          <Plus style={{ width: '0.875rem', height: '0.875rem' }} /> Débito
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
          type="debit"
          onClose={() => setSelectedClient(null)}
          onSuccess={load}
        />
      )}

      {/* Modal Histórico */}
      {showHistoryClient && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowHistoryClient(null)} />
          <div style={{ position: 'relative', background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '1.25rem', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>Histórico de Débitos</h2>
                <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>{showHistoryClient.name}</p>
              </div>
              <button onClick={() => setShowHistoryClient(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem' }}>X</button>
            </div>
            <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
              {transactions.filter(t => t.client_id === showHistoryClient.id).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {transactions.filter(t => t.client_id === showHistoryClient.id).map(tx => (
                    <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#fef2f2', borderRadius: '0.75rem', border: '1px solid #fecaca' }}>
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#dc2626' }}>- {formatCurrency(tx.amount)}</p>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{new Date(tx.created_at).toLocaleString('pt-BR')}</p>
                        {tx.due_date && <p style={{ fontSize: '0.75rem', color: '#991b1b', marginTop: '0.25rem', fontWeight: 600 }}>Vence: {new Date(tx.due_date).toLocaleDateString('pt-BR')}</p>}
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
      <ConfirmationDialog />
    </div>
  )
}
