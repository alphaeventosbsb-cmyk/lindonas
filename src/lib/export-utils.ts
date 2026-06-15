import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface ColumnDef<T> {
  header: string
  key: keyof T | string
  format?: (value: unknown, row: T) => string
}

// Formatters seguros e reutilizáveis
export const formatCurrencyForExport = (val: number | null | undefined | unknown) => {
  if (val == null || typeof val !== 'number') return "R$ 0,00"
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

export const formatDateForExport = (val: string | null | undefined | unknown) => {
  if (!val || typeof val !== 'string') return "—"
  try {
    // If it's YYYY-MM-DD
    if (val.includes('-')) {
      const parts = val.split('T')[0].split('-')
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return val
  } catch {
    return val
  }
}

export const sanitizeExportValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—"
  let str = String(value)
  if (str.trim() === "") return "—"
  // Evitar fórmulas perigosas (CSV/Excel Injection)
  if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
    str = "'" + str
  }
  return str
}

export async function exportToExcel<T>(
  data: T[],
  columns: ColumnDef<T>[],
  fileName: string
) {
  try {
    // Mapear os dados de acordo com as colunas
    const mappedData = data.map(row => {
      const newRow: Record<string, string> = {}
      columns.forEach(col => {
        let val: unknown = null
        if (typeof col.key === 'string' && col.key in (row as object)) {
          val = (row as Record<string, unknown>)[col.key]
        }
        if (col.format) {
          val = col.format(val, row)
        }
        newRow[col.header] = sanitizeExportValue(val)
      })
      return newRow
    })

    const worksheet = XLSX.utils.json_to_sheet(mappedData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados')

    // Ajustar largura das colunas
    const wscols = columns.map(col => ({ wch: Math.max(col.header.length, 15) }))
    worksheet['!cols'] = wscols

    XLSX.writeFile(workbook, `${fileName}.xlsx`)
    return true
  } catch (error) {
    console.error("Erro na exportação para Excel:", error)
    throw error
  }
}

export async function exportToPDF<T>(
  data: T[],
  columns: ColumnDef<T>[],
  title: string,
  fileName: string
) {
  try {
    const doc = new jsPDF(columns.length > 6 ? 'landscape' : 'portrait', 'pt', 'a4')

    const headers = columns.map(col => col.header)
    const rows = data.map(row => {
      return columns.map(col => {
        let val: unknown = null
        if (typeof col.key === 'string' && col.key in (row as object)) {
          val = (row as Record<string, unknown>)[col.key]
        }
        if (col.format) {
          val = col.format(val, row)
        }
        return sanitizeExportValue(val)
      })
    })

    // Cabeçalho Principal
    doc.setFontSize(16)
    doc.text('Salão Lindonas', 40, 40)
    
    doc.setFontSize(12)
    doc.text(title, 40, 60)
    
    const now = new Date()
    const dateStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR')
    doc.setFontSize(8)
    doc.text(`Gerado em: ${dateStr}`, 40, 75)

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 90,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [124, 92, 252], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { top: 40, left: 40, right: 40, bottom: 40 }
    })

    doc.save(`${fileName}.pdf`)
    return true
  } catch (error) {
    console.error("Erro na exportação para PDF:", error)
    throw error
  }
}

// --------------------------------------------------------------------------------
// PREPARAÇÃO PARA FUTURA IMPORTAÇÃO (FASE 1: SEM SALVAR DADOS NO BANCO)
// --------------------------------------------------------------------------------

export type CsvSeparatorOption = "auto" | ";" | "," | "\t" | "single"

