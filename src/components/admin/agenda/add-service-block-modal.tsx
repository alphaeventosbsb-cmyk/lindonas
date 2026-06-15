import { useState, useEffect } from "react"
import { X, User, Scissors, Calendar, Clock, DollarSign } from "lucide-react"
import type { Employee, Service } from "@/lib/types/database"
import { formatCurrency } from "@/lib/utils"

export type ServiceBlock = {
  id: string
  employeeId: string
  serviceId: string
  date: string
  time: string
  duration: number
  price: number
  waitPrevious: boolean
}

interface AddServiceBlockModalProps {
  onClose: () => void
  onSave: (block: ServiceBlock) => void
  employees: Employee[]
  services: Service[]
  isOtherProfessional: boolean
  defaultEmployeeId: string
  defaultDate: string
  defaultTime: string
}

export function AddServiceBlockModal({
  onClose,
  onSave,
  employees,
  services,
  isOtherProfessional,
  defaultEmployeeId,
  defaultDate,
  defaultTime
}: AddServiceBlockModalProps) {
  const [employeeId, setEmployeeId] = useState(isOtherProfessional ? "" : defaultEmployeeId)
  const [serviceId, setServiceId] = useState("")
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState(defaultTime)
  const [duration, setDuration] = useState<number | "">("")
  const [price, setPrice] = useState<number | "">("")
  const [waitPrevious, setWaitPrevious] = useState(false)

  const activeEmp = employees.find(e => e.id === employeeId)
  const availableServices = activeEmp?.service_ids
    ? services.filter(s => s.is_active && activeEmp.service_ids.includes(s.id))
    : services.filter(s => s.is_active)

  useEffect(() => {
    if (serviceId && employeeId) {
      const s = availableServices.find(sv => sv.id === serviceId)
      if (s) {
        setDuration(s.duration_minutes)
        // Check custom price
        let customPrice = s.promotional_price || s.price
        if (activeEmp?.professional_services) {
          const custom = activeEmp.professional_services.find(ps => ps.serviceId === s.id)
          if (custom?.customPrice !== undefined && custom?.customPrice !== null) {
            customPrice = custom.customPrice
          }
        }
        setPrice(customPrice)
      }
    } else {
      setDuration("")
      setPrice("")
    }
  }, [serviceId, employeeId, availableServices, activeEmp])

  const handleSave = () => {
    if (!employeeId || !serviceId || !date || !time || duration === "" || price === "") {
      return // Optional: add toast error
    }

    onSave({
      id: crypto.randomUUID(),
      employeeId,
      serviceId,
      date,
      time,
      duration: Number(duration),
      price: Number(price),
      waitPrevious
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
    border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#1e1e2d',
    fontSize: '0.875rem', fontWeight: 500, outline: 'none'
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em'
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 99998 }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 99999, background: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '32rem',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh'
      }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f3f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafbfc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(124,92,252,0.2)' }}>
              <Scissors style={{ width: '1.25rem', height: '1.25rem', color: '#fff' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#1e1e2d' }}>
                {isOtherProfessional ? "Serviço com Outro Profissional" : "Adicionar Serviço"}
              </h2>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#8b8fa7' }}>
            <X style={{ width: '1.25rem', height: '1.25rem' }} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}><User style={{ width: '10px', height: '10px', display: 'inline', marginRight: '4px' }} />Profissional</label>
              <select value={employeeId} onChange={e => { setEmployeeId(e.target.value); setServiceId(""); }} style={inputStyle} disabled={!isOtherProfessional}>
                <option value="">Selecione</option>
                {employees.filter(e => e.is_active && e.has_schedule !== false).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}><Scissors style={{ width: '10px', height: '10px', display: 'inline', marginRight: '4px' }} />Serviço</label>
              <select value={serviceId} onChange={e => setServiceId(e.target.value)} style={inputStyle} disabled={!employeeId}>
                <option value="">Selecione</option>
                {availableServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}><Calendar style={{ width: '10px', height: '10px', display: 'inline', marginRight: '4px' }} />Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}><Clock style={{ width: '10px', height: '10px', display: 'inline', marginRight: '4px' }} />Início</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...inputStyle, background: waitPrevious ? '#f1f5f9' : '#fff' }} readOnly={waitPrevious} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Duração (min)</label>
              <input type="number" min={0} value={duration} onChange={e => setDuration(Number(e.target.value))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}><DollarSign style={{ width: '10px', height: '10px', display: 'inline', marginRight: '4px' }} />Valor (R$)</label>
              <input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(Number(e.target.value))} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={waitPrevious} onChange={e => setWaitPrevious(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#7c5cfc' }} />
              Aguardar término do serviço anterior (Sequencial)
            </label>
          </div>
        </div>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f3f9', display: 'flex', gap: '0.75rem', background: '#fafbfc' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.625rem', border: '2px solid #e8ecf4', background: '#fff', color: '#475569', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={!employeeId || !serviceId || duration === "" || price === ""}
            style={{ flex: 2, padding: '0.75rem', borderRadius: '0.625rem', border: 'none', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: (!employeeId || !serviceId || duration === "" || price === "") ? 'not-allowed' : 'pointer', opacity: (!employeeId || !serviceId || duration === "" || price === "") ? 0.6 : 1, boxShadow: '0 4px 14px rgba(124,92,252,0.25)' }}>
            Salvar Serviço Adicional
          </button>
        </div>
      </div>
    </>
  )
}
