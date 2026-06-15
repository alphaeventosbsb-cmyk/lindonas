"use client"

import { useState, useRef } from "react"
import { UploadCloud, X, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react"
import { parseImportFile, validateImportRows, mapImportColumns } from "@/lib/export-utils"

interface ImportPreviewModalProps {
  moduleType: "clientes" | "estoque" | "servicos"
  onClose: () => void
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 9999
}

const modalStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '1rem', width: '100%', maxWidth: '800px',
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column',
  maxHeight: '90vh', overflow: 'hidden'
}

export function ImportPreviewModal({ moduleType, onClose }: ImportPreviewModalProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([])
  const [mappedKeys, setMappedKeys] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      await processFile(droppedFile)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      await processFile(selectedFile)
    }
  }

  const processFile = async (selectedFile: File) => {
    setError(null)
    const ext = selectedFile.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      setError("Formato de arquivo inválido. Apenas .xlsx, .xls ou .csv são permitidos.")
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("O arquivo é muito grande. O limite máximo é de 5MB.")
      return
    }

    setLoading(true)
    try {
      const data = await parseImportFile(selectedFile)
      const { valid, errors } = validateImportRows(data)

      if (errors.length > 0) {
        setError(errors[0])
        setLoading(false)
        return
      }

      const preview = valid.slice(0, 10) as Record<string, unknown>[]
      
      // Extract all keys from the first few rows
      const allKeys = new Set<string>()
      preview.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)))
      const keysArray = Array.from(allKeys)
      
      // Try to heuristically map
      let autoMap = {}
      if (preview.length > 0) {
        autoMap = mapImportColumns(preview[0], moduleType)
      }

      setFile(selectedFile)
      setPreviewData(preview)
      setMappedKeys(keysArray)
      setColumnMapping(autoMap)

    } catch (err) {
      setError("Erro ao ler o arquivo. Certifique-se que ele não está corrompido.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const resetFile = () => {
    setFile(null)
    setPreviewData([])
    setMappedKeys([])
    setColumnMapping({})
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const moduleNameMap = {
    clientes: "Clientes",
    estoque: "Produtos",
    servicos: "Serviços"
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e8ecf4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileSpreadsheet style={{ width: '20px', height: '20px', color: '#0891b2' }} />
            Importar {moduleNameMap[moduleType]}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', padding: '1rem', display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <AlertCircle style={{ width: '20px', height: '20px', color: '#ef4444', flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#991b1b' }}>Erro na importação</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#b91c1c' }}>{error}</p>
              </div>
            </div>
          )}

          {!file ? (
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragging ? '2px dashed #0891b2' : '2px dashed #cbd5e1',
                background: isDragging ? '#f0fdfa' : '#f8fafc',
                borderRadius: '1rem', padding: '3rem 2rem', textAlign: 'center',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <UploadCloud style={{ width: '3rem', height: '3rem', color: isDragging ? '#0891b2' : '#94a3b8', margin: '0 auto 1rem' }} />
              <p style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 600, color: '#334155' }}>
                Arraste uma planilha ou clique para selecionar
              </p>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                Formatos suportados: .xlsx, .xls, .csv
              </p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept=".xlsx, .xls, .csv" 
                style={{ display: 'none' }} 
              />
              
              {loading && (
                <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#0891b2' }}>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Lendo arquivo...</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <FileSpreadsheet style={{ width: '24px', height: '24px', color: '#10b981' }} />
                  <div>
                    <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>{file.name}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Linhas lidas: {previewData.length} (exibindo prévia)</p>
                  </div>
                </div>
                <button onClick={resetFile} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600, color: '#475569', background: '#fff', border: '1px solid #cbd5e1', cursor: 'pointer' }}>
                  Trocar Arquivo
                </button>
              </div>

              <div style={{ overflowX: 'auto', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                      {mappedKeys.map(k => {
                        const isMapped = Object.values(columnMapping).includes(k)
                        return (
                          <th key={k} style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              {k}
                              {isMapped && <span style={{ padding: '0.125rem 0.375rem', background: '#dcfce7', color: '#16a34a', borderRadius: '999px', fontSize: '0.625rem' }}>Reconhecido</span>}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        {mappedKeys.map(k => (
                          <td key={k} style={{ padding: '0.75rem', color: '#475569', whiteSpace: 'nowrap' }}>
                            {row[k] !== undefined && row[k] !== null ? String(row[k]) : <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '1rem', display: 'flex', gap: '0.75rem' }}>
                <AlertCircle style={{ width: '20px', height: '20px', color: '#d97706', flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#92400e' }}>Aviso da Fase 1</p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#b45309' }}>
                    Esta é apenas uma prévia de como os dados serão lidos. **Nada será salvo no banco de dados agora.** O salvamento completo será implementado na próxima fase.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #e8ecf4', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button 
            onClick={onClose}
            style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.875rem', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button 
            disabled={true}
            title="Importação real em breve"
            style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.875rem', background: '#94a3b8', color: '#fff', border: 'none', cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            Salvar será liberado na próxima fase
          </button>
        </div>
      </div>
    </div>
  )
}