function parseCsvText(csvText: string, separatorOverride: CsvSeparatorOption = "auto"): Record<string, unknown>[] {
  let text = csvText;
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  text = text.replace(/PreÃ§o/g, "Preço")
             .replace(/MÃnimo/g, "Mínimo")
             .replace(/CÃ³digo/g, "Código")
             .replace(/DescriÃ§Ã£o/g, "Descrição")
             .replace(/AtenÃ§Ã£o/g, "Atenção")
             .replace(/SituaÃ§Ã£o/g, "Situação")
             .replace(/NÃºmero/g, "Número");

  const parseLine = (line: string, sep: string) => {
    const result = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i+1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === sep && !inQuotes) {
        result.push(cur);
        cur = "";
      } else {
        cur += char;
      }
    }
    result.push(cur);
    return result;
  };

  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if (lines.length === 0) return [];

  const separators = [';', ',', '\t', '|'];
  let bestSep = ';';

  if (separatorOverride !== "auto") {
    if (separatorOverride === "single") {
      bestSep = '\0'; // no separator
    } else {
      bestSep = separatorOverride;
    }
  } else {
    let maxCols = 0;
    for (const sep of separators) {
      const cols = parseLine(lines[0], sep).length;
      if (cols > maxCols) {
        maxCols = cols;
        bestSep = sep;
      }
    }

    const headers = parseLine(lines[0], bestSep).map(h => h.trim());
    if (headers.length === 1) {
      if (headers[0].includes(';')) bestSep = ';';
      else if (headers[0].includes(',')) bestSep = ',';
    }
  }

  const headersObj = parseLine(lines[0], bestSep).map(h => h.trim());
  const headers = separatorOverride === "single" ? [headersObj.join("")] : headersObj;

  const result: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i], bestSep);
    const obj: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      let val = vals[j] !== undefined ? vals[j].trim() : "";
      if (val.startsWith('=') || val.startsWith('+') || val.startsWith('-') || val.startsWith('@')) {
        val = "'" + val;
      }
      obj[headers[j]] = val;
    }
    result.push(obj);
  }

  return result;
}

export async function parseImportFile(file: File, separatorOverride: CsvSeparatorOption = "auto"): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const isCsv = file.name.toLowerCase().endsWith('.csv')
    
    if (isCsv) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          const parsed = parseCsvText(text, separatorOverride)
          resolve(parsed)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = (err) => reject(err)
      reader.readAsText(file, 'UTF-8')
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheetName = workbook.SheetNames[0]
          if (!firstSheetName) throw new Error("O arquivo não contém planilhas.")
          const worksheet = workbook.Sheets[firstSheetName]
          const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" })
          
          const sanitizedJson = json.map((row: Record<string, unknown>) => {
            const newRow: Record<string, unknown> = {}
            for (const key in row) {
              let val = row[key]
              if (typeof val === 'string') {
                val = val.trim()
                if (val.startsWith('=') || val.startsWith('+') || val.startsWith('-') || val.startsWith('@')) {
                  val = "'" + val
                }
              }
              newRow[key] = val
            }
            return newRow
          })

          resolve(sanitizedJson)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = (err) => reject(err)
      reader.readAsArrayBuffer(file)
    }
  })
}

export function validateImportRows(data: unknown[]): { valid: unknown[], errors: string[] } {
  if (!Array.isArray(data)) return { valid: [], errors: ["Dados inválidos"] }
  
  const valid = data.filter(row => {
    if (!row || typeof row !== 'object') return false
    const values = Object.values(row)
    if (values.length === 0) return false
    // se todas as colunas estão vazias, considera inválido/linha vazia
    if (values.every(v => v === null || v === undefined || v === "")) return false
    return true
  })

  const errors = []
  if (data.length === 0) errors.push("O arquivo está vazio ou não possui cabeçalhos.")
  if (valid.length === 0 && data.length > 0) errors.push("Nenhuma linha de dados válida encontrada.")

  return { valid, errors }
}

export function previewImportData() {
  // Can be used to slice top 10 items. But UI might handle this.
}

