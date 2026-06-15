"use client"

import { useEffect, useState } from "react"
import { getAuthInstance } from "@/lib/firebase/config"
import { onAuthStateChanged, type User } from "firebase/auth"
import { createDocument, fetchCollection, fetchCollectionWhere } from "@/lib/firebase/client-utils"
import type { SaaSPlan } from "@/lib/types/database"
import { useRouter } from "next/navigation"
import { formatCurrency } from "@/lib/utils"
import { Loader2, Building2, User as UserIcon, CreditCard, Clock, Scissors, Check, ChevronRight, ChevronLeft, Link2, Crown } from "lucide-react"
import { toast } from "sonner"

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
  border: '2px solid #e2e8f0', backgroundColor: '#fff', color: '#1e1e2d',
  fontSize: '0.875rem', fontWeight: 500, outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem'
}

const steps = [
  { label: "Dados Pessoais", icon: UserIcon },
  { label: "Empresa", icon: Building2 },
  { label: "Plano", icon: CreditCard },
  { label: "Horários", icon: Clock },
  { label: "Serviços", icon: Scissors },
  { label: "Finalizar", icon: Link2 },
]

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

export default function OnboardingPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(0)
  const [plans, setPlans] = useState<SaaSPlan[]>([])
  const [createdSlug, setCreatedSlug] = useState("")
  const router = useRouter()

  const [owner, setOwner] = useState({ name: "", phone: "", email: "" })
  const [company, setCompany] = useState({ name: "", whatsapp: "", document: "", address: "", slug: "" })
  const [selectedPlan, setSelectedPlan] = useState("")
  const [hours, setHours] = useState(weekDays.map((_, i) => ({
    day: i, active: i >= 1 && i <= 5, start: "08:00", end: "18:00"
  })))
  const [services, setServices] = useState([
    { name: "", price: "", duration: "60" }
  ])

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuthInstance(), async (u) => {
      if (!u) { router.push("/admin/login"); return }
      setUser(u)
      setOwner(prev => ({
        ...prev,
        name: u.displayName || prev.name,
        email: u.email || prev.email,
      }))
      const p = await fetchCollection<SaaSPlan>("saas_plans")
      p.sort((a, b) => a.display_order - b.display_order)
      setPlans(p.filter(x => x.is_active))
      setLoading(false)
    })
    return () => unsub()
  }, [router])

  const generateSlug = (name: string) => {
    return name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleComplete = async () => {
    if (!user) return
    setSaving(true)

    try {
      const slug = company.slug || generateSlug(company.name)
      const trialEnd = new Date()
      trialEnd.setDate(trialEnd.getDate() + 7)

      // Create company
      const comp = await createDocument("companies", {
        name: company.name,
        slug,
        logo_url: null, cover_image_url: null,
        phone: null, whatsapp: company.whatsapp,
        email: user.email, document: company.document || null,
        address: company.address || null,
        instagram: null, about_text: null, primary_color: null,
        owner_id: user.uid,
        owner_name: owner.name,
        owner_email: user.email,
        plan_id: selectedPlan || null,
        subscription_status: "trial",
        trial_ends_at: trialEnd.toISOString(),
        payment_due_date: null,
        is_blocked: false,
        gallery_images: [], youtube_videos: [],
      }) as any

      const companyId = comp.id

      // Create SaaS user
      await createDocument("saas_users", {
        company_id: companyId,
        firebase_uid: user.uid,
        name: owner.name,
        email: user.email,
        phone: owner.phone || null,
        role: "business_owner",
        permissions: [],
        is_active: true,
      })

      // Create business hours
      for (const h of hours) {
        await createDocument("business_hours", {
          company_id: companyId,
          day_of_week: h.day,
          start_time: h.start,
          end_time: h.end,
          is_active: h.active,
        })
      }

      // Create services
      for (const svc of services.filter(s => s.name)) {
        await createDocument("services", {
          company_id: companyId,
          category_id: null,
          name: svc.name,
          description: null,
          price: parseFloat(svc.price) || 0,
          promotional_price: null,
          duration_minutes: parseInt(svc.duration) || 60,
          image_url: null,
          featured: false,
          is_active: true,
          display_order: 0,
        })
      }

      // Create settings
      await createDocument("settings", {
        company_id: companyId,
        business_name: company.name,
        whatsapp: company.whatsapp,
        phone: null, address: company.address || null,
        instagram: null, logo_url: null, primary_color: null,
        cnpj: company.document || null, company_legal_name: null,
        booking_rules: null, notification_settings: null,
      })

      setCreatedSlug(slug)
      setStep(5)
      toast.success("Empresa criada com sucesso!")
    } catch (err) {
      console.error(err)
      toast.error("Erro ao criar empresa")
    }
    setSaving(false)
  }

  const canProceed = () => {
    if (step === 0) return owner.name && owner.email
    if (step === 1) return company.name && company.whatsapp
    if (step === 2) return true
    if (step === 3) return true
    if (step === 4) return true
    return true
  }

  const nextStep = () => {
    if (step === 4) {
      handleComplete()
    } else {
      setStep(s => Math.min(s + 1, 5))
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f4f6fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 className="w-8 h-8 animate-spin text-[#7c5cfc]" />
    </div>
  )

  const planGradients = [
    'linear-gradient(135deg, #6b7280, #9ca3af)',
    'linear-gradient(135deg, #5b8def, #93b5f5)',
    'linear-gradient(135deg, #7c5cfc, #a78bfa)',
    'linear-gradient(135deg, #f59e0b, #f97316)',
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f4f6fb 0%, #eef0ff 100%)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '40rem', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '0.875rem', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem', boxShadow: '0 8px 24px rgba(124,92,252,0.25)' }}>
            <Crown style={{ width: '1.5rem', height: '1.5rem', color: '#fff' }} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e1e2d', fontFamily: "var(--font-heading)", marginBottom: '0.375rem' }}>Configure sua Empresa</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Siga os passos abaixo para começar a usar o sistema</p>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', marginBottom: '2rem' }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <div style={{
                width: '2rem', height: '2rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i <= step ? 'linear-gradient(135deg, #7c5cfc, #a78bfa)' : '#e5e7eb',
                color: i <= step ? '#fff' : '#9ca3af', fontSize: '0.6875rem', fontWeight: 700,
                boxShadow: i === step ? '0 4px 12px rgba(124,92,252,0.3)' : 'none',
                transition: 'all 0.3s',
              }}>
                {i < step ? <Check style={{ width: '0.875rem', height: '0.875rem' }} /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div style={{ width: '1.5rem', height: '2px', background: i < step ? '#7c5cfc' : '#e5e7eb', transition: 'background 0.3s' }} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div style={{ background: '#fff', borderRadius: '1.25rem', padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {(() => { const Icon = steps[step].icon; return <Icon style={{ width: '1.25rem', height: '1.25rem', color: '#7c5cfc' }} /> })()}
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e1e2d', fontFamily: "var(--font-heading)" }}>{steps[step].label}</h2>
          </div>

          {/* Step 0: Owner */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Seu Nome *</label>
                <input value={owner.name} onChange={e => setOwner({ ...owner, name: e.target.value })} style={inputStyle} placeholder="Nome completo" />
              </div>
              <div>
                <label style={labelStyle}>Email *</label>
                <input value={owner.email} onChange={e => setOwner({ ...owner, email: e.target.value })} style={inputStyle} placeholder="email@email.com" disabled />
              </div>
              <div>
                <label style={labelStyle}>Telefone</label>
                <input value={owner.phone} onChange={e => setOwner({ ...owner, phone: e.target.value })} style={inputStyle} placeholder="(00) 00000-0000" />
              </div>
            </div>
          )}

          {/* Step 1: Company */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Nome da Empresa *</label>
                <input value={company.name} onChange={e => {
                  setCompany({ ...company, name: e.target.value, slug: generateSlug(e.target.value) })
                }} style={inputStyle} placeholder="Ex: Studio Belíssima" />
              </div>
              <div>
                <label style={labelStyle}>WhatsApp *</label>
                <input value={company.whatsapp} onChange={e => setCompany({ ...company, whatsapp: e.target.value })} style={inputStyle} placeholder="61998148986" />
              </div>
              <div>
                <label style={labelStyle}>CNPJ/CPF</label>
                <input value={company.document} onChange={e => setCompany({ ...company, document: e.target.value })} style={inputStyle} placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <label style={labelStyle}>Endereço</label>
                <input value={company.address} onChange={e => setCompany({ ...company, address: e.target.value })} style={inputStyle} placeholder="Rua, número, bairro, cidade" />
              </div>
              {company.slug && (
                <div style={{ padding: '0.75rem', background: '#f0ecff', borderRadius: '0.75rem', border: '1px solid #e0d4ff' }}>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>Sua página de agendamento:</p>
                  <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#7c5cfc', fontFamily: 'monospace' }}>
                    /agendar/{company.slug}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Plan */}
          {step === 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {plans.map((plan, i) => (
                <button key={plan.id} onClick={() => setSelectedPlan(plan.id)} type="button"
                  style={{
                    padding: '1.25rem', borderRadius: '0.875rem', textAlign: 'left', cursor: 'pointer',
                    background: selectedPlan === plan.id ? '#f0ecff' : '#fafbfc',
                    border: selectedPlan === plan.id ? '2px solid #7c5cfc' : '2px solid #e5e7eb',
                    transition: 'all 0.2s',
                  }}>
                  <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem', background: planGradients[i % planGradients.length] }}>
                    <CreditCard style={{ width: '1rem', height: '1rem', color: '#fff' }} />
                  </div>
                  <h4 style={{ fontWeight: 700, color: '#1e1e2d', fontSize: '1rem', marginBottom: '0.25rem' }}>{plan.name}</h4>
                  <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7c5cfc', marginBottom: '0.5rem' }}>
                    {plan.price === 0 ? 'Grátis' : `${formatCurrency(plan.price)}/mês`}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {plan.features.slice(0, 4).map((f, fi) => (
                      <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Check style={{ width: '0.625rem', height: '0.625rem', color: '#22c997', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Hours */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {hours.map((h, i) => (
                <div key={h.day} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0' }}>
                  <button onClick={() => {
                    const nf = [...hours]; nf[i].active = !nf[i].active; setHours(nf)
                  }}
                    style={{
                      width: '4rem', padding: '0.375rem', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: 700,
                      border: 'none', cursor: 'pointer',
                      background: h.active ? 'linear-gradient(135deg, #7c5cfc, #a78bfa)' : '#f3f4f6',
                      color: h.active ? '#fff' : '#9ca3af',
                    }}>
                    {weekDays[h.day]}
                  </button>
                  {h.active ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flex: 1 }}>
                      <input type="time" value={h.start} onChange={e => { const nf = [...hours]; nf[i].start = e.target.value; setHours(nf) }}
                        style={{ ...inputStyle, width: '6.5rem', padding: '0.375rem 0.625rem' }} />
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>às</span>
                      <input type="time" value={h.end} onChange={e => { const nf = [...hours]; nf[i].end = e.target.value; setHours(nf) }}
                        style={{ ...inputStyle, width: '6.5rem', padding: '0.375rem 0.625rem' }} />
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontStyle: 'italic' }}>Fechado</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Step 4: Services */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.5rem' }}>Adicione seus primeiros serviços (pode adicionar mais depois)</p>
              {services.map((svc, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 5rem 5rem', gap: '0.5rem', alignItems: 'end' }}>
                  <div>
                    {i === 0 && <label style={labelStyle}>Nome</label>}
                    <input value={svc.name} onChange={e => { const ns = [...services]; ns[i].name = e.target.value; setServices(ns) }}
                      style={inputStyle} placeholder="Ex: Corte Feminino" />
                  </div>
                  <div>
                    {i === 0 && <label style={labelStyle}>R$</label>}
                    <input type="number" value={svc.price} onChange={e => { const ns = [...services]; ns[i].price = e.target.value; setServices(ns) }}
                      style={inputStyle} placeholder="50" />
                  </div>
                  <div>
                    {i === 0 && <label style={labelStyle}>Min</label>}
                    <input type="number" value={svc.duration} onChange={e => { const ns = [...services]; ns[i].duration = e.target.value; setServices(ns) }}
                      style={inputStyle} placeholder="60" />
                  </div>
                </div>
              ))}
              <button onClick={() => setServices([...services, { name: "", price: "", duration: "60" }])}
                style={{ padding: '0.5rem', borderRadius: '0.5rem', background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                + Adicionar Serviço
              </button>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 5 && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ width: '4rem', height: '4rem', borderRadius: '1rem', background: 'linear-gradient(135deg, #22c997, #5ee0b8)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', boxShadow: '0 8px 24px rgba(34,201,151,0.25)' }}>
                <Check style={{ width: '2rem', height: '2rem', color: '#fff' }} />
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e1e2d', marginBottom: '0.5rem', fontFamily: "var(--font-heading)" }}>Empresa Criada! 🎉</h3>
              <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Sua empresa está pronta. Você tem 7 dias de teste gratuito.</p>

              <div style={{ padding: '1rem', background: '#f0ecff', borderRadius: '0.75rem', marginBottom: '1.5rem', border: '1px solid #e0d4ff' }}>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Link de agendamento:</p>
                <p style={{ fontSize: '1rem', fontWeight: 700, color: '#7c5cfc', fontFamily: 'monospace' }}>
                  {typeof window !== 'undefined' ? window.location.origin : ''}/agendar/{createdSlug}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button onClick={() => router.push('/admin')}
                  style={{ padding: '0.75rem 2rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', boxShadow: '0 4px 14px rgba(124,92,252,0.3)' }}>
                  Ir para o Painel
                </button>
              </div>
            </div>
          )}

          {/* Navigation */}
          {step < 5 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #f3f4f6' }}>
              <button onClick={() => setStep(s => Math.max(s - 1, 0))} disabled={step === 0}
                style={{ padding: '0.625rem 1.25rem', borderRadius: '0.625rem', background: '#f3f4f6', border: 'none', color: step === 0 ? '#d1d5db' : '#6b7280', fontWeight: 600, fontSize: '0.875rem', cursor: step === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <ChevronLeft style={{ width: '1rem', height: '1rem' }} /> Voltar
              </button>
              <button onClick={nextStep} disabled={!canProceed() || saving}
                style={{ padding: '0.625rem 1.5rem', borderRadius: '0.625rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: canProceed() && !saving ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '0.375rem', background: canProceed() ? 'linear-gradient(135deg, #7c5cfc, #a78bfa)' : '#d1d5db', boxShadow: canProceed() ? '0 4px 14px rgba(124,92,252,0.3)' : 'none' }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {step === 4 ? 'Finalizar' : 'Próximo'} <ChevronRight style={{ width: '1rem', height: '1rem' }} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
