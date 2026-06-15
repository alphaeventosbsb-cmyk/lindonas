"use client"

import { useState, useRef, useMemo } from "react"
import { X, Upload, File as FileIcon, AlertCircle, Loader2, ChevronDown, FileSpreadsheet } from "lucide-react"
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
  const [rawValidData, setRawValidData] = useState<Record<string, unknown>[]>([])
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
      const allKeys = new Set<string>()
      previewInitial.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)))
      const keysArray = Array.from(allKeys)
      
      let autoMap = {}
      if (previewInitial.length > 0) {
        autoMap = mapImportColumns(previewInitial[0], moduleType)
      }

      setRawValidData(valid as Record<string, unknown>[])
      setFile(selectedFile)
      setMappedKeys(keysArray)
      setColumnMapping(autoMap)
    } catch (err) {
      setError("Erro ao ler o arquivo. Certifique-se que ele não está corrompido.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const processedData = useMemo(() => {
    if (rawValidData.length === 0) return []

    const seenCpfs = new Set<string>()
    const seenEmails = new Set<string>()
    const seenPhones = new Set<string>()

    return rawValidData.map((row: Record<string, unknown>) => {
      let isDuplicate = false
      let isError = false
      let isWarning = false
      let errorMsg = ""
      let generatedName = ""
      let generatedNotes = ""
      
      if (moduleType === "clientes") {
        const nameCol = Object.keys(columnMapping).find(k => columnMapping[k] === "name")
        const phoneCol = Object.keys(columnMapping).find(k => columnMapping[k] === "phone")
        const emailCol = Object.keys(columnMapping).find(k => columnMapping[k] === "email")
        const cpfCol = Object.keys(columnMapping).find(k => columnMapping[k] === "cpf")

        const nameVal = nameCol ? String(row[nameCol] || "").trim() : ""
        const phoneVal = phoneCol ? String(row[phoneCol] || "").replace(/\D/g, "") : ""
        const emailVal = emailCol ? String(row[emailCol] || "").trim().toLowerCase() : ""
        const cpfVal = cpfCol ? String(row[cpfCol] || "").replace(/\D/g, "") : ""

        if (!nameVal) {
          if (phoneVal || emailVal || cpfVal) {
            isWarning = true
            if (phoneVal) generatedName = `Cliente sem nome - ${phoneVal}`
            else if (emailVal) generatedName = `Cliente sem nome - ${emailVal}`
            else generatedName = `Cliente sem nome - CPF ${cpfVal}`
            generatedNotes = "Importado com nome vazio. Revisar cadastro manualmente."
          } else {
            isError = true
            errorMsg = "linha sem dados suficientes"
          }
        }

        if (!isError) {
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
        _status: isError ? "error" : isDuplicate ? "duplicate" : isWarning ? "warning" : "valid",
        _errorMsg: errorMsg,
        _generatedName: generatedName,
        _generatedNotes: generatedNotes
      }
    })
  }, [rawValidData, columnMapping, fullData, moduleType])

  const previewData = useMemo(() => processedData.slice(0, 10), [processedData])

  const importSummary = useMemo(() => {
    const toCreate = processedData.filter(r => r._status === "valid" || r._status === "warning").length
    const errorCnt = processedData.filter(r => r._status === "error").length
    const dupCnt = processedData.filter(r => r._status === "duplicate").length
    const warningCnt = processedData.filter(r => r._status === "warning").length

    return {
      total: processedData.length,
      valid: toCreate + dupCnt,
      error: errorCnt,
      duplicate: dupCnt,
      warning: warningCnt,
      toCreate: toCreate
    }
  }, [processedData])

  const resetFile = () => {
    setFile(null)
    setRawValidData([])
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
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e8ecf4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileSpreadsheet style={{ width: '20px', height: '20px', color: '#0891b2' }} />
            Importar {moduleNameMap[moduleType]}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', padding: '1rem', display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <AlertCircle style={{ width: '20px', height: '20px', color: '#ef4444', flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#991b1b' }}>Erro na importação</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#b91c1c' }}>{error}</p>
              </div>
            </div>
          )}

          {!file && !loading ? (
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${isDragging ? '#7c5cfc' : '#cbd5e1'}`,
                background: isDragging ? '#f5f3ff' : '#f8fafc',
                borderRadius: '0.75rem',
                padding: '3rem 2rem',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload style={{ width: '40px', height: '40px', margin: '0 auto 1rem', color: isDragging ? '#7c5cfc' : '#94a3b8' }} />
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>
                Clique ou arraste a planilha
              </h3>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                Aceita arquivos Excel (.xlsx, .xls) e CSV (.csv). Máximo de 5MB.
              </p>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept=".xlsx, .xls, .csv" 
                onChange={handleFileSelect}
              />
            </div>
          ) : loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0' }}>
              <Loader2 className="w-10 h-10 animate-spin text-purple-600 mb-4" />
              <p style={{ margin: 0, color: '#475569', fontWeight: 500 }}>Processando arquivo...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {moduleType === "clientes" && mappedKeys.length > 0 && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>Mapeamento de Colunas</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                    {['name', 'phone', 'email', 'cpf'].map(field => {
                      const labelMap: Record<string, string> = { name: "Nome", phone: "Telefone", email: "E-mail", cpf: "CPF" }
                      const currentMappedCol = Object.keys(columnMapping).find(k => columnMapping[k] === field) || ""
                      
                      let exampleStr = ""
                      if (currentMappedCol && rawValidData.length > 0) {
                        const rowWithVal = rawValidData.find(r => r[currentMappedCol] !== undefined && r[currentMappedCol] !== null && String(r[currentMappedCol]).trim() !== "")
                        if (rowWithVal) {
                          const val = rowWithVal[currentMappedCol]
                          exampleStr = String(val).length > 25 ? String(val).substring(0, 25) + "..." : String(val)
                        }
                      }

                      return (
                        <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Coluna para {labelMap[field]}</label>
                          <div style={{ position: 'relative' }}>
                            <select 
                              value={currentMappedCol}
                              onChange={(e) => {
                                const val = e.target.value
                                setColumnMapping(prev => {
                                  const next = { ...prev }
                                  Object.keys(next).forEach(k => { if (next[k] === field) delete next[k] })
                                  if (val !== "") next[val] = field
                                  return next
                                })
                              }}
                              style={{ width: '100%', padding: '0.5rem 2rem 0.5rem 0.75rem', fontSize: '0.875rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', background: '#fff', appearance: 'none', outline: 'none' }}
                            >
                              <option value="">-- Nenhuma --</option>
                              {mappedKeys.map(k => (
                                <option key={k} value={k}>{k}</option>
                              ))}
                            </select>
                            <ChevronDown style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#94a3b8', pointerEvents: 'none' }} />
                          </div>
                          {exampleStr && (
                            <span style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '0.125rem' }}>
                              Ex: {exampleStr}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <FileIcon style={{ width: '24px', height: '24px', color: '#10b981' }} />
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
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: row._status === 'error' ? '#fef2f2' : row._status === 'duplicate' ? '#fffbeb' : row._status === 'warning' ? '#fef9c3' : 'transparent' }}>
                        {mappedKeys.map(k => (
                          <td key={k} style={{ padding: '0.75rem', color: '#475569', whiteSpace: 'nowrap' }}>
                            {row[k] !== undefined && row[k] !== null ? String(row[k]) : <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                        ))}
                        <td style={{ padding: '0.75rem', color: '#475569', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {row._status === 'error' && <span style={{ color: '#ef4444' }}>Erro: {row._errorMsg}</span>}
                          {row._status === 'duplicate' && <span style={{ color: '#d97706' }}>Duplicado / Ignorado</span>}
                          {row._status === 'warning' && <span style={{ color: '#b45309' }}>Aviso: nome vazio, será importado como {row._generatedName}</span>}
                          {row._status === 'valid' && <span style={{ color: '#10b981' }}>Válido (Criar)</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: 0, fontSize: '0.6875rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Lidas</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{importSummary.total}</p>
                </div>
                <div style={{ background: '#f0fdf4', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
                  <p style={{ margin: 0, fontSize: '0.6875rem', color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Criar</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#15803d' }}>{importSummary.toCreate}</p>
                </div>
                <div style={{ background: '#fef9c3', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #fde047' }}>
                  <p style={{ margin: 0, fontSize: '0.6875rem', color: '#a16207', fontWeight: 600, textTransform: 'uppercase' }}>Avisos</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#ca8a04' }}>{importSummary.warning}</p>
                </div>
                <div style={{ background: '#fffbeb', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #fef08a' }}>
                  <p style={{ margin: 0, fontSize: '0.6875rem', color: '#854d0e', fontWeight: 600, textTransform: 'uppercase' }}>Ignorados</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#a16207' }}>{importSummary.duplicate}</p>
                </div>
                <div style={{ background: '#fef2f2', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #fecaca' }}>
                  <p style={{ margin: 0, fontSize: '0.6875rem', color: '#991b1b', fontWeight: 600, textTransform: 'uppercase' }}>Erros</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#b91c1c' }}>{importSummary.error}</p>
                </div>
              </div>

              {importSummary.warning > 0 && moduleType === "clientes" && (
                <div style={{ marginTop: '0.75rem', background: '#fef9c3', border: '1px solid #fde047', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.8125rem', color: '#854d0e' }}>
                  <strong>Atenção:</strong> {importSummary.warning} clientes com nome vazio serão importados com um nome provisório (ex: &quot;Cliente sem nome - Telefone&quot;) para revisão manual.
                </div>
              )}

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