export function mapImportColumns(row: Record<string, unknown>, moduleType: "clientes" | "estoque" | "servicos"): Record<string, string> {
  const mapping: Record<string, string> = {}
  
  Object.keys(row).forEach(k => {
    const cleanK = k.toLowerCase().trim()
    
    if (moduleType === "clientes") {
      if (cleanK === 'nome' || cleanK === 'cliente' || cleanK === 'nome do cliente' || cleanK === 'paciente' || cleanK === 'pessoa física' || cleanK === 'pessoa fisica') mapping.name = k
      else if (cleanK === 'telefone' || cleanK === 'celular' || cleanK === 'whatsapp' || cleanK === 'fone' || cleanK === 'contato' || cleanK === 'tel') mapping.phone = k
      else if (cleanK === 'email' || cleanK === 'e-mail' || cleanK === 'mail') mapping.email = k
      else if (cleanK === 'cpf' || cleanK === 'documento' || cleanK === 'doc') mapping.cpf = k
    } else if (moduleType === "estoque") {
      if (cleanK === 'nome' || cleanK === 'produto' || cleanK === 'nome do produto' || cleanK === 'item' || cleanK === 'descrição' || cleanK === 'descricao') mapping.name = k
      else if (cleanK === 'categoria' || cleanK === 'grupo' || cleanK === 'tipo' || cleanK === 'marca') mapping.category = k
      else if (cleanK === 'sku' || cleanK === 'código' || cleanK === 'codigo' || cleanK === 'cod' || cleanK === 'referência' || cleanK === 'referencia') mapping.sku = k
      else if (cleanK === 'código de barras' || cleanK === 'codigo de barras' || cleanK === 'barcode' || cleanK === 'ean' || cleanK === 'gtin' || cleanK === 'código de barra' || cleanK === 'codigo de barra') mapping.barcode = k
      else if (cleanK === 'quantidade' || cleanK === 'qtd' || cleanK === 'estoque' || cleanK === 'estoque atual' || cleanK === 'saldo') mapping.stock_quantity = k
      else if (cleanK === 'estoque mínimo' || cleanK === 'estoque minimo' || cleanK === 'mínimo' || cleanK === 'minimo' || cleanK === 'min' || cleanK === 'qtd minima' || cleanK === 'qtd mínima') mapping.min_stock = k
      else if (cleanK === 'preço de custo' || cleanK === 'preco de custo' || cleanK === 'custo' || cleanK === 'valor de custo') mapping.cost_price = k
      else if (cleanK === 'preço de venda' || cleanK === 'preco de venda' || cleanK === 'venda' || cleanK === 'valor de venda' || cleanK === 'preço' || cleanK === 'preco' || cleanK === 'valor') mapping.sell_price = k
      else if (cleanK === 'unidade' || cleanK === 'un' || cleanK === 'medida' || cleanK === 'unidade de medida') mapping.unit = k
      else if (cleanK === 'fornecedor' || cleanK === 'distribuidor') mapping.supplier = k
      else if (cleanK === 'marca' || cleanK === 'fabricante') mapping.manufacturer = k
      else if (cleanK === 'status' || cleanK === 'situação' || cleanK === 'ativo' || cleanK === 'situação') mapping.status = k
    } else if (moduleType === "servicos") {
      if (cleanK === 'serviço' || cleanK === 'servico' || cleanK === 'nome' || cleanK === 'nome do serviço' || cleanK === 'nome do servico' || cleanK === 'procedimento' || cleanK === 'descrição do serviço') mapping.name = k
      else if (cleanK === 'categoria' || cleanK === 'grupo' || cleanK === 'tipo') mapping.category = k
      else if (cleanK === 'duração' || cleanK === 'duracao' || cleanK === 'tempo' || cleanK === 'minutos' || cleanK === 'min') mapping.duration = k
      else if (cleanK === 'valor' || cleanK === 'preço' || cleanK === 'preco' || cleanK === 'preço do serviço' || cleanK === 'preco do serviço' || cleanK === 'valor serviço' || cleanK === 'valor servico') mapping.price = k
      else if (cleanK === 'comissão' || cleanK === 'comissao' || cleanK === 'percentual comissão' || cleanK === 'percentual comissao' || cleanK === 'comissão profissional') mapping.commission = k
      else if (cleanK === 'descrição' || cleanK === 'descricao' || cleanK === 'observação' || cleanK === 'observacao' || cleanK === 'obs') mapping.description = k
      else if (cleanK === 'status' || cleanK === 'situação' || cleanK === 'situacao' || cleanK === 'ativo') mapping.status = k
      else if (cleanK === 'visível online' || cleanK === 'visivel online' || cleanK === 'agendamento online' || cleanK === 'online' || cleanK === 'site' || cleanK === 'app' || cleanK === 'reserva online') mapping.online = k
    }
  })

  return mapping
}
