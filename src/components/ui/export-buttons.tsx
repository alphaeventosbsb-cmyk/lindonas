"use client"

import { useState } from "react"
import { Download, FileText, FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { exportToExcel, exportToPDF, type ColumnDef } from "@/lib/export-utils"
import { toast } from "sonner"
import { ImportPreviewModal } from "./import-preview-modal"
import { usePermission } from "@/lib/rbac/usePermission"
import { useTenant } from "@/lib/auth/tenant-context"
import { logDataAudit } from "@/lib/firebase/audit-service"

interface ExportButtonsProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  fileName: string
  title: string
  disabled?: boolean
  importModule?: "clientes" | "estoque" | "servicos"
  fullData?: T[]
  extraData?: Record<string, unknown>
  onImportConfirm?: (data: Record<string, unknown>[], mappedKeys: string[], columnMapping: Record<string, string>) => Promise<void>
  hideImport?: boolean
  exportPermissionKey?: string
  importPermissionKey?: string
  moduleName?: string
}

export function ExportButtons<T>({ data, columns, fileName, title, disabled = false, importModule, fullData, extraData, onImportConfirm, hideImport = false, exportPermissionKey, importPermissionKey, moduleName }: ExportButtonsProps<T>) {
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const { can } = usePermission()
  const { saasUser, companyId } = useTenant()

  const hasExportPermission = exportPermissionKey ? can(exportPermissionKey) : true
  const hasImportPermission = importPermissionKey ? can(importPermissionKey) : true

  if (!hasExportPermission && !hasImportPermission && !hideImport) return null

  const handleExportExcel = async () => {
    if (data.length === 0) {
      toast.warning("Não há dados para exportar.")
      return
    }
    setExportingExcel(true)
    try {
      await exportToExcel(data, columns, fileName)
      toast.success("Excel exportado com sucesso!")
      if (saasUser) {
        logDataAudit({
          company_id: companyId || saasUser.company_id || "unknown",
          user_id: saasUser.id,
          user_name: saasUser.name,
          user_email: saasUser.email || undefined,
          action: "EXPORT",
          module: moduleName || importModule || "Desconhecido",
          format: "Excel",
          records_count: data.length,
          status: "success"
        })
      }
    } catch (err) {
      toast.error("Erro ao exportar Excel")
      if (saasUser) {
        logDataAudit({
          company_id: companyId || saasUser.company_id || "unknown",
          user_id: saasUser.id,
          user_name: saasUser.name,
          user_email: saasUser.email || undefined,
          action: "EXPORT",
          module: moduleName || importModule || "Desconhecido",
          format: "Excel",
          status: "error"
        })
      }
    } finally {
      setExportingExcel(false)
    }
  }

  const handleExportPDF = async () => {
    if (data.length === 0) {
      toast.warning("Não há dados para exportar.")
      return
    }
    setExportingPDF(true)
    try {
      await exportToPDF(data, columns, title, fileName)
      toast.success("PDF exportado com sucesso!")
      if (saasUser) {
        logDataAudit({
          company_id: companyId || saasUser.company_id || "unknown",
          user_id: saasUser.id,
          user_name: saasUser.name,
          user_email: saasUser.email || undefined,
          action: "EXPORT",
          module: moduleName || importModule || "Desconhecido",
          format: "PDF",
          records_count: data.length,
          status: "success"
        })
      }
    } catch (err) {
      toast.error("Erro ao exportar PDF")
      if (saasUser) {
        logDataAudit({
          company_id: companyId || saasUser.company_id || "unknown",
          user_id: saasUser.id,
          user_name: saasUser.name,
          user_email: saasUser.email || undefined,
          action: "EXPORT",
          module: moduleName || importModule || "Desconhecido",
          format: "PDF",
          status: "error"
        })
      }
    } finally {
      setExportingPDF(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {importModule && onImportConfirm && !hideImport && hasImportPermission && (
          <button
            onClick={() => setShowImportModal(true)}
            disabled={disabled}
            title="Importar (Em breve)"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#f8fafc',
              color: '#64748b', fontSize: '0.75rem', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <Upload style={{ width: '14px', height: '14px' }} />
            <span className="hidden sm:inline">Importar</span>
          </button>
        )}
        
        {hasExportPermission && (
          <>
            <button
              onClick={handleExportExcel}
              disabled={exportingExcel || disabled}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem', border: '1px solid #22c55e', background: '#f0fdf4',
                color: '#16a34a', fontSize: '0.75rem', fontWeight: 600, cursor: (exportingExcel || disabled) ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {exportingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet style={{ width: '14px', height: '14px' }} />}
              <span className="hidden sm:inline">Excel</span>
            </button>
            
            <button
              onClick={handleExportPDF}
              disabled={exportingPDF || disabled}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem', border: '1px solid #ef4444', background: '#fef2f2',
                color: '#dc2626', fontSize: '0.75rem', fontWeight: 600, cursor: (exportingPDF || disabled) ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {exportingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText style={{ width: '14px', height: '14px' }} />}
              <span className="hidden sm:inline">PDF</span>
            </button>
          </>
        )}

      {showImportModal && importModule && onImportConfirm && hasImportPermission && (
        <ImportPreviewModal 
          moduleType={importModule} 
          onClose={() => setShowImportModal(false)} 
          fullData={fullData as Record<string, unknown>[]}
          extraData={extraData}
          onConfirm={onImportConfirm}
        />
      )}
    </div>
  )
}
