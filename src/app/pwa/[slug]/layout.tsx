import type { Metadata } from "next"
import { PWATenantProvider } from "@/components/pwa/pwa-tenant-context"
import { PWAWrapper } from "@/components/pwa/pwa-wrapper"
import { PwaRegistry } from "@/components/pwa/pwa-registry"
import { PwaShell } from "@/components/pwa/ui/pwa-shell"

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
      <PwaShell>
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide pb-24 relative">
          <PWAWrapper>
            {children}
          </PWAWrapper>
        </div>
      </PwaShell>
    </PWATenantProvider>
  )
}
