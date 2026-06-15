"use client"
import { useState } from "react"
import type { EmployeePartnerInfo } from "@/lib/types/database"
import { UserPlus, Building, FileSignature, Wallet, Landmark, FileCheck } from "lucide-react"

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem',
  border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#1e1e2d',
  fontSize: '0.8125rem', fontWeight: 500, outline: 'none',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem'
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer', appearance: 'auto' as any }

const transferMethods = [
  { value: 'commission', label: 'Comissão percentual' },
  { value: 'fixed', label: 'Valor fixo' },
  { value: 'per_service', label: 'Por serviço' },
  { value: 'manual', label: 'Manual' },
]

function cnpjMask(value: string) {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .substring(0, 18)
}

function SectionHeader({ icon: Icon, title }: { icon: any, title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.75rem', marginTop: '1.25rem' }}>
      <Icon style={{ width: '16px', height: '16px', color: '#7c5cfc' }} />
      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e1e2d' }}>{title}</h4>
    </div>
  )
}

function CheckboxField({ label, checked, onChange }: { label: string, checked: boolean, onChange: (c: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: '#fff', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #f1f3f9' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} 
        style={{ width: '16px', height: '16px', accentColor: '#7c5cfc' }} />
      <span style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>{label}</span>
    </label>
  )
}

interface Props {
  info: EmployeePartnerInfo
  onChange: (i: EmployeePartnerInfo) => void
}

export function TabParceiro({ info, onChange }: Props) {
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)

  const update = (field: keyof EmployeePartnerInfo, val: any) => {
    onChange({ ...info, [field]: val })
  }

  const handleToggle = () => {
    if (info.isPartner) {
      // Check if there's any data filled
      const hasData = !!(
        info.partnerCompanyName || info.partnerCnpj || info.contractNumber ||
        info.transferPercent || info.pixKey || info.bank
      )
      if (hasData) {
        setShowDeactivateConfirm(true)
      } else {
        update('isPartner', false)
      }
    } else {
      update('isPartner', true)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: '#f0ecff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <UserPlus style={{ width: '14px', height: '14px', color: '#7c5cfc' }} />
        </div>
        <div>
          <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e1e2d' }}>Profissional Parceiro</p>
          <p style={{ fontSize: '0.6875rem', color: '#8b8fa7' }}>Configure se este profissional atua como MEI ou autônomo associado</p>
        </div>
      </div>

      {/* Toggle */}
      <div onClick={handleToggle} style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem',
        borderRadius: '0.75rem', cursor: 'pointer',
        border: info.isPartner ? '2px solid #7c5cfc' : '2px solid #e8ecf4',
        background: info.isPartner ? '#faf8ff' : '#fff',
      }}>
        <div style={{
          width: '2.75rem', height: '1.5rem', borderRadius: '999px', padding: '2px',
          background: info.isPartner ? '#7c5cfc' : '#d1d5db', transition: 'background 0.2s', flexShrink: 0,
        }}>
          <div style={{
            width: '1.25rem', height: '1.25rem', borderRadius: '50%', background: '#fff',
            transition: 'transform 0.2s', transform: info.isPartner ? 'translateX(1.25rem)' : 'translateX(0)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          }} />
        </div>
        <div>
          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: info.isPartner ? '#7c5cfc' : '#6b7280' }}>
            {info.isPartner ? 'Sim, é parceiro ativo' : 'Não atua como parceiro'}
          </p>
          <p style={{ fontSize: '0.625rem', color: '#9ca3af' }}>
            Habilite para gerenciar contrato, repasse e dados empresariais do profissional.
          </p>
        </div>
      </div>

      {info.isPartner && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          
          {/* 1. DADOS DA EMPRESA */}
          <SectionHeader icon={Building} title="1. Dados da Empresa / MEI" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Razão Social</label>
              <input value={info.partnerCompanyName || ''} onChange={e => update('partnerCompanyName', e.target.value || null)} style={inputStyle} placeholder="Nome completo da empresa" />
            </div>
            <div>
              <label style={labelStyle}>Nome Fantasia</label>
              <input value={info.partnerTradeName || ''} onChange={e => update('partnerTradeName', e.target.value || null)} style={inputStyle} placeholder="Nome fantasia" />
            </div>
            <div>
              <label style={labelStyle}>CNPJ</label>
              <input value={info.partnerCnpj || ''} onChange={e => update('partnerCnpj', cnpjMask(e.target.value) || null)} style={inputStyle} placeholder="00.000.000/0000-00" maxLength={18} />
            </div>
            <div>
              <label style={labelStyle}>Inscrição Municipal</label>
              <input value={info.partnerMunicipalRegistration || ''} onChange={e => update('partnerMunicipalRegistration', e.target.value || null)} style={inputStyle} placeholder="Opcional" />
            </div>
            <div>
              <label style={labelStyle}>Tipo de parceiro</label>
              <select value={info.partnerType || ''} onChange={e => update('partnerType', e.target.value || null)} style={selectStyle}>
                <option value="">Selecione</option>
                <option value="mei">MEI</option>
                <option value="autonomo">Autônomo</option>
                <option value="empresa">Empresa</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>

          {/* 2. CONTRATO */}
          <SectionHeader icon={FileSignature} title="2. Contrato de Parceria" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Número do Contrato</label>
              <input value={info.contractNumber || ''} onChange={e => update('contractNumber', e.target.value || null)} style={inputStyle} placeholder="Opcional" />
            </div>
            <div>
              <label style={labelStyle}>Status do Contrato</label>
              <select value={info.contractStatus || 'active'} onChange={e => update('contractStatus', e.target.value || null)} style={selectStyle}>
                <option value="active">Ativo</option>
                <option value="suspended">Suspenso</option>
                <option value="terminated">Encerrado</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Data de Início</label>
              <input type="date" value={info.startDate || ''} onChange={e => update('startDate', e.target.value || null)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Data de Término</label>
              <input type="date" value={info.endDate || ''} onChange={e => update('endDate', e.target.value || null)} style={inputStyle} />
            </div>
          </div>

          {/* 3. REPASSE E PAGAMENTO */}
          <SectionHeader icon={Wallet} title="3. Repasse e Pagamento" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Tipo de Repasse</label>
              <select value={info.transferMethod || ''} onChange={e => update('transferMethod', e.target.value || null)} style={selectStyle}>
                <option value="">Selecione</option>
                {transferMethods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Percentual / Valor</label>
              <input type="number" min="0" max="100" value={info.transferPercent ?? ''}
                onChange={e => update('transferPercent', e.target.value ? parseFloat(e.target.value) : null)}
                style={inputStyle} placeholder="Ex: 60" />
            </div>
            <div>
              <label style={labelStyle}>Dia de Pagamento</label>
              <input type="number" min="1" max="31" value={info.paymentDay ?? ''}
                onChange={e => update('paymentDay', e.target.value ? parseInt(e.target.value) : null)}
                style={inputStyle} placeholder="1 a 31" />
            </div>
          </div>

          {/* 4. DADOS BANCÁRIOS E PIX */}
          <SectionHeader icon={Landmark} title="4. Dados Bancários e PIX" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Tipo de Chave PIX</label>
              <select value={info.pixKeyType || ''} onChange={e => update('pixKeyType', e.target.value || null)} style={selectStyle}>
                <option value="">Selecione</option>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="email">E-mail</option>
                <option value="phone">Telefone</option>
                <option value="random">Chave Aleatória</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Chave PIX</label>
              <input value={info.pixKey || ''} onChange={e => update('pixKey', e.target.value || null)} style={inputStyle} placeholder="Informe a chave PIX" />
            </div>
            <div>
              <label style={labelStyle}>Banco</label>
              <input value={info.bank || ''} onChange={e => update('bank', e.target.value || null)} style={inputStyle} placeholder="Nome ou código do banco" />
            </div>
            <div>
              <label style={labelStyle}>Tipo de Conta</label>
              <select value={info.accountType || ''} onChange={e => update('accountType', e.target.value || null)} style={selectStyle}>
                <option value="">Selecione</option>
                <option value="checking">Conta Corrente</option>
                <option value="savings">Conta Poupança</option>
                <option value="payment">Conta de Pagamento</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Agência</label>
              <input value={info.agency || ''} onChange={e => update('agency', e.target.value || null)} style={inputStyle} placeholder="0000" />
            </div>
            <div>
              <label style={labelStyle}>Conta com Dígito</label>
              <input value={info.account || ''} onChange={e => update('account', e.target.value || null)} style={inputStyle} placeholder="00000-0" />
            </div>
            <div>
              <label style={labelStyle}>Nome do Titular</label>
              <input value={info.accountHolderName || ''} onChange={e => update('accountHolderName', e.target.value || null)} style={inputStyle} placeholder="Nome igual na conta" />
            </div>
            <div>
              <label style={labelStyle}>CPF/CNPJ do Titular</label>
              <input value={info.accountHolderDocument || ''} onChange={e => update('accountHolderDocument', e.target.value || null)} style={inputStyle} placeholder="Documento do titular" />
            </div>
          </div>

          {/* 5. DOCUMENTOS */}
          <SectionHeader icon={FileCheck} title="5. Checklist de Documentos" />
          <p style={{ fontSize: '0.6875rem', color: '#8b8fa7', marginBottom: '0.75rem' }}>
            Marque os documentos que já foram entregues e validados.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: '#fafbfc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e8ecf4' }}>
            <CheckboxField label="Certificado MEI" checked={!!info.hasMeiCertificate} onChange={c => update('hasMeiCertificate', c)} />
            <CheckboxField label="Contrato Assinado" checked={!!info.hasSignedContract} onChange={c => update('hasSignedContract', c)} />
            <CheckboxField label="Documento Pessoal" checked={!!info.hasPersonalDocument} onChange={c => update('hasPersonalDocument', c)} />
            <CheckboxField label="Comprovante Bancário" checked={!!info.hasBankProof} onChange={c => update('hasBankProof', c)} />
            <CheckboxField label="Comprovante de Endereço" checked={!!info.hasAddressProof} onChange={c => update('hasAddressProof', c)} />
            <CheckboxField label="Alvará/Licença" checked={!!info.hasLicense} onChange={c => update('hasLicense', c)} />
          </div>

          {/* 6. OBSERVAÇÕES */}
          <div style={{ marginTop: '1.5rem' }}>
            <label style={labelStyle}>Observações Gerais</label>
            <textarea value={info.contractNotes || ''} onChange={e => update('contractNotes', e.target.value || null)}
              rows={3} style={{ ...inputStyle, resize: 'vertical' as any }} placeholder="Detalhes adicionais..." />
          </div>
        </div>
      )}

      {/* Deactivate Warning Modal */}
      {showDeactivateConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowDeactivateConfirm(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: '1rem', width: '90%', maxWidth: '400px', padding: '1.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1e1e2d', marginBottom: '0.5rem' }}>Desativar parceria?</h3>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Deseja desativar a parceria deste profissional? Os dados serão mantidos no sistema, mas a parceria ficará inativa.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setShowDeactivateConfirm(false)} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', background: '#f1f3f9', color: '#374151', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => { update('isPartner', false); setShowDeactivateConfirm(false) }} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', background: '#ef4444', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                Desativar parceria
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
