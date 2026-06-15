import { BookingWizard } from "@/components/booking/booking-wizard"
import { Sparkles, Shield, Clock, Calendar } from "lucide-react"
import { PublicHeader } from "@/components/public-booking/public-header"

export default function HomePage() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', display: 'flex', flexDirection: 'column' }}>
      <PublicHeader />

      {/* Hero */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #2a2150 0%, #3d2d7a 30%, #7c5cfc 60%, #a78bfa 100%)' }}>
          <div style={{ position: 'absolute', top: '-3rem', left: '25%', width: '24rem', height: '24rem', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', filter: 'blur(48px)' }} />
          <div style={{ position: 'absolute', bottom: '-2rem', right: '25%', width: '20rem', height: '20rem', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', filter: 'blur(32px)' }} />
        </div>
        <div style={{ position: 'relative', padding: '3rem 16px 4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', color: '#fff' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '9999px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', marginBottom: '1.25rem' }}>
            <Sparkles style={{ width: '16px', height: '16px' }} />
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agende agora mesmo</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, lineHeight: 1.15, marginBottom: '0.875rem', fontSize: 'clamp(1.75rem, 5vw, 3.25rem)', maxWidth: '700px' }}>
            Reserve seu horário online em segundos
          </h1>
          <p style={{ opacity: 0.75, lineHeight: 1.6, maxWidth: '500px', fontSize: 'clamp(0.8125rem, 2vw, 1.0625rem)' }}>
            Escolha o serviço, profissional e horário ideal para você.
            Simples, rápido e sem complicação.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', marginTop: '1.5rem' }}>
            {[
              { Icon: Shield, label: "Reserva segura" },
              { Icon: Clock, label: "Em menos de 1 min" },
              { Icon: Calendar, label: "Confirmação imediata" },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <item.Icon style={{ width: '14px', height: '14px', opacity: 0.6 }} />
                <span style={{ fontSize: '0.75rem', opacity: 0.7, fontWeight: 500 }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Booking Card */}
      <main style={{ flex: 1, position: 'relative', zIndex: 10, paddingBottom: '2.5rem' }}>
        <div id="booking-card" style={{
          maxWidth: '1200px',
          width: 'calc(100% - 32px)',
          margin: '-2.5rem auto 0',
          background: '#fff',
          borderRadius: '24px',
          padding: 'clamp(16px, 3vw, 32px)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
          border: '1px solid #e8ecf4',
        }}>
          <BookingWizard />
        </div>
      </main>

      {/* Footer */}
      <footer style={{ background: '#fff', borderTop: '1px solid var(--color-border)', padding: '2rem 16px', marginTop: 'auto', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)' }}>
              <Calendar style={{ width: '16px', height: '16px', color: '#fff' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-foreground)' }}>Agendamento Online</span>
          </div>
          <a href="https://wa.me/5561998148986" style={{ fontSize: '0.8125rem', color: '#8b8fa7', textDecoration: 'none' }}>
            (61) 9.9814-8986
          </a>
          <p style={{ fontSize: '0.6875rem', color: '#8b8fa7', marginTop: '1rem' }}>
            © {new Date().getFullYear()} Agendamento Online. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
