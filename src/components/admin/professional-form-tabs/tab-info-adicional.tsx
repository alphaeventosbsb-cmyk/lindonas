"use client"
import type { EmployeeAdditionalInfo } from "@/lib/types/database"
import { MapPin, CreditCard, Briefcase } from "lucide-react"

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem',
  border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#1e1e2d',
  fontSize: '0.8125rem', fontWeight: 500, outline: 'none',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem'
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer', appearance: 'auto' as any }

const sectionHeader = (icon: any, title: string, desc: string) => {
  const Icon = icon
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
      <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.5rem', background: '#f0ecff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: '12px', height: '12px', color: '#7c5cfc' }} />
      </div>
      <div>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e1e2d' }}>{title}</p>
        <p style={{ fontSize: '0.5625rem', color: '#9ca3af' }}>{desc}</p>
      </div>
    </div>
  )
}

const ufOptions = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const accountTypes = ['Corrente', 'Poupança', 'Pagamento']
const employmentTypes = ['Funcionário', 'Autônomo', 'Parceiro', 'Comissionado', 'Freelancer', 'Outro']

interface Props {
  info: EmployeeAdditionalInfo
  onChange: (i: EmployeeAdditionalInfo) => void
}

export function TabInfoAdicional({ info, onChange }: Props) {
  const update = (field: keyof EmployeeAdditionalInfo, val: any) => {
    onChange({ ...info, [field]: val || null })
  }

  const maskCEP = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 8)
    if (d.length > 5) return `${d.slice(0,5)}-${d.slice(5)}`
    return d
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Address Section */}
      <div>
        {sectionHeader(MapPin, 'Endereço', 'Dados de localização do profissional')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Endereço</label>
            <input value={info.address || ''} onChange={e => update('address', e.target.value)} style={inputStyle} placeholder="Rua, número, complemento" />
          </div>
          <div>
            <label style={labelStyle}>Bairro</label>
            <input value={info.neighborhood || ''} onChange={e => update('neighborhood', e.target.value)} style={inputStyle} placeholder="Bairro" />
          </div>
          <div>
            <label style={labelStyle}>Cidade</label>
            <input value={info.city || ''} onChange={e => update('city', e.target.value)} style={inputStyle} placeholder="Cidade" />
          </div>
          <div>
            <label style={labelStyle}>UF</label>
            <select value={info.state || ''} onChange={e => update('state', e.target.value)} style={selectStyle}>
              <option value="">Selecione</option>
              {ufOptions.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>CEP</label>
            <input value={info.zipCode || ''} onChange={e => update('zipCode', maskCEP(e.target.value))} style={inputStyle} placeholder="00000-000" maxLength={9} />
          </div>
        </div>
      </div>

      {/* Banking Section */}
      <div>
        {sectionHeader(CreditCard, 'Dados Bancários', 'Informações para pagamento e comissões')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Chave Pix</label>
            <input value={info.pixKey || ''} onChange={e => update('pixKey', e.target.value)} style={inputStyle} placeholder="CPF, e-mail, telefone ou chave aleatória" />
          </div>
          <div>
            <label style={labelStyle}>Banco</label>
            <input value={info.bank || ''} onChange={e => update('bank', e.target.value)} style={inputStyle} placeholder="Nome do banco" />
          </div>
          <div>
            <label style={labelStyle}>Tipo de Conta</label>
            <select value={info.accountType || ''} onChange={e => update('accountType', e.target.value)} style={selectStyle}>
              <option value="">Selecione</option>
              {accountTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Agência</label>
            <input value={info.bankBranch || ''} onChange={e => update('bankBranch', e.target.value)} style={inputStyle} placeholder="0000" />
          </div>
          <div>
            <label style={labelStyle}>Conta</label>
            <input value={info.bankAccount || ''} onChange={e => update('bankAccount', e.target.value)} style={inputStyle} placeholder="00000-0" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Observações financeiras</label>
            <textarea value={info.financialNotes || ''} onChange={e => update('financialNotes', e.target.value)} rows={2}
              style={{ ...inputStyle, resize: 'vertical' as any }} placeholder="Notas sobre pagamento..." />
          </div>
        </div>
      </div>

      {/* Employment Section */}
      <div>
        {sectionHeader(Briefcase, 'Vínculo Profissional', 'Informações de contratação')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
          <div>
            <label style={labelStyle}>Documento/Certificação</label>
            <input value={info.professionalDocument || ''} onChange={e => update('professionalDocument', e.target.value)} style={inputStyle} placeholder="CRP, CRO, etc." />
          </div>
          <div>
            <label style={labelStyle}>Data de Contratação</label>
            <input type="date" value={info.hireDate || ''} onChange={e => update('hireDate', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Tipo de Vínculo</label>
            <select value={info.employmentType || ''} onChange={e => update('employmentType', e.target.value)} style={selectStyle}>
              <option value="">Selecione</option>
              {employmentTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
