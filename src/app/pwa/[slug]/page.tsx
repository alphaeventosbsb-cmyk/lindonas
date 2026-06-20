import Link from "next/link"
import { notFound } from "next/navigation"
import { fetchCollectionWhere } from "@/lib/firebase/client-utils"

export default async function PWASplashScreen({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  
  // Verify if tenant exists
  const companies = await fetchCollectionWhere("companies", "slug", "==", slug)
  if (!companies || companies.length === 0) {
    notFound()
  }
  const company: any = companies[0]

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-between p-8 relative overflow-hidden"
         style={{ background: 'linear-gradient(180deg, #3d1b6e 0%, #220e40 100%)' }}>
      
      {/* Decorative background blur */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[150%] aspect-square bg-[#7c5cfc]/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Top area / Logo placeholder */}
      <div className="mt-16 flex flex-col items-center z-10">
        <div className="w-24 h-24 mb-6 relative">
          <div className="absolute inset-0 bg-white/10 rounded-full blur-xl" />
          {/* Logo */}
          {company.logo_url ? (
            <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover rounded-full shadow-lg" />
          ) : (
            <div className="w-full h-full text-[#d1b0ff] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16">
                <path d="M12,2C12,2 14,8 18,10C22,12 20,16 20,16C20,16 16,14 12,16C8,14 4,16 4,16C4,16 2,12 6,10C10,8 12,2 12,2ZM12,18C12,18 16,20 18,22C20,24 16,24 16,24C16,24 13,22 12,22C11,22 8,24 8,24C8,24 4,24 6,22C8,20 12,18 12,18Z" />
              </svg>
            </div>
          )}
        </div>
        <h1 className="text-3xl font-black text-white tracking-wide text-center">{company.name}</h1>
        <p className="text-[#a78bfa] text-sm tracking-widest uppercase mt-1">Salão de Beleza</p>
      </div>

      {/* Main Text */}
      <div className="text-center mt-12 mb-10 z-10">
        <h2 className="text-2xl font-bold text-white mb-3 leading-tight">Bem-vinda ao<br/>App</h2>
        <p className="text-[#c4bce8] text-sm max-w-[250px] mx-auto leading-relaxed">
          Agende, acompanhe e receba alertas do seu salão favorito.
        </p>
      </div>

      {/* Buttons */}
      <div className="w-full max-w-sm flex flex-col gap-4 z-10">
        <Link href={`/pwa/${slug}/login?type=cliente`} className="w-full h-14 rounded-2xl bg-[var(--color-primary)] text-white font-bold text-[15px] flex items-center justify-center shadow-[0_8px_20px_rgba(124,92,252,0.3)] hover:scale-[0.98] transition-transform">
          Sou Cliente
        </Link>
        <Link href={`/pwa/${slug}/login?type=profissional`} className="w-full h-14 rounded-2xl bg-transparent border border-white/20 text-white font-bold text-[15px] flex items-center justify-center hover:bg-white/5 transition-colors">
          Sou Funcionário
        </Link>
        
        <Link href={`/pwa/${slug}/login`} className="text-center text-[#d1b0ff] text-sm font-medium mt-4 underline decoration-[#d1b0ff]/30 underline-offset-4">
          Fazer login
        </Link>
      </div>
    </div>
  )
}
