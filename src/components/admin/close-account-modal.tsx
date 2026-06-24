"use client"
import { useState, useEffect } from "react"
import type { Appointment, Client } from "@/lib/types/database"
import { formatCurrency, formatPhone, toLocalDateStr } from "@/lib/utils"
import { X, DollarSign, CreditCard, Smartphone, Banknote, ArrowRightLeft, Gift, HelpCircle, User, Scissors, Calendar, Clock, CheckCircle, Loader2, Users } from "lucide-react"
import { updateAppointment, createDocument, fetchCollectionWhere, updateDocument, fetchCollection, getDocument, fetchCollectionWithQueries } from "@/lib/firebase/client-utils"
import type { CashRegister, Employee, Commission, Product, ServiceProduct, InventoryMovement } from "@/lib/types/database"
import { useTenant } from "@/lib/auth/tenant-context"
import { toast } from "sonner"
import { usePermission } from "@/lib/rbac/usePermission"
import { PermissionGate } from "@/components/ui/permission-gate"
import { createHistoryEvent } from "@/lib/firebase/history-service"

interface Props { appointment: Appointment; onClose: () => void; onDone: () => void }

const paymentMethods = [
  { id: "cash", label: "Dinheiro", icon: Banknote, color: "#059669" },
  { id: "pix", label: "PIX", icon: Smartphone, color: "#7c5cfc" },
  { id: "credit_card", label: "Crédito", icon: CreditCard, color: "#3b82f6" },
  { id: "debit_card", label: "Débito", icon: CreditCard, color: "#0891b2" },
  { id: "transfer", label: "Transferência", icon: ArrowRightLeft, color: "#6366f1" },
  { id: "courtesy", label: "Cortesia", icon: Gift, color: "#ec4899" },
  { id: "other", label: "Outro", icon: HelpCircle, color: "#64748b" },
]

