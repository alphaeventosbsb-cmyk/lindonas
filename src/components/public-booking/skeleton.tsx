"use client"

export function SkeletonCard() {
  return (
    <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #f0f0f5', animation: 'pulse 1.5s ease-in-out infinite' }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '0.75rem', background: '#f3f4f6', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: '60%', height: '0.875rem', background: '#f3f4f6', borderRadius: '0.375rem', marginBottom: '0.5rem' }} />
          <div style={{ width: '40%', height: '0.75rem', background: '#f3f4f6', borderRadius: '0.375rem' }} />
        </div>
      </div>
    </div>
  )
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  )
}
