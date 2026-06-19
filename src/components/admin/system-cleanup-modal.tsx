"use client"

import { useState, useCallback } from "react"
import { getAuthInstance } from "@/lib/firebase/config"
import { toast } from "sonner"
import {
  X, AlertTriangle, Trash2, ChevronRight, ChevronLeft,
  Loader2, CheckCircle2, Shield, Download,
  Calendar, Users, Landmark, BarChart3, FileText,
  Package, Scissors, CreditCard, History, Ban,
} from "lucide-react"

// ===================== TYPES =====================

interface ModuleOption {
  key: string
  label: string
  icon: React.ReactNode
  description: string
  items: string[]
}

interface DependencyError {
  module: string
  moduleLabel: string
  requiredModules: { key: string; label: string }[]
  message: string
}

interface ModuleCount {
  total: number
  collections: Record<string, number>
}

interface Props {
  open: boolean
  onClose: () => void
}

// ===================== MODULE DEFINITIONS =====================

const MODULES: ModuleOption[] = [
  {
    key: "appointments",
    label: "Agendamentos",
    icon: <Calendar style={{ width: "1.125rem", height: "1.125rem" }} />,
    description: "Agendamentos, histórico, status e etiquetas",
    items: [
      "Todos os agendamentos",
      "Histórico de agendamentos",
      "Status, etiquetas e movimentações vinculadas",
    ],
  },
  {
    key: "clients",
    label: "Clientes",
    icon: <Users style={{ width: "1.125rem", height: "1.125rem" }} />,
    description: "Clientes, fotos, histórico, créditos e débitos",
    items: [
      "Cadastro de clientes",
      "Fotos dos clientes",
      "Histórico de atendimento",
      "Créditos e débitos",
    ],
  },
  {
    key: "cash",
    label: "Caixa / Financeiro",
    icon: <Landmark style={{ width: "1.125rem", height: "1.125rem" }} />,
    description: "Caixas, comandas, pagamentos e movimentações",
    items: [
      "Caixas abertos e fechados",
      "Pagamentos e entradas/saídas",
      "Movimentações financeiras",
    ],
  },
  {
    key: "reports",
    label: "Relatórios",
    icon: <BarChart3 style={{ width: "1.125rem", height: "1.125rem" }} />,
    description: "Dados gerados em relatórios (dinâmicos)",
    items: [
      "Dados de relatórios em tabelas próprias",
      "A funcionalidade de gerar relatórios será mantida",
    ],
  },
  {
    key: "invoices",
    label: "Notas Fiscais",
    icon: <FileText style={{ width: "1.125rem", height: "1.125rem" }} />,
    description: "Notas fiscais emitidas e histórico",
    items: [
      "Notas fiscais cadastradas/emitidas",
      "Histórico vinculado às notas",
    ],
  },
  {
    key: "inventory",
    label: "Estoque / Produtos",
    icon: <Package style={{ width: "1.125rem", height: "1.125rem" }} />,
    description: "Produtos, movimentações e vínculos",
    items: [
      "Produtos cadastrados",
      "Movimentações de estoque",
      "Entradas, saídas e baixas automáticas",
    ],
  },
  {
    key: "professionals",
    label: "Profissionais",
    icon: <Users style={{ width: "1.125rem", height: "1.125rem" }} />,
    description: "Profissionais, vínculos, horários e comissões",
    items: [
      "Profissionais cadastrados (exceto admins)",
      "Fotos e vínculos com serviços",
      "Horários, folgas e bloqueios",
    ],
  },
  {
    key: "services",
    label: "Serviços",
    icon: <Scissors style={{ width: "1.125rem", height: "1.125rem" }} />,
    description: "Serviços, categorias e vínculos",
    items: [
      "Serviços cadastrados",
      "Categorias de serviços",
      "Fotos e vínculos com profissionais/estoque",
    ],
  },
  {
    key: "commissions",
    label: "Comissões",
    icon: <CreditCard style={{ width: "1.125rem", height: "1.125rem" }} />,
    description: "Comissões geradas, acertos e histórico",
    items: [
      "Comissões geradas",
      "Acertos de comissão",
      "Histórico de pagamento de comissão",
    ],
  },
  {
    key: "history",
    label: "Histórico / Auditoria",
    icon: <History style={{ width: "1.125rem", height: "1.125rem" }} />,
    description: "Logs gerais do sistema e ações",
    items: [
      "Histórico geral do sistema",
      "Logs de ações e auditoria",
      "O registro da limpeza será mantido",
    ],
  },
]