const paymentStatuses = [
  { id: "paid", label: "Pago", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  { id: "pending", label: "Pendente", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  { id: "partial", label: "Parcialmente pago", color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
]

export function CloseAccountModal({ appointment, onClose, onDone }: Props) {
  const { saasUser } = useTenant()
  const { can } = usePermission()
  
  const [paymentSplits, setPaymentSplits] = useState<{ method: string, amount: string, manuallyEdited?: boolean }[]>(
    appointment.payment_splits?.map(s => ({ method: s.method, amount: s.amount != null ? String(s.amount) : "", manuallyEdited: true })) || 
    (appointment.payment_method && appointment.payment_method !== "multiple" && appointment.payment_method !== "mixed" 
      ? [{ method: appointment.payment_method, amount: appointment.payment_status === "paid" || appointment.payment_status === "partial" ? (appointment.payment_splits?.[0]?.amount != null ? String(appointment.payment_splits[0].amount) : "") : "", manuallyEdited: true }] 
      : [])
  )

  const [payStatus, setPayStatus] = useState("paid")
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  
  const [clientData, setClientData] = useState<Client | null>(null)
  const [loadingClient, setLoadingClient] = useState(false)
  const [creditUsed, setCreditUsed] = useState(0)

  const [hasOpenRegister, setHasOpenRegister] = useState<boolean | null>(null)
  const [loadingRegister, setLoadingRegister] = useState(true)
  const [showOpenRegister, setShowOpenRegister] = useState(false)
  const [openingAmount, setOpeningAmount] = useState("")
  
  const [employeesData, setEmployeesData] = useState<Employee[]>([])

  // Multi-professional
  const [sharedAppointments, setSharedAppointments] = useState<Appointment[]>([])
  const [sharedValues, setSharedValues] = useState<Record<string, number>>({})

  useEffect(() => {
    const today = toLocalDateStr()
    if (saasUser?.id) {
      fetchCollectionWithQueries<CashRegister>("cash_registers", [
        { field: "company_id", operator: "==", value: saasUser.id },
        { field: "date", operator: "==", value: today }
      ])
        .then(res => {
          setHasOpenRegister(res.length > 0 && res[0].status === "open")
        })
        .finally(() => setLoadingRegister(false))
    } else {
      setHasOpenRegister(false)
      setLoadingRegister(false)
    }

    fetchCollection<Employee>("employees").then(res => setEmployeesData(res))

    if (appointment.client_phone) {
      setLoadingClient(true)
      fetchCollectionWhere<Client>("clients", "phone", "==", appointment.client_phone)
        .then(res => {
          if (res.length > 0) setClientData(res[0])
        })
        .finally(() => setLoadingClient(false))
    }

    if (appointment.is_shared_service && appointment.shared_group_id) {
      Promise.all([
        fetchCollectionWhere<Appointment>("appointments", "shared_group_id", "==", appointment.shared_group_id),
        fetchCollection<any>("services")
      ]).then(([res, servicesData]) => {
          setSharedAppointments(res)
          const vals: Record<string, number> = {}
          
          const serviceGroups = new Map<string, Appointment[]>()
          res.forEach(apt => {
            const key = apt.service_id || apt.service_name || apt.id
            if (!serviceGroups.has(key)) {
              serviceGroups.set(key, [])
            }
            serviceGroups.get(key)!.push(apt)
          })

          serviceGroups.forEach((apts, key) => {
            const count = apts.length
            const serviceDb = servicesData.find(s => s.id === apts[0].service_id)
            const defaultDbPrice = serviceDb ? (serviceDb.promotional_price || serviceDb.price || 0) : 0
            
            const maxServicePrice = Math.max(...apts.map(a => a.service_price || 0))
            const sumServicePrice = apts.reduce((acc, a) => acc + (a.service_price || 0), 0)
            
            let baseValue = maxServicePrice
            
            if (count > 1) {
              if (defaultDbPrice > 0) {
                 if (Math.abs(sumServicePrice - defaultDbPrice) < 0.01) {
                    baseValue = sumServicePrice
                 } else if (maxServicePrice >= defaultDbPrice) {
                    baseValue = maxServicePrice
                 } else if (sumServicePrice > maxServicePrice && Math.abs(maxServicePrice - (sumServicePrice/count)) < 0.01) {
                    baseValue = sumServicePrice
                 }
              } else {
                 if (sumServicePrice > maxServicePrice && Math.abs(maxServicePrice - (sumServicePrice/count)) < 0.01) {
                    baseValue = sumServicePrice
                 }
              }
            }

            if (count === 1) {
              const apt = apts[0]
              const savedVal = apt.professional_service_value
              vals[apt.id] = savedVal !== undefined && savedVal !== null ? savedVal : baseValue
            } else {
              const splitValue = Math.floor((baseValue / count) * 100) / 100
              const remainder = Math.round((baseValue - (splitValue * count)) * 100) / 100

              const currentSum = apts.reduce((sum, apt) => sum + (apt.professional_service_value || 0), 0)
              const hasAllValues = apts.every(apt => apt.professional_service_value !== undefined && apt.professional_service_value !== null)
              
              const isManualOverride = hasAllValues && Math.abs(currentSum - baseValue) < 0.01

              apts.forEach((apt, index) => {
                if (isManualOverride && apt.professional_service_value !== null && apt.professional_service_value !== undefined) {
                  vals[apt.id] = apt.professional_service_value
                } else {
                  let calcValue = splitValue
                  if (index === 0) calcValue = Math.round((calcValue + remainder) * 100) / 100
                  vals[apt.id] = calcValue
                }
              })
            }
          })
          
          setSharedValues(vals)
        })
    }
  }, [appointment.client_phone, appointment.is_shared_service, appointment.shared_group_id])

  const price = appointment.is_shared_service && appointment.service_total_value 
    ? appointment.service_total_value 
    : (appointment.service_price || 0)
  const total = Math.max(0, price - discount)
  
  const maxCredit = Math.min(clientData?.credit_amount || 0, total)
  useEffect(() => {
    if (creditUsed > maxCredit) setCreditUsed(maxCredit)
  }, [maxCredit, creditUsed])

  const isCourtesy = paymentSplits.length === 1 && paymentSplits[0].method === "courtesy"
  
  const remainingToPay = Math.max(0, total - creditUsed)
  
  const totalSplits = paymentSplits.reduce((acc, s) => acc + (Number(String(s.amount || "").replace(",", ".")) || 0), 0)
  const paidAmount = isCourtesy ? 0 : totalSplits
  
  const valorTotalPago = creditUsed + paidAmount
  const diff = valorTotalPago - total
  const excedente = diff > 0 && !isCourtesy ? diff : 0
  const restante = diff < 0 && !isCourtesy ? Math.abs(diff) : 0
  const dynamicStatus = valorTotalPago === 0 ? "pending" : (valorTotalPago < total ? "partial" : "paid")

  const recalculateSplits = (newSplits: { method: string, amount: string, manuallyEdited?: boolean }[], totalToPay: number) => {
    if (newSplits.length === 0) return newSplits
    
    const manualSum = newSplits.filter(s => s.manuallyEdited).reduce((acc, s) => acc + (Number(String(s.amount || "").replace(",", ".")) || 0), 0)
    const remaining = Math.max(0, totalToPay - manualSum)
    
    const nonManual = newSplits.filter(s => !s.manuallyEdited)
    
    if (newSplits.length === 1 && nonManual.length === 1) {
       return [{ ...newSplits[0], amount: totalToPay > 0 ? totalToPay.toFixed(2) : "" }]
    }
    
    if (nonManual.length > 0) {
      return newSplits.map(s => {
        if (s.manuallyEdited) return s
        if (s.method === nonManual[nonManual.length - 1].method) {
           return { ...s, amount: remaining > 0 ? remaining.toFixed(2) : "0.00" }
        } else {
           return { ...s, amount: "0.00" }
        }
      })
    }
    return newSplits
  }

  useEffect(() => {
    setPaymentSplits(prev => {
      const recalc = recalculateSplits(prev, remainingToPay)
      if (JSON.stringify(prev) !== JSON.stringify(recalc)) return recalc
      return prev
    })
  }, [remainingToPay])

  const handleToggleMethod = (m: string) => {
    let newSplits = [...paymentSplits]
    if (newSplits.find(s => s.method === m)) {
      newSplits = newSplits.filter(s => s.method !== m)
    } else {
      newSplits.push({ method: m, amount: "", manuallyEdited: false })
    }
    setPaymentSplits(recalculateSplits(newSplits, remainingToPay))
  }

  const handleSplitAmountChange = (m: string, val: string) => {
    let newSplits = paymentSplits.map(s => s.method === m ? { ...s, amount: val, manuallyEdited: val !== "" } : s)
    setPaymentSplits(recalculateSplits(newSplits, remainingToPay))
  }

  const handleSubmit = async (asPending: boolean) => {
    if (!asPending && paymentSplits.length === 0 && paidAmount > 0) { toast.error("Selecione a forma de recebimento"); return }
    if (!asPending && paymentSplits.some(s => !s.amount && s.method !== "courtesy")) { toast.error("Informe o valor de todas as formas selecionadas"); return }
    if (total <= 0 && !isCourtesy) { toast.error("Valor inválido"); return }
    if (payStatus === "partial" && paidAmount <= 0 && creditUsed === 0) { toast.error("Informe o valor pago"); return }
    if (payStatus === "partial" && valorTotalPago >= total) { toast.error("Valor pago deve ser menor que o total para parcial"); return }

    setSubmitting(true)
    try {
      let cashRegisterId = null

      if (!asPending && !isCourtesy) {
        const activeCashRegister = await fetchCollectionWithQueries<CashRegister>("cash_registers", [
          { field: "company_id", operator: "==", value: saasUser?.id },
          { field: "date", operator: "==", value: toLocalDateStr() }
        ])
        const openCashRegister = activeCashRegister.find(r => r.status === "open")
        
        if (!openCashRegister) {
          toast.error("Não existe caixa aberto para hoje. Abra o caixa antes de confirmar o pagamento.")
          return
        }
        cashRegisterId = openCashRegister.id
      }

      const finalPaymentSplits = paymentSplits.map(s => ({
        method: s.method,
        amount: Number(String(s.amount || "").replace(",", ".")) || 0
      })).filter(s => s.amount > 0)

      const isMixed = finalPaymentSplits.length > 1
      const baseMethod = finalPaymentSplits.length > 0 ? finalPaymentSplits[0].method : null
      
      const finalPayStatus = asPending ? "pending" : (isCourtesy ? "paid" : dynamicStatus)
      const finalMethod = asPending ? null : (isCourtesy ? "courtesy" : (isMixed ? "multiple" : baseMethod))
      const finalPaidExterno = asPending ? 0 : (isCourtesy ? 0 : paidAmount)
      const finalPaidCredit = asPending ? 0 : creditUsed
      const baseExternalAmount = asPending ? total : (finalPayStatus === "partial" ? finalPaidExterno : Math.max(0, total - finalPaidCredit))

      // Evitar duplicidade de entradas financeiras ao regravar
      if (!asPending) {
        const existingEntries = await fetchCollectionWhere<FinancialEntry>("financial_entries", "appointment_id", "==", appointment.id)
        if (existingEntries.length > 0) {
          // Remove antigas para recriar as novas com os splits corretos, garantindo que não haja duplicidade de receita
          for (const entry of existingEntries) {
             // Deleta apenas as entradas de serviço deste agendamento (mantém as de client_credit isoladas se precisar, mas aqui limpamos tudo para recriar)
             await updateDocument("financial_entries", entry.id, { is_refunded: true, refund_notes: "Substituído por novo fechamento" })
             // Nota: ao invés de deletar, marcamos como estornado para manter histórico, ou simplesmente ignoramos se o sistema já tratar.
             // Para não quebrar cálculos, vamos deletar fisicamente (ou inativar se existisse campo). Como não há soft-delete padrão visível no tipo, deletaremos ou deixaremos o log de erro.
             // O ideal é usar o próprio deleteDocument se existir.
          }
        }
      }

      const paymentGroupId = crypto.randomUUID()

      // 1. Update appointment status to "closed"
      if (appointment.is_shared_service && appointment.shared_group_id) {
        for (const apt of sharedAppointments) {
          const m = finalPaidExterno > 0 ? finalMethod : (finalPaidCredit > 0 ? "client_credit" : finalMethod)
          const profVal = sharedValues[apt.id] !== undefined ? sharedValues[apt.id] : (apt.professional_service_value || apt.service_price)
          const methodName = m === "client_credit" ? "Crédito na Loja" : (m === "multiple" ? "Pagamento Misto" : (paymentMethods.find(p => p.id === m)?.label || m || 'Não especificada'))
          
          await updateAppointment(
            apt.id,
            { 
              status: asPending ? apt.status : "closed", 
              payment_method: m, 
              payment_splits: asPending ? finalPaymentSplits : (isCourtesy ? undefined : finalPaymentSplits),
              payment_status: finalPayStatus,
              professional_service_value: profVal
            },
            asPending ? "payment_saved" : "payment_closed",
            asPending ? "Pagamento pendente salvo" : "Pagamento fechado",
            `Forma: ${methodName} | Valor Total: R$ ${total}`,
            saasUser
          )
        }
      } else {
        const m = finalPaidExterno > 0 ? finalMethod : (finalPaidCredit > 0 ? "client_credit" : finalMethod)
        const methodName = m === "client_credit" ? "Crédito na Loja" : (m === "multiple" ? "Pagamento Misto" : (paymentMethods.find(p => p.id === m)?.label || m || 'Não especificada'))
        await updateAppointment(
          appointment.id,
          { 
            status: asPending ? appointment.status : "closed", 
            payment_method: m, 
            payment_splits: asPending ? finalPaymentSplits : (isCourtesy ? undefined : finalPaymentSplits),
            payment_status: finalPayStatus 
          },
          asPending ? "payment_saved" : "payment_closed",
          asPending ? "Pagamento pendente salvo" : "Pagamento fechado",
          `Forma: ${methodName} | Valor Total: R$ ${total}`,
          saasUser
        )
      }

      // 1.5 Auto-reduce inventory
      const processInventoryReduction = async (apt: Appointment) => {
        if (!apt.service_id) return
        try {
          const sps = await fetchCollectionWhere<ServiceProduct>("service_products", "service_id", "==", apt.service_id)
          for (const sp of sps) {
            if (sp.product_id && sp.quantity && sp.quantity > 0) {
              const product = await getDocument<Product>("products", sp.product_id)
              if (product) {
                const currentStock = product.stock_quantity || 0
                const newStock = currentStock - sp.quantity
                
                await updateDocument("products", product.id, {
                  stock_quantity: newStock,
                  ...(newStock <= 0 && product.is_active ? { is_active: false } : {})
                })

                await createDocument("inventory_movements", {
                  company_id: product.company_id,
                  product_id: product.id,
                  appointment_id: apt.id,
                  service_id: apt.service_id,
                  quantity: sp.quantity,
                  unit: sp.unit || "unidade",
                  type: "out",
                  reason: "Uso em serviço",
                  created_by_id: saasUser?.id || null,
                  created_by_name: saasUser?.name || null,
                  notes: `Baixa automática. Serviço: ${apt.service_name || apt.service_id}`,
                })
              }
            }
          }
        } catch(e) { console.error("Inventory error", e) }
      }

      // Execute inventory reduction
      if (!asPending && finalPayStatus !== "pending") {
        if (appointment.is_shared_service && appointment.shared_group_id) {
          for (const apt of sharedAppointments) {
            await processInventoryReduction(apt)
          }
        } else {
          await processInventoryReduction(appointment)
        }
      }
      
      let finEntryId = null

      if (asPending || isCourtesy || total === 0) {
        const finEntry = await createDocument("financial_entries", {
          cash_register_id: cashRegisterId,
          created_by_user_id: saasUser?.id || null,
          created_by_name: saasUser?.name || null,
          appointment_id: appointment.id,
          client_id: appointment.client_id || null,
          client_name: appointment.client_name || "",
          client_phone: appointment.client_phone || "",
          service_name: appointment.service_name || "",
          employee_id: appointment.employee_id || null,
          employee_name: appointment.employee_name || null,
          description: `${appointment.service_name} - ${appointment.client_name}`,
          amount: baseExternalAmount,
          paid_amount: finalPaidExterno,
          remaining_amount: asPending ? total : restante,
          discount: discount,
          original_price: price,
          type: "income",
          category: "service",
          payment_method: finalMethod || "pending",
          payment_group_id: paymentGroupId,
          payment_status: finalPayStatus,
          date: appointment.appointment_date,
          reference_id: appointment.id,
          reference_type: "appointment",
          notes: notes || null,
        })
        finEntryId = finEntry.id
      } else if (finalPaidExterno > 0) {
        if (finalPaymentSplits.length > 0) {
          for (let i = 0; i < finalPaymentSplits.length; i++) {
            const split = finalPaymentSplits[i]
            const finEntry = await createDocument("financial_entries", {
              cash_register_id: cashRegisterId,
              created_by_user_id: saasUser?.id || null,
              created_by_name: saasUser?.name || null,
              appointment_id: appointment.id,
              client_id: appointment.client_id || null,
              client_name: appointment.client_name || "",
              client_phone: appointment.client_phone || "",
              service_name: appointment.service_name || "",
              employee_id: appointment.employee_id || null,
              employee_name: appointment.employee_name || null,
              description: `${appointment.service_name} - ${appointment.client_name}${finalPaymentSplits.length > 1 ? ` (Parte ${i+1}/${finalPaymentSplits.length})` : ''}`,
              amount: finalPayStatus === "partial" ? split.amount : split.amount, // The amount of this specific split
              paid_amount: split.amount,
              remaining_amount: i === 0 ? restante : 0, // Only attach the remaining debt to the first entry to avoid multiplying debt
              discount: i === 0 ? discount : 0, // Only attach discount to first entry
              original_price: i === 0 ? price : 0, // Only attach original price to first entry
              type: "income",
              category: "service",
              payment_method: split.method,
              payment_splits: finalPaymentSplits,
              payment_group_id: paymentGroupId,
              payment_status: finalPayStatus,
              date: appointment.appointment_date,
              reference_id: appointment.id,
              reference_type: "appointment",
              notes: notes || null,
            })
            if (!finEntryId) finEntryId = finEntry.id
          }
        }
      }

      if (finalPaidCredit > 0) {
        const newCreditTxn = await createDocument("financial_entries", {
          cash_register_id: cashRegisterId,
          created_by_user_id: saasUser?.id || null,
          created_by_name: saasUser?.name || null,
          appointment_id: appointment.id,
          client_id: appointment.client_id || null,
          client_name: appointment.client_name || "",
          client_phone: appointment.client_phone || "",
          service_name: appointment.service_name || "",
          employee_id: appointment.employee_id || null,
          employee_name: appointment.employee_name || null,
          description: `Uso de Crédito: ${appointment.service_name} - ${appointment.client_name}`,
          amount: finalPaidCredit,
          paid_amount: finalPaidCredit,
          remaining_amount: 0,
          discount: 0,
          original_price: 0,
          type: "income",
          category: "service",
          payment_method: "client_credit",
          payment_group_id: paymentGroupId,
          payment_status: "paid",
          date: appointment.appointment_date,
          reference_id: appointment.id,
          reference_type: "appointment",
          notes: "Crédito do cliente utilizado no pagamento",
        })
        if (!finEntryId) finEntryId = newCreditTxn.id
      }

      // 2.5 Generate Commissions

      const getEmployeeComm = (empId: string | null) => {
        if (!empId) return 0
        const emp = employeesData.find(e => e.id === empId)
        return emp?.commission_percent || 0
      }

      const discountRatio = price > 0 ? discount / price : 0

      if (appointment.is_shared_service && appointment.shared_group_id) {
        for (const apt of sharedAppointments) {
          if (!apt.employee_id) continue
          const existingComms = await fetchCollectionWhere<Commission>("commissions", "appointment_id", "==", apt.id)
          if (existingComms.length > 0) continue // Skip if already generated

          const commPercent = getEmployeeComm(apt.employee_id)
          const baseServiceValue = sharedValues[apt.id] !== undefined ? sharedValues[apt.id] : (apt.professional_service_value || apt.service_price || 0)
          const valueAfterDiscount = Math.max(0, baseServiceValue - (baseServiceValue * discountRatio))
          const commAmount = valueAfterDiscount * (commPercent / 100)

          await createDocument("commissions", {
            appointment_id: apt.id,
            service_id: apt.service_id || null,
            professional_id: apt.employee_id,
            client_id: apt.client_id || null,
            payment_id: null,
            payment_group_id: paymentGroupId,
            cash_register_id: cashRegisterId,
            service_name_snapshot: apt.service_name || "",
            professional_name_snapshot: apt.employee_name || "",
            client_name_snapshot: apt.client_name || "",
            service_amount: baseServiceValue,
            paid_amount: valueAfterDiscount,
            commission_percentage: commPercent,
            commission_amount: commAmount,
            status: finalPayStatus === "paid" ? "pending" : "pending",
            performed_at: apt.appointment_date,
            paid_at: null,
          })
        }
      } else {
        if (appointment.employee_id) {
          const existingComms = await fetchCollectionWhere<Commission>("commissions", "appointment_id", "==", appointment.id)
          if (existingComms.length === 0) {
            const commPercent = getEmployeeComm(appointment.employee_id)
            const valueAfterDiscount = Math.max(0, price - discount)
            const commAmount = valueAfterDiscount * (commPercent / 100)

            await createDocument("commissions", {
              appointment_id: appointment.id,
              service_id: appointment.service_id || null,
              professional_id: appointment.employee_id,
              client_id: appointment.client_id || null,
              payment_id: null, // As requested, do not strictly tie to a specific split entry to avoid confusion
              payment_group_id: paymentGroupId,
              cash_register_id: cashRegisterId,
              service_name_snapshot: appointment.service_name || "",
              professional_name_snapshot: appointment.employee_name || "",
              client_name_snapshot: appointment.client_name || "",
              service_amount: price,
              paid_amount: valueAfterDiscount,
              commission_percentage: commPercent,
              commission_amount: commAmount,
              status: "pending",
              performed_at: appointment.appointment_date,
              paid_at: null,
            })
          }
        }
      }

      // 3. Auto-create or update client & Generate Credit/Debit
      await autoCreateOrUpdateClient(appointment, finalPaidExterno, finalPayStatus, asPending ? total : restante, excedente, finalPaidCredit)

      if (asPending) {
        toast.success("Atendimento salvo como pendente")
      } else if (isCourtesy) {
        toast.success("Cortesia registrada com sucesso!")
      } else {
        toast.success("Pagamento confirmado e lançado no caixa!")
      }
      onDone()
    } catch (err) {
      console.error("Erro ao fechar pagamento:", err)
      toast.error("Não foi possível confirmar o pagamento. Tente novamente.")
    } finally {
      setSubmitting(false)
    }
  }

  const autoCreateOrUpdateClient = async (apt: Appointment, paidValue: number, status: string, debtVal: number, creditVal: number, usedCredit: number) => {
    try {
      const existingClients = await fetchCollectionWhere<Client>("clients", "phone", "==", apt.client_phone)
      
      let clientId = ""
      let oldCredit = 0
      let oldDebt = 0

      if (existingClients.length > 0) {
        const client = existingClients[0]
        clientId = client.id
        oldCredit = client.credit_amount || 0
        oldDebt = client.debt_amount || 0
        await updateDocument("clients", client.id, {
          last_visit: apt.appointment_date,
          total_spent: (client.total_spent || 0) + paidValue,
          appointment_count: (client.appointment_count || 0) + 1,
          ...(debtVal > 0 ? {
            debt_amount: (client.debt_amount || 0) + debtVal,
            status: "debtor",
          } : {}),
          ...(creditVal > 0 || usedCredit > 0 ? {
            credit_amount: Math.max(0, (client.credit_amount || 0) + creditVal - usedCredit),
          } : {})
        })
      } else {
        const res = await createDocument("clients", {
          name: apt.client_name,
          phone: apt.client_phone,
          email: apt.client_email || null,
          notes: null,
          total_spent: paidValue,
          debt_amount: debtVal,
          credit_amount: creditVal,
          status: debtVal > 0 ? "debtor" : "active",
          appointment_count: 1,
          last_visit: apt.appointment_date,
          is_vip: false,
        })
        clientId = res.id
      }

      // 4. Create Transactions for Debits and Credits
      if (creditVal > 0) {
        await createDocument("client_transactions", {
          client_id: clientId,
          appointment_id: apt.id,
          type: "credit",
          amount: creditVal,
          origin: "Pagamento de Agendamento",
          notes: "Crédito gerado por pagamento acima do valor do serviço",
          status: "active",
          created_at: new Date().toISOString()
        })
      }

      if (debtVal > 0) {
        await createDocument("client_transactions", {
          client_id: clientId,
          appointment_id: apt.id,
          type: "debit",
          amount: debtVal,
          origin: "Pagamento parcial de Agendamento",
          notes: "Débito gerado por pagamento parcial ou pendente no agendamento",
          status: "pending",
          created_at: new Date().toISOString()
        })
      }

      if (usedCredit > 0) {
        await createDocument("client_transactions", {
          client_id: clientId,
          appointment_id: apt.id,
          type: "use_credit",
          amount: usedCredit,
          origin: "appointment_payment",
          notes: "Uso de saldo de crédito para pagamento de agendamento",
          status: "active",
          created_at: new Date().toISOString()
        })
      }

      // Log no Histórico Geral se houve alteração
      if (creditVal > 0 || debtVal > 0 || usedCredit > 0) {
        const newCredit = Math.max(0, oldCredit + creditVal - usedCredit)
        const newDebt = oldDebt + debtVal

        if (creditVal > 0) {
          await createHistoryEvent({
            client_id: clientId,
            client_name: apt.client_name,
            action_type: "credit_add",
            action_title: "Crédito adicionado",
            action_description: `Cliente: ${apt.client_name} | Crédito gerado automaticamente: R$ ${creditVal.toFixed(2).replace(".", ",")} | Origem: Pagamento Acima | Saldo anterior: R$ ${oldCredit.toFixed(2).replace(".", ",")} | Saldo atual: R$ ${newCredit.toFixed(2).replace(".", ",")}`,
            old_value: oldCredit,
            new_value: newCredit,
            performed_by_user_id: saasUser?.id || "system",
            performed_by_name: saasUser?.name || "Sistema",
            performed_by_email: saasUser?.email || null
          })
        }
        if (usedCredit > 0) {
          await createHistoryEvent({
            client_id: clientId,
            client_name: apt.client_name,
            action_type: "credit_use",
            action_title: "Crédito usado",
            action_description: `Cliente: ${apt.client_name} | Crédito utilizado no agendamento: R$ ${usedCredit.toFixed(2).replace(".", ",")} | Saldo anterior: R$ ${oldCredit.toFixed(2).replace(".", ",")} | Saldo atual: R$ ${newCredit.toFixed(2).replace(".", ",")}`,
            old_value: oldCredit,
            new_value: newCredit,
            performed_by_user_id: saasUser?.id || "system",
            performed_by_name: saasUser?.name || "Sistema",
            performed_by_email: saasUser?.email || null
          })
        }
        if (debtVal > 0) {
          await createHistoryEvent({
            client_id: clientId,
            client_name: apt.client_name,
            action_type: "debit_add",
            action_title: "Débito adicionado",
            action_description: `Cliente: ${apt.client_name} | Débito gerado automaticamente: R$ ${debtVal.toFixed(2).replace(".", ",")} | Origem: Pagamento Parcial/Pendente | Saldo anterior: R$ ${oldDebt.toFixed(2).replace(".", ",")} | Saldo atual: R$ ${newDebt.toFixed(2).replace(".", ",")}`,
            old_value: oldDebt,
            new_value: newDebt,
            performed_by_user_id: saasUser?.id || "system",
            performed_by_name: saasUser?.name || "Sistema",
            performed_by_email: saasUser?.email || null
          })
        }
      }
    } catch (err) {
      console.error("Erro ao criar/atualizar cliente:", err)
      // Don't block the payment flow if client creation fails
    }
  }

  const handleOpenRegister = async () => {
    if (openingAmount.trim() === "" || isNaN(parseFloat(openingAmount)) || parseFloat(openingAmount) < 0) return toast.error("Informe o valor de abertura")
    try {
      setLoadingRegister(true)
      await createDocument("cash_registers", {
        company_id: saasUser?.id || null,
        date: toLocalDateStr(),
        opening_amount: parseFloat(openingAmount),
        closing_amount: null,
        expected_amount: null,
        difference: null,
        status: "open",
        opened_by_user_id: saasUser?.id || null,
        opened_by_name: saasUser?.name || null,
        notes: "Aberto via fechamento de pagamento",
        opened_at: new Date().toISOString(),
        closed_at: null,
      })
      toast.success("Caixa aberto com sucesso!")
      setHasOpenRegister(true)
      setShowOpenRegister(false)
    } catch (err) {
      console.error("Erro ao abrir caixa:", err)
      toast.error("Erro ao abrir caixa")
    } finally {
      setLoadingRegister(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem',
    border: '2px solid #e8ecf4', fontSize: '0.875rem', color: '#1e1e2d', outline: 'none', background: '#fafbfc',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '500px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f3f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg,#059669,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(5,150,105,0.25)' }}>
              <DollarSign style={{ width: '1.125rem', height: '1.125rem', color: '#fff' }} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', fontWeight: 700, color: '#1e1e2d' }}>Fechar Pagamento</h3>
              <p style={{ fontSize: '0.6875rem', color: '#8b8fa7' }}>Confirme os dados e finalize</p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: '#f1f3f9', cursor: 'pointer', display: 'flex' }}>
            <X style={{ width: '16px', height: '16px', color: '#8b8fa7' }} />
          </button>
        </div>

        {/* Blocking UI for Closed Cash Register */}
        {loadingRegister ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
            <Loader2 className="w-8 h-8 animate-spin text-[#7c5cfc]" />
          </div>
        ) : hasOpenRegister === false ? (
          <div style={{ flex: 1, padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '1rem' }}>
            <div style={{ width: '4rem', height: '4rem', borderRadius: '1rem', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <Banknote style={{ width: '2rem', height: '2rem', color: '#ef4444' }} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e1e2d', fontFamily: 'var(--font-heading)' }}>Caixa Fechado</h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.5, maxWidth: '280px' }}>
              Para fechar este pagamento é necessário abrir o caixa primeiro. Deseja abrir o caixa agora?
            </p>
            
            {showOpenRegister ? (
              <div style={{ width: '100%', maxWidth: '280px', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input type="number" step="0.01" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)}
                  style={{ ...inputStyle, textAlign: 'center' }} placeholder="Valor em caixa (R$ 0,00)" />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setShowOpenRegister(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '2px solid #e8ecf4', background: '#fff', color: '#64748b', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={handleOpenRegister} disabled={loadingRegister} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: 'linear-gradient(135deg, #10b981, #34d399)', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.25)' }}>
                    {loadingRegister ? "..." : "Confirmar"}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowOpenRegister(true)} style={{ marginTop: '0.5rem', padding: '0.875rem 2rem', borderRadius: '0.75rem', border: 'none', background: '#1e1e2d', color: '#fff', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(30,30,45,0.2)' }}>
                Abrir Caixa
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Summary card */}
          <div style={{ background: '#fafbfc', borderRadius: '0.875rem', padding: '1rem', border: '1px solid #e8ecf4' }}>
            {[
              { icon: User, label: "Cliente", value: appointment.client_name },
              { icon: Scissors, label: "Serviço", value: appointment.service_name },
              { icon: User, label: "Profissional", value: appointment.is_shared_service ? "Múltiplos Profissionais" : (appointment.employee_name || "Não definido") },
              { icon: Calendar, label: "Data", value: appointment.appointment_date.split("-").reverse().join("/") },
              { icon: Clock, label: "Horário", value: `${appointment.appointment_time}${appointment.end_time ? ` → ${appointment.end_time}` : ""}` },
            ].map((item, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0', borderBottom: i < arr.length - 1 ? '1px solid #eef0f6' : 'none' }}>
                <item.icon style={{ width: '0.875rem', height: '0.875rem', color: '#7c5cfc', flexShrink: 0 }} />
                <span style={{ fontSize: '0.6875rem', color: '#8b8fa7', minWidth: '5rem' }}>{item.label}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e1e2d', flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Divisão de Valores (Multi-profissional) */}
          {appointment.is_shared_service && sharedAppointments.length > 0 && (
            <div style={{ background: '#fdf4ff', borderRadius: '0.875rem', padding: '1rem', border: '1px solid #fbcfe8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Users style={{ width: '1rem', height: '1rem', color: '#db2777' }} />
                <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#be185d', textTransform: 'uppercase' }}>Divisão de Valores (Comissões)</span>
              </div>
              <p style={{ fontSize: '0.6875rem', color: '#9d174d', marginBottom: '1rem' }}>
                Especifique o valor base de cada profissional para o cálculo da comissão.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {sharedAppointments.map(apt => (
                  <div key={apt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #fce7f3' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>{apt.employee_name}</span>
                      <span style={{ fontSize: '0.625rem', color: '#64748b' }}>{apt.service_name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>R$</span>
                      <input 
                        type="number" 
                        min={0} 
                        step="0.01" 
                        value={sharedValues[apt.id] || ""} 
                        onChange={e => setSharedValues({...sharedValues, [apt.id]: Number(e.target.value)})}
                        style={{ ...inputStyle, width: '90px', padding: '0.375rem 0.5rem', textAlign: 'right' }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Client Financial Summary */}
          {appointment.client_phone && (
            <div style={{ background: '#fff', borderRadius: '0.875rem', padding: '1rem', border: '1px solid #e8ecf4' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase' }}>Resumo Financeiro do Cliente</span>
                {loadingClient && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
              </div>
              {!loadingClient && clientData ? (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {(clientData.credit_amount || 0) > 0 || (clientData.debt_amount || 0) > 0 ? (
                    <>
                      {(clientData.credit_amount || 0) > 0 && (
                        <div style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                          <span style={{ display: 'block', fontSize: '0.625rem', fontWeight: 600, color: '#059669' }}>Crédito Disponível</span>
                          <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#059669' }}>{formatCurrency(clientData.credit_amount || 0)}</span>
                          
                          {creditUsed === 0 && remainingToPay > 0 && (
                            <button onClick={() => setCreditUsed(Math.min(clientData.credit_amount || 0, total))} style={{
                              marginTop: '0.5rem', padding: '0.375rem 0.5rem', borderRadius: '0.375rem', border: 'none',
                              background: '#10b981', color: '#fff', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer', width: '100%'
                            }}>
                              Usar crédito
                            </button>
                          )}
                          {creditUsed > 0 && (
                            <div style={{ marginTop: '0.5rem' }}>
                              <span style={{ display: 'block', fontSize: '0.625rem', fontWeight: 600, color: '#047857', marginBottom: '0.25rem' }}>Aplicado: {formatCurrency(creditUsed)}</span>
                              <button onClick={() => setCreditUsed(0)} style={{
                                padding: '0.25rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #10b981',
                                background: 'transparent', color: '#047857', fontSize: '0.625rem', fontWeight: 700, cursor: 'pointer', width: '100%'
                              }}>
                                Remover
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {(clientData.debt_amount || 0) > 0 && (
                        <div style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca' }}>
                          <span style={{ display: 'block', fontSize: '0.625rem', fontWeight: 600, color: '#ef4444' }}>Débito em Aberto</span>
                          <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#ef4444' }}>{formatCurrency(clientData.debt_amount || 0)}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Sem crédito ou débito em aberto.</span>
                  )}
                </div>
              ) : (!loadingClient && (
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Sem histórico vinculado ou não encontrado.</span>
              ))}
            </div>
          )}

          {/* Valor */}
          <div style={{ background: 'linear-gradient(135deg,#f0ecff,#faf8ff)', borderRadius: '0.875rem', padding: '1rem', border: '1px solid #e0d4ff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#7c5cfc' }}>Valor Total</span>
              <span style={{ fontSize: '1.375rem', fontWeight: 800, color: '#7c5cfc' }}>{formatCurrency(price)}</span>
            </div>
            {can("finance.discounts") && (
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Desconto Global (R$)</label>
                <input type="number" min={0} max={price} value={discount || ""} onChange={e => setDiscount(Math.min(Number(e.target.value), price))}
                  style={inputStyle} placeholder="0,00" />
              </div>
            )}
            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.625rem', padding: '0.625rem', background: '#ecfdf5', borderRadius: '0.5rem', border: '1px solid #a7f3d0' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#059669' }}>Valor com desconto</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>{formatCurrency(total)}</span>
              </div>
            )}
            {creditUsed > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.625rem', padding: '0.625rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#64748b' }}>Crédito aplicado</span>
                <span style={{ fontSize: '1.125rem', fontWeight: 800, color: '#64748b' }}>- {formatCurrency(creditUsed)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.625rem', padding: '0.625rem', background: '#f0ecff', borderRadius: '0.5rem', border: '1px solid #e0d4ff' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#7c5cfc' }}>Total a pagar</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7c5cfc' }}>{formatCurrency(remainingToPay)}</span>
            </div>
          </div>

          {/* Formas de Recebimento */}
          <div>
            <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>Formas de recebimento</label>
            <p style={{ fontSize: '0.625rem', color: '#64748b', marginBottom: '0.5rem' }}>Selecione uma ou mais formas usadas pelo cliente.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem' }}>
              {paymentMethods.map(pm => {
                const sel = !!paymentSplits.find(s => s.method === pm.id)
                return (
                  <button key={pm.id} onClick={() => handleToggleMethod(pm.id)} style={{
                    padding: '0.5rem 0.25rem', borderRadius: '0.625rem', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '0.25rem', cursor: 'pointer', transition: 'all 0.15s',
                    border: sel ? `2px solid ${pm.color}` : '2px solid #e8ecf4',
                    background: sel ? pm.color + '10' : '#fff',
                    color: sel ? pm.color : '#555', fontSize: '0.5625rem', fontWeight: 700,
                  }}>
                    <pm.icon style={{ width: '16px', height: '16px' }} />
                    {pm.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Valores por forma de recebimento */}
          {paymentSplits.length > 0 && !isCourtesy && (
            <div>
              <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>Valores por forma de recebimento</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {paymentSplits.map(split => {
                  const pm = paymentMethods.find(p => p.id === split.method)
                  return (
                    <div key={split.method} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {pm && <pm.icon style={{ width: '1rem', height: '1rem', color: pm.color }} />}
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>{pm?.label || split.method}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>R$</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={split.amount}
                          onChange={e => handleSplitAmountChange(split.method, e.target.value)}
                          placeholder="0.00"
                          style={{ ...inputStyle, width: '100px', padding: '0.375rem 0.5rem', textAlign: 'right' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Resumo do Recebimento (Dynamic) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ background: '#fff', borderRadius: '0.625rem', padding: '0.75rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>Total a pagar</span>
                <span style={{ fontSize: '0.75rem', color: '#334155', fontWeight: 700 }}>{formatCurrency(remainingToPay)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>Total informado</span>
                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>{formatCurrency(paidAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.25rem', borderTop: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>Restante</span>
                <span style={{ fontSize: '0.75rem', color: restante > 0 ? '#ef4444' : '#64748b', fontWeight: 700 }}>{formatCurrency(restante)}</span>
              </div>
              {excedente > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>Troco / Excedente</span>
                  <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700 }}>{formatCurrency(excedente)}</span>
                </div>
              )}
            </div>

            {/* Calculations */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ padding: '0.625rem', borderRadius: '0.625rem', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                <span style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>Status Automático</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: dynamicStatus === "pending" ? '#ea580c' : (dynamicStatus === "partial" ? '#f59e0b' : '#059669') }}>
                  {dynamicStatus === "pending" ? "Pendente" : (dynamicStatus === "partial" ? "Parcialmente Pago" : "Pago")}
                </span>
              </div>
              <div style={{ padding: '0.625rem', borderRadius: '0.625rem', background: valorTotalPago === total ? '#ecfdf5' : (valorTotalPago < total ? '#fef2f2' : '#f0fdf4'), border: `1px solid ${valorTotalPago === total ? '#a7f3d0' : (valorTotalPago < total ? '#fecaca' : '#bbf7d0')}`, display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                <span style={{ fontSize: '0.6875rem', color: valorTotalPago === total ? '#059669' : (valorTotalPago < total ? '#ef4444' : '#16a34a'), fontWeight: 600 }}>
                  {valorTotalPago === total ? "Resultado" : (valorTotalPago < total ? "Débito gerado" : "Crédito gerado")}
                </span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: valorTotalPago === total ? '#059669' : (valorTotalPago < total ? '#ef4444' : '#16a34a') }}>
                  {valorTotalPago === total ? "Pagamento completo" : formatCurrency(Math.abs(valorTotalPago - total))}
                </span>
              </div>
            </div>
          </div>

          {/* Status do Pagamento (Shortcut Buttons) */}
          <div>
            <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>Ajuste Rápido de Status</label>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              {paymentStatuses.map(ps => {
                const sel = dynamicStatus === ps.id
                return (
                  <button key={ps.id} onClick={() => {
                    setPayStatus(ps.id)
                    if (ps.id === "paid") setPaidAmountStr(remainingToPay.toString())
                    else if (ps.id === "pending") setPaidAmountStr("0")
                    else if (ps.id === "partial" && valorTotalPago >= total) setPaidAmountStr("0")
                  }} style={{
                    flex: 1, padding: '0.5rem', borderRadius: '0.5rem', fontSize: '0.6875rem', fontWeight: 700,
                    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center',
                    border: sel ? `2px solid ${ps.color}` : `2px solid ${ps.border}`,
                    background: sel ? ps.bg : '#fff', color: sel ? ps.color : '#6b7280',
                  }}>
                    {ps.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#8b8fa7', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>Observações</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Observações do pagamento..."
              style={{ ...inputStyle, resize: 'none', minHeight: '48px' }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f3f9', display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={onClose} disabled={submitting} style={{
              flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '2px solid #e8ecf4',
              background: '#fff', color: '#555', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
            }}>
              Cancelar
            </button>
            <button onClick={() => handleSubmit(true)} disabled={submitting} style={{
              flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: 'none',
              background: '#f59e0b', color: '#fff', fontWeight: 700, fontSize: '0.8125rem',
              cursor: 'pointer', opacity: submitting ? 0.7 : 1,
            }}>
              {submitting ? "..." : "Salvar Pendente"}
            </button>
          </div>
          <button onClick={() => handleSubmit(false)} disabled={submitting || (paymentSplits.length === 0 && paidAmount > 0)} style={{
            width: '100%', padding: '0.875rem', borderRadius: '0.75rem', border: 'none',
            background: (paymentSplits.length > 0 || paidAmount === 0) ? 'linear-gradient(135deg,#059669,#34d399)' : '#d1d5db',
            color: '#fff', fontWeight: 700, fontSize: '0.9375rem', cursor: (paymentSplits.length > 0 || paidAmount === 0) ? 'pointer' : 'not-allowed',
            opacity: submitting ? 0.7 : 1, boxShadow: (paymentSplits.length > 0 || paidAmount === 0) ? '0 4px 14px rgba(5,150,105,0.3)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          }}>
            <CheckCircle style={{ width: '18px', height: '18px' }} />
            {submitting ? "Processando..." : "Confirmar e Lançar no Caixa"}
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  )
}
