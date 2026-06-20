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
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="bg-white px-4 py-4 flex items-center border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl text-gray-700 hover:bg-gray-100">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 ml-2">Créditos e Débitos</h1>
      </div>

      <div className="p-4 pb-24 space-y-6">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-8 h-8 rounded-full border-4 border-[var(--color-primary)] border-t-transparent animate-spin" />
          </div>
        ) : !client ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-200 mt-10">
            <h3 className="text-gray-900 font-bold mb-2">Cliente não encontrado</h3>
            <p className="text-sm text-gray-500">Ocorreu um erro ao buscar seus dados.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-20 text-emerald-500">
                  <TrendingUp className="w-12 h-12" />
                </div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Crédito</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.credit_amount || 0)}
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-red-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-20 text-red-500">
                  <TrendingDown className="w-12 h-12" />
                </div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Débito</p>
                <p className="text-2xl font-bold text-red-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.debt_amount || 0)}
                </p>
              </div>
            </div>

            <div className="pt-4">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-2 mb-4">Movimentações</h2>
              
              {transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.map((tx) => {
                    const isCredit = tx.type === "income" || tx.description?.toLowerCase().includes("crédito")
                    const isDebt = tx.type === "expense" || tx.description?.toLowerCase().includes("débito") || tx.description?.toLowerCase().includes("fiado")
                    
                    return (
                      <div key={tx.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isCredit ? "bg-emerald-50 text-emerald-600" : isDebt ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"
                          }`}>
                            {isCredit ? <TrendingUp className="w-4 h-4" /> : isDebt ? <TrendingDown className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm line-clamp-1">{tx.description || "Movimentação"}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1 font-medium">
                              <Clock className="w-3 h-3" />
                              {tx.created_at || tx.date ? format(new Date(tx.created_at || tx.date), "dd/MM/yyyy HH:mm") : "Data desconhecida"}
                            </p>
                          </div>
                        </div>
                        <p className={`font-bold text-sm whitespace-nowrap ml-2 ${
                           isCredit ? "text-emerald-600" : isDebt ? "text-red-600" : "text-gray-700"
                        }`}>
                          {isCredit ? "+" : isDebt ? "-" : ""}
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount || 0)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-200">
                  <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-sm text-gray-500">Nenhum histórico de movimentações financeiras encontrado.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
