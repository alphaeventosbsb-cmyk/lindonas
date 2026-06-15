import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { forbiddenResponse, getRequestAccess, hasAnyApiPermission, unauthorizedResponse } from "@/lib/auth/server-access"

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!
const API_KEY = process.env.CLOUDINARY_API_KEY!
const API_SECRET = process.env.CLOUDINARY_API_SECRET!

function permissionsForUploadFolder(folder: string): string[] {
  if (folder.includes("profissionais")) return ["professionals.create", "professionals.edit"]
  if (folder.includes("servicos")) return ["services.create", "services.edit"]
  if (folder.includes("clientes")) return ["clients.create", "clients.edit", "agenda.create"]
  return ["settings.edit"]
}

export async function POST(req: NextRequest) {
  try {
    let access
    try {
      access = await getRequestAccess(req)
    } catch {
      return unauthorizedResponse()
    }

    if (!access.authenticated) {
      return unauthorizedResponse()
    }

    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
      return NextResponse.json(
        { error: "Cloudinary nao configurado. Verifique as variaveis de ambiente." },
        { status: 500 }
      )
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const folder = (formData.get("folder") as string) || "salao/geral"

    if (!hasAnyApiPermission(access, permissionsForUploadFolder(folder))) {
      return forbiddenResponse()
    }

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Formato nao permitido. Use: jpg, png ou webp" },
        { status: 400 }
      )
    }

    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Maximo: 4MB" },
        { status: 400 }
      )
    }

    const timestamp = Math.round(Date.now() / 1000)
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`
    const signature = crypto
      .createHash("sha256")
      .update(paramsToSign + API_SECRET)
      .digest("hex")

    const cloudinaryForm = new FormData()
    cloudinaryForm.append("file", file)
    cloudinaryForm.append("folder", folder)
    cloudinaryForm.append("timestamp", String(timestamp))
    cloudinaryForm.append("api_key", API_KEY)
    cloudinaryForm.append("signature", signature)

    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: cloudinaryForm,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("Cloudinary upload error:", errorData)
      return NextResponse.json(
        { error: errorData?.error?.message || "Erro ao enviar imagem para o Cloudinary" },
        { status: 500 }
      )
    }

    const result = await response.json()

    return NextResponse.json({
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Erro interno no upload" },
      { status: 500 }
    )
  }
}
