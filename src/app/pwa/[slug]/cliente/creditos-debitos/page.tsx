"use client"

import { useEffect, useState } from "react"
import { usePWATenant } from "@/components/pwa/pwa-tenant-context"
import { fetchCollectionWhere } from "@/lib/firebase/client-utils"
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, Clock } from "lucide-react"
import { getDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { PwaCard } from "@/components/pwa/ui/pwa-card"
import { PwaEmptyState } from "@/components/pwa/ui/pwa-empty-state"
import { PwaStatCard } from "@/components/pwa/ui/pwa-stat-card"

export default function CreditosDebitos() {
  const { companyId, user, slug } = usePWATenant()
  const router = useRouter()
  const [client, setClient] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!companyId || !user?.uid) return
      setLoading(true)
      try {
        const clients = await fetchCollectionWhere("clients", "auth_uid", "==", user.uid)
        const myClient = clients.find((c: any) => c.company_id === companyId)
        
        if (myClient) {
          setClient(myClient)
          
          const db = getDb()
          const txRef = collection(db, "financial_transactions")
          const q = query(
            txRef,
            where("company_id", "==", companyId),
            where("client_id", "==", myClient.id)
          )
          const snap = await getDocs(q)
          const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          
          txs.sort((a: any, b: any) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())
          setTransactions(txs)
        }
      } catch (err) {
        console.error("Failed to load credits/debts:", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [companyId, user?.uid])

  return (
    <div className="flex flex-col h-full bg-[#F7F8FC]">
      <div className="bg-white px-4 py-4 flex items-center border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl text-[#111827] hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-[18px] font-bold text-[#111827] ml-2">Créditos e Débitos</h1>
      </div>

      <div className="p-5 pb-32 space-y-6">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-8 h-8 rounded-full border-4 border-[#7C5CFC] border-t-transparent animate-spin" />
          </div>
        ) : !client ? (
          <PwaCard className="bg-white rounded-2xl p-8 text-center border border-gray-200 mt-10">
            <PwaEmptyState 
              icon={Wallet}
              title="Cliente não encontrado"
              description="Ocorreu um erro ao buscar seus dados financeiros."
            />
          </PwaCard>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <PwaStatCard 
                title="Crédito"
                value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.credit_amount || 0)}
                icon={TrendingUp}
                colorClass="text-[#10B981]"
                bgClass="bg-[#10B981]/10"
              />

              <PwaStatCard 
                title="Débito"
                value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.debt_amount || 0)}
                icon={TrendingDown}
                colorClass="text-[#EF4444]"
                bgClass="bg-[#EF4444]/10"
              />
            </div>

            <div className="pt-2">
              <h2 className="text-[15px] font-bold text-[#111827] ml-1 mb-4">Movimentações</h2>
              
              {transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.map((tx) => {
                    const isCredit = tx.type === "income" || tx.description?.toLowerCase().includes("crédito")
                    const isDebt = tx.type === "expense" || tx.description?.toLowerCase().includes("débito") || tx.description?.toLowerCase().includes("fiado")
                    
                    return (
                      <PwaCard key={tx.id} className="flex items-center justify-between p-4">
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isCredit ? "bg-emerald-50 text-emerald-600" : isDebt ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-500"
                          }`}>
                            {isCredit ? <TrendingUp className="w-5 h-5" /> : isDebt ? <TrendingDown className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-bold text-[#111827] text-[14px] line-clamp-1">{tx.description || "Movimentação"}</p>
                            <p className="text-[12px] text-[#6B7280] mt-1 flex items-center gap-1 font-medium">
                              <Clock className="w-3.5 h-3.5" />
                              {tx.created_at || tx.date ? format(new Date(tx.created_at || tx.date), "dd/MM/yyyy HH:mm") : "Data desconhecida"}
                            </p>
                          </div>
                        </div>
                        <p className={`font-bold text-[15px] whitespace-nowrap ml-2 ${
                           isCredit ? "text-emerald-600" : isDebt ? "text-red-600" : "text-gray-700"
                        }`}>
                          {isCredit ? "+" : isDebt ? "-" : ""}
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount || 0)}
                        </p>
                      </PwaCard>
                    )
                  })}
                </div>
              ) : (
                <PwaCard className="bg-transparent shadow-none border-dashed border-2 border-gray-200">
                  <PwaEmptyState 
                    icon={Wallet}
                    title="Sem movimentações"
                    description="Nenhum histórico de movimentações financeiras encontrado."
                  />
                </PwaCard>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
