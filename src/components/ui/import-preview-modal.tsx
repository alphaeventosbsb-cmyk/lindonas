"use client"

import { useState, useRef } from "react"
import { UploadCloud, X, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react"
import { parseImportFile, validateImportRows, mapImportColumns } from "@/lib/export-utils"

interface ImportPreviewModalProps {
  moduleType: "clientes" | "estoque" | "servicos"
  onClose: () => void
  fullData?: Record<string, unknown>[]
  onConfirm?: (data: Record<string, unknown>[], mappedKeys: string[], columnMapping: Record<string, string>) => Promise<void>
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

export function ImportPreviewModal({ moduleType, onClose, fullData, onConfirm }: ImportPreviewModalProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([])
  const [processedData, setProcessedData] = useState<Record<string, unknown>[]>([])
  const [importSummary, setImportSummary] = useState({ total: 0, valid: 0, duplicate: 0, error: 0, toCreate: 0 })
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

      const previewInitial = valid.slice(0, 10) as Record<string, unknown>[]
      
      // Extract all keys from the first few rows
      const allKeys = new Set<string>()
      previewInitial.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)))
      const keysArray = Array.from(allKeys)
      
      // Try to heuristically map
      let autoMap = {}
      if (previewInitial.length > 0) {
        autoMap = mapImportColumns(previewInitial[0], moduleType)
      }

      const seenCpfs = new Set<string>()
      const seenEmails = new Set<string>()
      const seenPhones = new Set<string>()

      const processed = valid.map((row: Record<string, unknown>) => {
        let isDuplicate = false
        let isError = false
        let errorMsg = ""
        
        if (moduleType === "clientes") {
          const nameCol = Object.keys(autoMap).find(k => (autoMap as Record<string, string>)[k] === "name")
          const phoneCol = Object.keys(autoMap).find(k => (autoMap as Record<string, string>)[k] === "phone")
          const emailCol = Object.keys(autoMap).find(k => (autoMap as Record<string, string>)[k] === "email")
          const cpfCol = Object.keys(autoMap).find(k => (autoMap as Record<string, string>)[k] === "cpf")

          const nameVal = nameCol ? String(row[nameCol] || "").trim() : ""
          if (!nameVal) {
            isError = true
            errorMsg = "Nome vazio"
          } else {
            const phoneVal = phoneCol ? String(row[phoneCol] || "").replace(/\D/g, "") : ""
            const emailVal = emailCol ? String(row[emailCol] || "").trim().toLowerCase() : ""
            const cpfVal = cpfCol ? String(row[cpfCol] || "").replace(/\D/g, "") : ""
            
            // Check internal spreadsheet duplication
            let internalDup = false
            if (cpfVal && cpfVal.length === 11) {
              if (seenCpfs.has(cpfVal)) internalDup = true; else seenCpfs.add(cpfVal);
            }
            if (emailVal) {
              if (seenEmails.has(emailVal)) internalDup = true; else seenEmails.add(emailVal);
            }
            if (phoneVal && phoneVal.length >= 10) {
              if (seenPhones.has(phoneVal)) internalDup = true; else seenPhones.add(phoneVal);
            }

            if (internalDup) {
              isDuplicate = true
            } else if (fullData && fullData.length > 0) {
              // Check existing database duplication
              isDuplicate = fullData.some(existing => {
                if (cpfVal && cpfVal.length === 11 && String(existing.cpf) === cpfVal) return true
                if (emailVal && String(existing.email || "").toLowerCase() === emailVal) return true
                if (phoneVal && phoneVal.length >= 10 && String(existing.phone || "") === phoneVal) return true
                if (nameVal && phoneVal && String(existing.name || "").toLowerCase() === nameVal.toLowerCase() && String(existing.phone || "") === phoneVal) return true
                return false
              })
            }
          }
        }
        
        return {
          ...row,
          _status: isError ? "error" : isDuplicate ? "duplicate" : "valid",
          _errorMsg: errorMsg
        }
      })

      const toCreate = processed.filter(r => r._status === "valid").length
      const errorCnt = processed.filter(r => r._status === "error").length
      const dupCnt = processed.filter(r => r._status === "duplicate").length

      setImportSummary({
        total: processed.length,
        valid: toCreate + dupCnt,
        error: errorCnt,
        duplicate: dupCnt,
        toCreate: toCreate
      })

      setFile(selectedFile)
      setProcessedData(processed)
      setPreviewData(processed.slice(0, 10))
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
    setProcessedData([])
    setMappedKeys([])
    setColumnMapping({})
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleConfirmAction = async () => {
    if (!onConfirm || moduleType !== "clientes") return
    if (!window.confirm("Tem certeza que deseja importar estes clientes? Apenas os clientes com status 'Válido' serão criados no banco.")) return
    
    setSaving(true)
    try {
      await onConfirm(processedData, mappedKeys, columnMapping)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
      onClose()
    }
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
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: row._status === 'error' ? '#fef2f2' : row._status === 'duplicate' ? '#fffbeb' : 'transparent' }}>
                        {mappedKeys.map(k => (
                          <td key={k} style={{ padding: '0.75rem', color: '#475569', whiteSpace: 'nowrap' }}>
                            {row[k] !== undefined && row[k] !== null ? String(row[k]) : <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                        ))}
                        <td style={{ padding: '0.75rem', color: '#475569', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {row._status === 'error' && <span style={{ color: '#ef4444' }}>Erro: {row._errorMsg}</span>}
                          {row._status === 'duplicate' && <span style={{ color: '#d97706' }}>Duplicado / Ignorado</span>}
                          {row._status === 'valid' && <span style={{ color: '#10b981' }}>Válido (Criar)</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: 0, fontSize: '0.6875rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Lidas</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{importSummary.total}</p>
                </div>
                <div style={{ background: '#f0fdf4', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
                  <p style={{ margin: 0, fontSize: '0.6875rem', color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Serão Criados</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#15803d' }}>{importSummary.toCreate}</p>
                </div>
                <div style={{ background: '#fffbeb', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #fef08a' }}>
                  <p style={{ margin: 0, fontSize: '0.6875rem', color: '#854d0e', fontWeight: 600, textTransform: 'uppercase' }}>Duplicados (Ignorados)</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#a16207' }}>{importSummary.duplicate}</p>
                </div>
                <div style={{ background: '#fef2f2', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #fecaca' }}>
                  <p style={{ margin: 0, fontSize: '0.6875rem', color: '#991b1b', fontWeight: 600, textTransform: 'uppercase' }}>Erros (Ignorados)</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#b91c1c' }}>{importSummary.error}</p>
                </div>
              </div>

              {moduleType !== "clientes" && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '1rem', display: 'flex', gap: '0.75rem' }}>
                  <AlertCircle style={{ width: '20px', height: '20px', color: '#d97706', flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#92400e' }}>Aviso da Fase 1</p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#b45309' }}>
                      Esta é apenas uma prévia. **Nada será salvo no banco de dados agora para Estoque ou Serviços.** O salvamento completo destes módulos será implementado na fase futura.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #e8ecf4', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button 
            onClick={onClose}
            disabled={saving}
            style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.875rem', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            Cancelar
          </button>
          
          {moduleType === "clientes" ? (
            <button 
              disabled={importSummary.toCreate === 0 || saving}
              onClick={handleConfirmAction}
              style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.875rem', background: (importSummary.toCreate > 0 && !saving) ? '#0891b2' : '#94a3b8', color: '#fff', border: 'none', cursor: (importSummary.toCreate > 0 && !saving) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Salvando...' : 'Confirmar Importação'}
            </button>
          ) : (
            <button 
              disabled={true}
              title="Importação real em breve para este módulo"
              style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.875rem', background: '#94a3b8', color: '#fff', border: 'none', cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              Salvar será liberado na próxima fase
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
