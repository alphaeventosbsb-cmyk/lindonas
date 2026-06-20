import type { Metadata } from "next"
import { PWATenantProvider } from "@/components/pwa/pwa-tenant-context"
import { PWAWrapper } from "@/components/pwa/pwa-wrapper"
import { PwaRegistry } from "@/components/pwa/pwa-registry"

export const metadata: Metadata = {
  title: "Lindonas App",
  description: "App Oficial do Salão Lindonas",
}

export default async function PWALayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <PWATenantProvider slug={slug}>
      <PwaRegistry />
      <div className="flex flex-col h-[100dvh] bg-[var(--color-background)] overflow-hidden w-full max-w-md mx-auto relative shadow-2xl">
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide pb-20 relative">
          <PWAWrapper>
            {children}
          </PWAWrapper>
        </div>
      </div>
    </PWATenantProvider>
  )
}
