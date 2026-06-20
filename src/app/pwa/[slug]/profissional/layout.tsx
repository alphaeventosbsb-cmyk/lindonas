import { PWABottomNav } from "@/components/pwa/bottom-nav"

export default function ProfissionalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex-1 overflow-y-auto w-full pb-24">
        {children}
      </div>
      <PWABottomNav type="profissional" />
    </>
  )
}
