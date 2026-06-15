"use client"

import { useState } from "react"
import { createDocument, updateDocument, fetchCollection } from "@/lib/firebase/client-utils"
import { useTenant } from "@/lib/auth/tenant-context"
import { getAuthInstance } from "@/lib/firebase/config"
import { createHistoryEvent } from "@/lib/firebase/history-service"
import { X, Wallet, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Client, ClientTransaction, ClientTransactionType } from "@/lib/types/database"

interface Props {
  client: Client
  type: ClientTransactionType
  onClose: () => void
  onSuccess: () => void
}

export function ClientTransactionModal({ client, type, onClose, onSuccess }: Props) {
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [origin, setOrigin] = useState("Crédito manual")
  const [loading, setLoading] = useState(false)
  const { isProfessional, permissions } = useTenant()

  const creditOrigins = [
    "Troco deixado",
    "Pagamento maior",
    "Crédito manual",
    "Bônus/promocional",
    "Ajuste administrativo",
    "Outro"
  ]

  const debitOrigins = [
    "Serviço não pago",
    "Pagamento parcial",
    "Fiado",
    "Ajuste administrativo",
    "Outro"
  ]

  const useCreditOrigins = [
    "Abatimento em serviço",
    "Estorno / Devolução",
    "Ajuste de saldo",
    "Outro"
  ]

  const originsList = type === "credit" ? creditOrigins : type === "debit" ? debitOrigins : useCreditOrigins

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(amount.replace(",", "."))
    if (isNaN(val) || val <= 0) {
      toast.error("Informe um valor válido maior que zero")
      return
    }
    
    if (type === "use_credit" && val > (client.credit_amount || 0)) {
      toast.error(`O valor não pode exceder o saldo atual de ${client.credit_amount}`)
      return
    }

    try {
      setLoading(true)
      const user = getAuthInstance().currentUser
      if (!user) throw new Error("Não autenticado")

      const newTx: Partial<ClientTransaction> = {
        client_id: client.id,
        client_name: client.name,
        type,
        amount: val,
        remaining_amount: val,
        status: "active",
        origin: origin || "manual",
        notes: notes || null,
        due_date: dueDate || null,
        created_by_id: user.uid,
        created_by_name: user.displayName || "Usuário",
      }

      await createDocument("client_transactions", newTx as any)

      // Update client balances
      const updates: Partial<Client> = {}
      if (type === "credit") {
        updates.credit_amount = (client.credit_amount || 0) + val
      } else if (type === "use_credit") {
        updates.credit_amount = Math.max(0, (client.credit_amount || 0) - val)
      } else {
        updates.debt_amount = (client.debt_amount || 0) + val
        updates.status = "debtor"
      }

      await updateDocument("clients", client.id, updates)

      // Registra no Histórico Geral
      const oldCredit = client.credit_amount || 0
      const oldDebt = client.debt_amount || 0
      const newCredit = type === "credit" ? oldCredit + val : type === "use_credit" ? Math.max(0, oldCredit - val) : oldCredit
      const newDebt = type === "debit" ? oldDebt + val : oldDebt

      const actionTypeStr = type === "credit" ? "credit_add" : type === "use_credit" ? "credit_use" : "debit_add"
      const actionTitleStr = type === "credit" ? "Crédito adicionado" : type === "use_credit" ? "Crédito usado" : "Débito adicionado"
      
      const balanceDesc = type === "debit" 
        ? `Saldo anterior: R$ ${oldDebt.toFixed(2).replace(".", ",")} | Saldo atual: R$ ${newDebt.toFixed(2).replace(".", ",")}` 
        : `Saldo anterior: R$ ${oldCredit.toFixed(2).replace(".", ",")} | Saldo atual: R$ ${newCredit.toFixed(2).replace(".", ",")}`
        
      const descStr = `Cliente: ${client.name} | ${actionTitleStr}: R$ ${val.toFixed(2).replace(".", ",")} | Origem: ${origin || "Manual"} | ${balanceDesc}`

      await createHistoryEvent({
        client_id: client.id,
        client_name: client.name,
        action_type: actionTypeStr,
        action_title: actionTitleStr,
        action_description: descStr,
        old_value: type === "debit" ? oldDebt : oldCredit,
        new_value: type === "debit" ? newDebt : newCredit,
        performed_by_user_id: user.uid,
        performed_by_name: user.displayName || "Usuário",
        performed_by_email: user.email || null
      })

      toast.success(type === "credit" ? "Crédito adicionado com sucesso" : type === "use_credit" ? "Crédito utilizado com sucesso" : "Débito adicionado com sucesso")
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error("Erro ao salvar movimentação")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      
      <div style={{ position: 'relative', background: '#fff', width: '100%', maxWidth: '400px', borderRadius: '1.25rem', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: type === "credit" ? '#f0fdf4' : '#fef2f2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: type === "credit" ? '#bbf7d0' : type === "use_credit" ? '#fef08a' : '#fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {type === "credit" ? <Wallet className="w-5 h-5 text-green-700" style={{ color: '#15803d' }} /> : type === "use_credit" ? <Wallet className="w-5 h-5 text-yellow-700" style={{ color: '#a16207' }} /> : <AlertCircle className="w-5 h-5 text-red-700" style={{ color: '#b91c1c' }} />}
            </div>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', fontFamily: "var(--font-heading)" }}>
                {type === "credit" ? "Adicionar Crédito" : type === "use_credit" ? "Utilizar Crédito" : "Adicionar Débito"}
              </h2>
              <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Para {client.name}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X style={{ width: '1.25rem', height: '1.25rem' }} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', outline: 'none' }}
                placeholder="0.00"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>Origem / Motivo</label>
              <select
                value={origin}
                onChange={e => setOrigin(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', outline: 'none', cursor: 'pointer', background: '#fff' }}
              >
                {originsList.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            {type === "debit" && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>Vencimento (Opcional)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', outline: 'none' }}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>Observação (Opcional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', outline: 'none', minHeight: '80px', resize: 'vertical' }}
                placeholder="Motivo da movimentação..."
              />
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{ padding: '0.625rem 1rem', borderRadius: '0.625rem', fontSize: '0.875rem', fontWeight: 600, color: '#475569', background: '#f1f5f9', border: 'none', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{ padding: '0.625rem 1.25rem', borderRadius: '0.625rem', fontSize: '0.875rem', fontWeight: 600, color: '#fff', background: type === "credit" ? '#16a34a' : type === "use_credit" ? '#ca8a04' : '#dc2626', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
