"use client"

import { motion } from "framer-motion"

export function SkeletonLoader() {
  const shimmerStyle: React.CSSProperties = {
    background: 'linear-gradient(90deg, #f1f3f9 25%, #e8ecf4 50%, #f1f3f9 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s ease-in-out infinite',
    borderRadius: '0.5rem',
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: 'calc(100vh - 7rem)',
      overflow: 'hidden', gap: '0',
    }}>
      {/* Header skeleton */}
      <div style={{
        padding: '0.75rem 1rem', background: '#fff', borderBottom: '1px solid #e8ecf4',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1rem', borderRadius: '1rem 1rem 0 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ ...shimmerStyle, width: '120px', height: '34px' }} />
          <div style={{ ...shimmerStyle, width: '200px', height: '20px' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ ...shimmerStyle, width: '140px', height: '34px' }} />
          <div style={{ ...shimmerStyle, width: '160px', height: '34px' }} />
        </div>
      </div>

      {/* Stats skeleton */}
      <div style={{
        display: 'flex', gap: '0.375rem', padding: '0.5rem 1rem',
        background: '#fafbfc', borderBottom: '1px solid #e8ecf4',
      }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ ...shimmerStyle, width: '90px', height: '24px', borderRadius: '2rem' }} />
        ))}
      </div>

      {/* Filters skeleton */}
      <div style={{
        display: 'flex', gap: '0.5rem', padding: '0.5rem 1rem',
        background: '#fff', borderBottom: '1px solid #e8ecf4',
      }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ ...shimmerStyle, width: i === 0 ? '200px' : '130px', height: '34px' }} />
        ))}
      </div>

      {/* Grid skeleton */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Mini calendar */}
        <div className="hidden lg:block" style={{
          width: '280px', borderRight: '1px solid #e8ecf4', padding: '1rem',
          display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#fafbfc',
        }}>
          <div style={{ ...shimmerStyle, width: '100%', height: '30px' }} />
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.375rem',
          }}>
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} style={{ ...shimmerStyle, aspectRatio: '1', width: '100%' }} />
            ))}
          </div>
        </div>

        {/* Day grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Professional headers */}
          <div style={{
            display: 'flex', borderBottom: '1px solid #e8ecf4', background: '#fff',
          }}>
            <div style={{ width: '60px', borderRight: '1px solid #e8ecf4' }} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{
                flex: '1 0 180px', padding: '0.5rem 0.75rem',
                borderRight: '1px solid #f1f3f9', display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <div style={{ ...shimmerStyle, width: '2rem', height: '2rem', borderRadius: '0.625rem' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                  <div style={{ ...shimmerStyle, width: '80%', height: '12px' }} />
                  <div style={{ ...shimmerStyle, width: '50%', height: '10px' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Time slots */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ width: '60px', borderRight: '1px solid #e8ecf4', background: '#fafbfc' }}>
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} style={{ height: '120px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '0.25rem', borderBottom: '1px solid #e8ecf4' }}>
                  <div style={{ ...shimmerStyle, width: '30px', height: '12px' }} />
                </div>
              ))}
            </div>
            <div style={{ flex: 1, display: 'flex' }}>
              {Array.from({ length: 4 }).map((_, ci) => (
                <div key={ci} style={{ flex: '1 0 180px', borderRight: '1px solid #f1f3f9', position: 'relative' }}>
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div key={i} style={{ height: '120px', borderBottom: '1px solid #f5f7fa' }} />
                  ))}
                  {/* Random card skeletons */}
                  {[2, 5, 8].map(slot => (
                    <div key={slot} style={{
                      position: 'absolute', top: `${slot * 120 + 10}px`, left: '4px', right: '4px',
                      height: '80px',
                    }}>
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        style={{ ...shimmerStyle, width: '100%', height: '100%', borderRadius: '0.5rem' }}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
