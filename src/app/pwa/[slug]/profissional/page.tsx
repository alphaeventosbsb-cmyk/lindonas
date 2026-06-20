import { redirect } from "next/navigation"

export default async function PWAProfissionalRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/pwa/${slug}/profissional/home`)
}
