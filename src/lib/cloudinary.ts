import { getAuthInstance } from "@/lib/firebase/config"

/**
 * Upload a file to Cloudinary via our secure API route.
 * The API secret never leaves the server.
 *
 * @param file - The File object to upload
 * @param folder - Cloudinary folder path (e.g. "salao/profissionais")
 * @param timeoutMs - Max time to wait for upload (default: 20s)
 * @returns The secure URL of the uploaded image
 */
export async function uploadToCloudinary(
  file: File,
  folder: string = "salao/geral",
  timeoutMs: number = 20000
): Promise<string> {
  // Client-side validations (duplicated from server for fast feedback)
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Formato não permitido. Use: jpg, png ou webp")
  }
  if (file.size > 4 * 1024 * 1024) {
    throw new Error("Arquivo muito grande. Máximo: 4MB")
  }

  const formData = new FormData()
  formData.append("file", file)
  formData.append("folder", folder)
  const idToken = await getAuthInstance().currentUser?.getIdToken()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
      body: formData,
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Erro desconhecido" }))
      throw new Error(errorData.error || `Erro no upload (${response.status})`)
    }

    const result = await response.json()

    if (!result.url) {
      throw new Error("URL da imagem não retornada pelo servidor")
    }

    return result.url
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Timeout no upload da foto. Verifique sua conexão.")
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