// ===================== COMPONENT =====================

export default function SystemCleanupModal({ open, onClose }: Props) {
  const [step, setStep] = useState<"select" | "confirm" | "loading" | "success">("select")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmText, setConfirmText] = useState("")
  const [masterPassword, setMasterPassword] = useState("")
  const [previewCounts, setPreviewCounts] = useState<Record<string, ModuleCount> | null>(null)
  const [dependencyErrors, setDependencyErrors] = useState<DependencyError[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<any[] | null>(null)
  const [totalDeleted, setTotalDeleted] = useState(0)

  const resetState = useCallback(() => {
    setStep("select")
    setSelected(new Set())
    setConfirmText("")
    setMasterPassword("")
    setPreviewCounts(null)
    setDependencyErrors([])
    setLoadingPreview(false)
    setError(null)
    setResults(null)
    setTotalDeleted(0)
  }, [])

  const handleClose = () => {
    resetState()
    onClose()
  }

  const toggleModule = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setDependencyErrors([])
    setError(null)
  }

  const toggleAll = () => {
    if (selected.size === MODULES.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(MODULES.map((m) => m.key)))
    }
    setDependencyErrors([])
    setError(null)
  }

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const user = getAuthInstance().currentUser
      if (!user) return null
      return await user.getIdToken()
    } catch {
      return null
    }
  }

  // ===================== PREVIEW (Step 1 → Step 2) =====================

  const handleContinue = async () => {
    if (selected.size === 0) {
      setError("Selecione pelo menos uma área para limpar.")
      return
    }

    setLoadingPreview(true)
    setError(null)
    setDependencyErrors([])

    try {
      const token = await getAuthToken()
      if (!token) {
        setError("Sessão expirada. Faça login novamente.")
        setLoadingPreview(false)
        return
      }

      const response = await fetch("/api/settings/system-cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          selectedModules: Array.from(selected),
          preview: true,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.error === "DEPENDENCY_BLOCK" && data.dependencyErrors) {
          setDependencyErrors(data.dependencyErrors)
          setLoadingPreview(false)
          return
        }
        setError(data.message || "Erro ao carregar prévia.")
        setLoadingPreview(false)
        return
      }

      setPreviewCounts(data.counts || null)
      setStep("confirm")
    } catch (err: any) {
      setError("Erro de conexão. Tente novamente.")
    }

    setLoadingPreview(false)
  }

  // ===================== EXECUTE (Step 2 → Done) =====================

  const handleExecute = async () => {
    if (confirmText !== "APAGAR") {
      setError("Digite APAGAR para confirmar.")
      return
    }
    if (!masterPassword.trim()) {
      setError("Digite a senha master (nome do estabelecimento).")
      return
    }

    setStep("loading")
    setError(null)

    try {
      const token = await getAuthToken()
      if (!token) {
        setError("Sessão expirada. Faça login novamente.")
        setStep("confirm")
        return
      }

      const response = await fetch("/api/settings/system-cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          selectedModules: Array.from(selected),
          confirmationText: confirmText,
          masterPassword: masterPassword,
          preview: false,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || "Não foi possível concluir a limpeza. Verifique a senha master ou tente novamente.")
        setStep("confirm")
        return
      }

      setResults(data.results || [])
      setTotalDeleted(data.totalDeleted || 0)
      setStep("success")
      toast.success("Limpeza concluída com sucesso!")
    } catch {
      setError("Erro de conexão. Tente novamente.")
      setStep("confirm")
    }
  }

  if (!open) return null

  // ===================== STYLES =====================

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(6px)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem",
  }

  const modalStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: "1.25rem",
    width: "100%",
    maxWidth: "38rem",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 25px 60px -12px rgba(0,0,0,0.35)",
    overflow: "hidden",
  }

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "1.25rem 1.5rem",
    borderBottom: "1px solid #fee2e2",
    background: "linear-gradient(135deg, #fef2f2, #fff1f2)",
    flexShrink: 0,
  }

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: "1.5rem",
    scrollbarWidth: "thin",
  }

  const footerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "0.75rem",
    padding: "1rem 1.5rem",
    borderTop: "1px solid #f3f4f6",
    background: "#fafbfc",
    flexShrink: 0,
  }

  const btnCancel: React.CSSProperties = {
    padding: "0.625rem 1.25rem",
    borderRadius: "0.75rem",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
  }

  const btnPrimary: React.CSSProperties = {
    padding: "0.625rem 1.25rem",
    borderRadius: "0.75rem",
    border: "none",
    background: "linear-gradient(135deg, #7c5cfc, #a78bfa)",
    color: "#fff",
    fontSize: "0.875rem",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    boxShadow: "0 4px 14px rgba(124,92,252,0.3)",
  }

  const btnDanger: React.CSSProperties = {
    padding: "0.75rem 1.5rem",
    borderRadius: "0.75rem",
    border: "none",
    background: "linear-gradient(135deg, #dc2626, #ef4444)",
    color: "#fff",
    fontSize: "0.875rem",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    boxShadow: "0 4px 14px rgba(220,38,38,0.35)",
    width: "100%",
    justifyContent: "center",
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.75rem 1rem",
    borderRadius: "0.75rem",
    border: "2px solid #e2e8f0",
    backgroundColor: "#fff",
    color: "#1e1e2d",
    fontSize: "0.875rem",
    fontWeight: 500,
    outline: "none",
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "#374151",
    marginBottom: "0.375rem",
  }

  // ===================== RENDER: LOADING =====================

  if (step === "loading") {
    return (
      <div style={overlayStyle}>
        <div style={{ ...modalStyle, maxWidth: "28rem" }}>
          <div style={headerStyle}>
            <div style={{ width: "2.25rem", height: "2.25rem", borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #dc2626, #ef4444)", boxShadow: "0 4px 10px rgba(220,38,38,0.3)" }}>
              <Trash2 style={{ width: "1.125rem", height: "1.125rem", color: "#fff" }} />
            </div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#1e1e2d", fontFamily: "var(--font-heading)" }}>
              Limpando dados...
            </h2>
          </div>
          <div style={{ padding: "3rem 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem" }}>
            <Loader2 style={{ width: "2.5rem", height: "2.5rem", color: "#dc2626", animation: "spin 1s linear infinite" }} />
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "1rem", fontWeight: 600, color: "#1e1e2d", marginBottom: "0.375rem" }}>
                Limpando dados selecionados, aguarde...
              </p>
              <p style={{ fontSize: "0.8125rem", color: "#6b7280" }}>
                Não feche esta janela até a conclusão.
              </p>
            </div>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ===================== RENDER: SUCCESS =====================

  if (step === "success") {
    return (
      <div style={overlayStyle}>
        <div style={{ ...modalStyle, maxWidth: "32rem" }}>
          <div style={{ ...headerStyle, background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)", borderBottom: "1px solid #bbf7d0" }}>
            <div style={{ width: "2.25rem", height: "2.25rem", borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #059669, #10b981)", boxShadow: "0 4px 10px rgba(5,150,105,0.3)" }}>
              <CheckCircle2 style={{ width: "1.125rem", height: "1.125rem", color: "#fff" }} />
            </div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#1e1e2d", fontFamily: "var(--font-heading)" }}>
              Limpeza concluída
            </h2>
          </div>
          <div style={bodyStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem", borderRadius: "0.75rem", background: "#ecfdf5", border: "1px solid #a7f3d0", marginBottom: "1.25rem" }}>
              <CheckCircle2 style={{ width: "1.25rem", height: "1.25rem", color: "#059669", flexShrink: 0 }} />
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#065f46" }}>
                Limpeza concluída com sucesso. Os módulos selecionados foram zerados.
              </p>
            </div>

            <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#6b7280", marginBottom: "0.75rem" }}>
              Resumo: {totalDeleted} registros apagados
            </p>

            {results && results.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {results.map((r: any) => (
                  <div key={r.module} style={{ padding: "0.625rem 0.75rem", borderRadius: "0.5rem", background: "#f9fafb", border: "1px solid #f3f4f6" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#1e1e2d" }}>{r.label}</span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: r.deletedCount > 0 ? "#059669" : "#9ca3af", background: r.deletedCount > 0 ? "#ecfdf5" : "#f9fafb", padding: "0.125rem 0.5rem", borderRadius: "999px", border: `1px solid ${r.deletedCount > 0 ? "#a7f3d0" : "#e5e7eb"}` }}>
                        {r.deletedCount} apagados
                      </span>
                    </div>
                    {r.details && r.details.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                        {r.details.map((d: string, i: number) => (
                          <span key={i} style={{ fontSize: "0.6875rem", color: "#6b7280" }}>{d}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={footerStyle}>
            <button onClick={handleClose} style={{ ...btnPrimary, background: "linear-gradient(135deg, #059669, #10b981)", boxShadow: "0 4px 14px rgba(5,150,105,0.3)" }}>
              <CheckCircle2 style={{ width: "1rem", height: "1rem" }} />
              Fechar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ===================== RENDER: STEP 1 - SELECT =====================

  if (step === "select") {
    const allSelected = selected.size === MODULES.length

    return (
      <div style={overlayStyle} onClick={handleClose}>
        <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div style={headerStyle}>
            <div style={{ width: "2.25rem", height: "2.25rem", borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #dc2626, #ef4444)", boxShadow: "0 4px 10px rgba(220,38,38,0.3)" }}>
              <Trash2 style={{ width: "1.125rem", height: "1.125rem", color: "#fff" }} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#1e1e2d", fontFamily: "var(--font-heading)" }}>
                Limpeza do Sistema
              </h2>
              <p style={{ fontSize: "0.6875rem", color: "#6b7280" }}>Selecione as áreas para limpar</p>
            </div>
            <button onClick={handleClose} style={{ padding: "0.375rem", borderRadius: "0.5rem", border: "none", background: "transparent", cursor: "pointer" }}>
              <X style={{ width: "1.25rem", height: "1.25rem", color: "#9ca3af" }} />
            </button>
          </div>

          {/* Body */}
          <div style={bodyStyle}>
            {/* Alert banner */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.875rem 1rem", borderRadius: "0.75rem", background: "#fffbeb", border: "1px solid #fde68a", marginBottom: "1rem" }}>
              <AlertTriangle style={{ width: "1.125rem", height: "1.125rem", color: "#d97706", flexShrink: 0, marginTop: "0.0625rem" }} />
              <p style={{ fontSize: "0.8125rem", color: "#92400e", lineHeight: 1.6 }}>
                Selecione abaixo quais áreas do sistema deseja limpar. Os dados selecionados serão{" "}
                <strong>apagados definitivamente</strong> do banco de dados, mantendo o sistema funcionando normalmente para recomeçar do zero.
              </p>
            </div>

            {/* Export recommendation */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.75rem 1rem", borderRadius: "0.75rem", background: "#eff6ff", border: "1px solid #bfdbfe", marginBottom: "1.25rem" }}>
              <Download style={{ width: "1rem", height: "1rem", color: "#2563eb", flexShrink: 0, marginTop: "0.0625rem" }} />
              <p style={{ fontSize: "0.75rem", color: "#1e40af", lineHeight: 1.5 }}>
                <strong>Recomendação:</strong> Exporte os dados antes de apagar (Excel/PDF/CSV), se disponível no sistema.
              </p>
            </div>

            {/* Dependency errors */}
            {dependencyErrors.length > 0 && (
              <div style={{ marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {dependencyErrors.map((err, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.875rem 1rem", borderRadius: "0.75rem", background: "#fef2f2", border: "1px solid #fecaca" }}>
                    <Ban style={{ width: "1rem", height: "1rem", color: "#dc2626", flexShrink: 0, marginTop: "0.0625rem" }} />
                    <div>
                      <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#991b1b", marginBottom: "0.25rem" }}>
                        {err.message}
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                        {err.requiredModules.map((rm) => (
                          <button
                            key={rm.key}
                            onClick={() => {
                              setSelected((prev) => {
                                const next = new Set(prev)
                                next.add(rm.key)
                                return next
                              })
                              setDependencyErrors([])
                            }}
                            style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#dc2626", background: "#fff", border: "1px solid #fecaca", borderRadius: "0.375rem", padding: "0.1875rem 0.5rem", cursor: "pointer" }}
                          >
                            + Selecionar {rm.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* General error */}
            {error && !dependencyErrors.length && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", borderRadius: "0.75rem", background: "#fef2f2", border: "1px solid #fecaca", marginBottom: "1rem" }}>
                <AlertTriangle style={{ width: "1rem", height: "1rem", color: "#dc2626", flexShrink: 0 }} />
                <p style={{ fontSize: "0.8125rem", color: "#991b1b", fontWeight: 500 }}>{error}</p>
              </div>
            )}

            {/* Select All */}
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", borderRadius: "0.75rem", background: allSelected ? "linear-gradient(135deg, #fef2f2, #fff1f2)" : "#f9fafb", border: `1.5px solid ${allSelected ? "#fca5a5" : "#e5e7eb"}`, cursor: "pointer", marginBottom: "0.75rem", transition: "all 0.2s" }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                style={{ width: "1.125rem", height: "1.125rem", accentColor: "#dc2626", cursor: "pointer" }}
              />
              <div>
                <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#1e1e2d" }}>Selecionar tudo</span>
                <p style={{ fontSize: "0.6875rem", color: "#6b7280" }}>Marcar todos os módulos para limpeza</p>
              </div>
            </label>

            {/* Module checkboxes */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {MODULES.map((mod) => {
                const isChecked = selected.has(mod.key)
                return (
                  <label
                    key={mod.key}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: "0.75rem",
                      padding: "0.75rem 1rem", borderRadius: "0.75rem",
                      background: isChecked ? "#fff7ed" : "#fff",
                      border: `1.5px solid ${isChecked ? "#fdba74" : "#f3f4f6"}`,
                      cursor: "pointer", transition: "all 0.2s",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleModule(mod.key)}
                      style={{ width: "1.125rem", height: "1.125rem", accentColor: "#ea580c", cursor: "pointer", marginTop: "0.125rem", flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                        <span style={{ color: isChecked ? "#ea580c" : "#6b7280" }}>{mod.icon}</span>
                        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#1e1e2d" }}>{mod.label}</span>
                      </div>
                      <p style={{ fontSize: "0.6875rem", color: "#6b7280", marginBottom: "0.25rem" }}>{mod.description}</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                        {mod.items.map((item, i) => (
                          <span key={i} style={{ fontSize: "0.625rem", color: "#9ca3af", background: "#f9fafb", padding: "0.0625rem 0.375rem", borderRadius: "0.25rem", border: "1px solid #f3f4f6" }}>
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          <div style={footerStyle}>
            <button onClick={handleClose} style={btnCancel}>Cancelar</button>
            <button onClick={handleContinue} disabled={loadingPreview} style={{ ...btnPrimary, opacity: loadingPreview ? 0.7 : 1, cursor: loadingPreview ? "wait" : "pointer" }}>
              {loadingPreview ? (
                <><Loader2 style={{ width: "1rem", height: "1rem", animation: "spin 1s linear infinite" }} /> Verificando...</>
              ) : (
                <><ChevronRight style={{ width: "1rem", height: "1rem" }} /> Continuar</>
              )}
            </button>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ===================== RENDER: STEP 2 - CONFIRM =====================

  if (step === "confirm") {
    const selectedModules = MODULES.filter((m) => selected.has(m.key))
    const totalPreviewCount = previewCounts
      ? Object.values(previewCounts).reduce((sum, c) => sum + c.total, 0)
      : null

    return (
      <div style={overlayStyle}>
        <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div style={headerStyle}>
            <div style={{ width: "2.25rem", height: "2.25rem", borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #dc2626, #ef4444)", boxShadow: "0 4px 10px rgba(220,38,38,0.3)" }}>
              <Shield style={{ width: "1.125rem", height: "1.125rem", color: "#fff" }} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#1e1e2d", fontFamily: "var(--font-heading)" }}>
                Confirmar Limpeza
              </h2>
              <p style={{ fontSize: "0.6875rem", color: "#6b7280" }}>Esta ação não poderá ser desfeita</p>
            </div>
          </div>

          {/* Body */}
          <div style={bodyStyle}>
            {/* Red warning */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "1rem", borderRadius: "0.75rem", background: "#fef2f2", border: "1px solid #fecaca", marginBottom: "1.25rem" }}>
              <AlertTriangle style={{ width: "1.25rem", height: "1.25rem", color: "#dc2626", flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#991b1b", marginBottom: "0.25rem" }}>
                  Atenção: Esta operação é irreversível!
                </p>
                <p style={{ fontSize: "0.8125rem", color: "#991b1b", lineHeight: 1.5 }}>
                  Todos os dados dos módulos selecionados serão permanentemente apagados do banco de dados.
                </p>
              </div>
            </div>

            {/* Selected modules summary */}
            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#374151", marginBottom: "0.5rem" }}>
                Você selecionou para limpar:
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                {selectedModules.map((mod) => {
                  const count = previewCounts?.[mod.key]?.total
                  return (
                    <span key={mod.key} style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", background: "#fff7ed", border: "1px solid #fdba74", fontSize: "0.75rem", fontWeight: 700, color: "#c2410c" }}>
                      {mod.label}
                      {count !== undefined && count !== null && (
                        <span style={{ fontSize: "0.625rem", fontWeight: 600, color: "#9a3412", background: "#ffedd5", padding: "0.0625rem 0.375rem", borderRadius: "999px" }}>
                          {count}
                        </span>
                      )}
                    </span>
                  )
                })}
              </div>
              {totalPreviewCount !== null && (
                <p style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.5rem" }}>
                  Total estimado: <strong>{totalPreviewCount}</strong> registros serão apagados
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", borderRadius: "0.75rem", background: "#fef2f2", border: "1px solid #fecaca", marginBottom: "1rem" }}>
                <AlertTriangle style={{ width: "1rem", height: "1rem", color: "#dc2626", flexShrink: 0 }} />
                <p style={{ fontSize: "0.8125rem", color: "#991b1b", fontWeight: 500 }}>{error}</p>
              </div>
            )}

            {/* Confirmation inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={labelStyle}>
                  Digite <strong style={{ color: "#dc2626" }}>APAGAR</strong> para confirmar
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => { setConfirmText(e.target.value); setError(null) }}
                  placeholder="APAGAR"
                  style={{ ...inputStyle, borderColor: confirmText === "APAGAR" ? "#a7f3d0" : "#e2e8f0" }}
                  autoComplete="off"
                />
              </div>

              <div>
                <label style={labelStyle}>
                  Senha master <span style={{ fontWeight: 400, color: "#9ca3af" }}>(nome do estabelecimento)</span>
                </label>
                <input
                  type="text"
                  value={masterPassword}
                  onChange={(e) => { setMasterPassword(e.target.value); setError(null) }}
                  placeholder="Digite o nome do estabelecimento"
                  style={inputStyle}
                  autoComplete="off"
                />
                <p style={{ fontSize: "0.6875rem", color: "#9ca3af", marginTop: "0.375rem" }}>
                  A senha é o nome exato do seu estabelecimento cadastrado nas configurações. Acentos e maiúsculas são ignorados.
                </p>
              </div>
            </div>

            {/* Action */}
            <div style={{ marginTop: "1.25rem" }}>
              <button
                onClick={handleExecute}
                disabled={confirmText !== "APAGAR" || !masterPassword.trim()}
                style={{
                  ...btnDanger,
                  opacity: confirmText !== "APAGAR" || !masterPassword.trim() ? 0.5 : 1,
                  cursor: confirmText !== "APAGAR" || !masterPassword.trim() ? "not-allowed" : "pointer",
                }}
              >
                <Trash2 style={{ width: "1rem", height: "1rem" }} />
                Apagar dados selecionados
              </button>
            </div>
          </div>

          {/* Footer */}
          <div style={footerStyle}>
            <button onClick={() => { setStep("select"); setError(null); setConfirmText(""); setMasterPassword("") }} style={btnCancel}>
              <ChevronLeft style={{ width: "1rem", height: "1rem" }} />
              Voltar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
