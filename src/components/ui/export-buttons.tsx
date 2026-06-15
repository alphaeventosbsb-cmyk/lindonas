"use client"

import { useState } from "react"
import { Download, FileText, FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { exportToExcel, exportToPDF, type ColumnDef } from "@/lib/export-utils"
import { toast } from "sonner"
import { ImportPreviewModal } from "./import-preview-modal"

interface ExportButtonsProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  fileName: string
  title: string
  disabled?: boolean
  importModule?: "clientes" | "estoque" | "servicos"
}

export function ExportButtons<T>({ data, columns, fileName, title, disabled = false, importModule }: ExportButtonsProps<T>) {
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  const handleExportExcel = async () => {
    if (data.length === 0) {
      toast.warning("Não há dados para exportar.")
      return
    }
    setExportingExcel(true)
    try {
      await exportToExcel(data, columns, fileName)
      toast.success("Excel exportado com sucesso!")
    } catch (err) {
      toast.error("Erro ao exportar Excel")
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
    } catch (err) {
      toast.error("Erro ao exportar PDF")
    } finally {
      setExportingPDF(false)
    }
  }

  const handleImportClick = () => {
    if (importModule) {
      setShowImportModal(true)
    } else {
      toast.info("Importação de dados em breve!")
    }
  }

  return (
    <div style={{ display: 'flex', gap: '0.375rem' }}>
      <button
        type="button"
        onClick={handleImportClick}
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

      <button
        type="button"
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
        type="button"
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

      {showImportModal && importModule && (
        <ImportPreviewModal 
          moduleType={importModule} 
          onClose={() => setShowImportModal(false)} 
        />
      )}
    </div>
  )
}
