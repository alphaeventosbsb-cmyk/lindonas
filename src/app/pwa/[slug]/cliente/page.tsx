import { redirect } from "next/navigation"

export default async function PWAClienteRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/pwa/${slug}/cliente/home`)
}
