"use client"

import type { BookingData } from "./booking-wizard"
import { CheckCircle2, MessageCircle, CalendarPlus } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface Props {
  bookingData: BookingData
  onNewBooking: () => void
}

export function Confirmation({ bookingData, onNewBooking }: Props) {
  const price = bookingData.service?.promotional_price || bookingData.service?.price || 0
  const dateStr = bookingData.date?.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  const whatsappMsg = encodeURIComponent(
    `Olá! Meu agendamento foi confirmado:\n\n` +
    `📋 Serviço: ${bookingData.service?.name}\n` +
    `👤 Profissional: ${bookingData.employee?.name || "Qualquer disponível"}\n` +
    `📅 Data: ${dateStr}\n` +
    `🕐 Horário: ${bookingData.time}\n` +
    `💰 Valor: ${formatCurrency(price)}\n\n` +
    `Nome: ${bookingData.clientName}\nTelefone: ${bookingData.clientPhone}`
  )

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '1rem', padding: 'clamp(1.25rem, 3vw, 2rem)', border: '1px solid #e8ecf4', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 1.25rem' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #22c997, #5ee0b8)', boxShadow: '0 8px 24px rgba(34,201,151,0.25)' }}>
            <CheckCircle2 style={{ width: '40px', height: '40px', color: '#fff' }} />
          </div>
        </div>

        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', fontWeight: 700, color: '#1e1e2d', marginBottom: '0.5rem' }}>
          Agendamento Confirmado! 🎉
        </h2>
        <p style={{ color: '#8b8fa7', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          Tudo certo, <strong style={{ color: '#1e1e2d' }}>{bookingData.clientName}</strong>! Seu horário está reservado.
        </p>

        <div style={{ background: '#fafbfc', borderRadius: '0.75rem', padding: '1rem', textAlign: 'left', marginBottom: '1.5rem', border: '1px solid #e8ecf4' }}>
          {[
            ["📋 Serviço", bookingData.service?.name],
            ["👤 Profissional", bookingData.employee?.name || "A definir"],
            ["📅 Data", dateStr],
            ["🕐 Horário", bookingData.time],
            ["💰 Valor", formatCurrency(price)],
          ].map(([label, value], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 0', borderBottom: i < 4 ? '1px solid #e8ecf4' : 'none' }}>
              <span style={{ fontSize: '0.8125rem', color: '#8b8fa7' }}>{label}</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e1e2d' }}>{value}</span>
            </div>
          ))}
        </div>

        <a href={`https://wa.me/5561998148986?text=${whatsappMsg}`} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.875rem', borderRadius: '0.75rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none', marginBottom: '0.75rem', minHeight: '48px', background: 'linear-gradient(135deg, #25D366, #128c7e)', boxShadow: '0 4px 14px rgba(37,211,102,0.25)' }}>
          <MessageCircle style={{ width: '18px', height: '18px' }} /> Enviar confirmação no WhatsApp
        </a>

        <button onClick={onNewBooking}
          style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: '2px solid #e8ecf4', background: '#fff', color: '#1e1e2d', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', minHeight: '48px' }}>
          <CalendarPlus style={{ width: '16px', height: '16px' }} /> Fazer novo agendamento
        </button>
      </div>
    </div>
  )
}
