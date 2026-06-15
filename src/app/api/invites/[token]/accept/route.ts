import { NextResponse } from "next/server"
import { adminDb, adminAuth } from "@/lib/firebase/admin"
import { isSuperAdmin, normalizeAuthEmail } from "@/lib/auth/super-admin"
import { resolveEmployeeRBACPermissions } from "@/lib/rbac/rbac-utils"

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    let body: { idToken?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Corpo da requisicao invalido." }, { status: 400 })
    }

    const { idToken } = body
    if (!token || !idToken) {
      return NextResponse.json({ error: "Token de convite ou de autenticacao nao fornecido." }, { status: 400 })
    }

    let decodedToken
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken)
    } catch (error) {
      console.error("Erro ao verificar ID Token:", error)
      return NextResponse.json({ error: "Autenticacao invalida. Faca login novamente." }, { status: 401 })
    }

    const uid = decodedToken.uid
    const email = normalizeAuthEmail(decodedToken.email)

    const snapshot = await adminDb
      .collection("employees")
      .where("invite.token_hash", "==", token)
      .limit(1)
      .get()

    if (snapshot.empty) {
      return NextResponse.json({ error: "Convite nao encontrado ou invalido." }, { status: 404 })
    }

    const employeeDoc = snapshot.docs[0]
    const employeeData = employeeDoc.data()
    const invite = employeeData.invite

    if (!invite || invite.status === "revoked") {
      return NextResponse.json({ error: "Este convite foi revogado." }, { status: 403 })
    }

    if (invite.status === "expired" || (invite.expires_at && new Date(invite.expires_at) < new Date())) {
      return NextResponse.json({ error: "Este convite expirou." }, { status: 403 })
    }

    if (employeeData.access_enabled === false) {
      return NextResponse.json({ error: "Seu acesso ao painel esta desativado." }, { status: 403 })
    }

    const expectedEmail = normalizeAuthEmail(employeeData.email)
    if (expectedEmail && expectedEmail !== email) {
      await adminDb.collection("audit_logs").add({
        module: "invites",
        action_type: "invite_email_mismatch",
        description: "Tentativa de aceite de convite com e-mail Google diferente do e-mail do profissional.",
        user_id: uid,
        user_name: decodedToken.name || email || "Usuario Google",
        user_role: "professional",
        details: {
          professional_id: employeeDoc.id,
          company_id: employeeData.company_id || null,
          expected_email: expectedEmail,
          google_email: email || null,
        },
        created_at: new Date().toISOString(),
      })
      return NextResponse.json({ error: "Este convite foi enviado para outro e-mail. Entre com a conta Google correta ou solicite um novo convite." }, { status: 403 })
    }

    if (employeeData.auth_uid && employeeData.auth_uid !== uid) {
      return NextResponse.json({ error: "Este convite ja foi vinculado a outra conta Google. Entre com o Google correto ou solicite um novo." }, { status: 403 })
    }

    const now = new Date().toISOString()
    const rbacPermissions = resolveEmployeeRBACPermissions({
      rbac_permissions: employeeData.rbac_permissions,
      rbac_profile_id: employeeData.rbac_profile_id,
      permissions: employeeData.permissions,
    })
    const superAdmin = isSuperAdmin(email)
    const saasRole = superAdmin ? "master_admin" : "professional"

    await employeeDoc.ref.update({
      auth_uid: uid,
      google_email: email || null,
      access_enabled: true,
      role: "professional",
      "invite.status": "active",
      "invite.accepted_at": now,
      "invite.last_login_at": now,
      updated_at: now,
    })

    const saasUsersSnapshot = await adminDb
      .collection("saas_users")
      .where("firebase_uid", "==", uid)
      .limit(1)
      .get()

    if (saasUsersSnapshot.empty) {
      await adminDb.collection("saas_users").add({
        firebase_uid: uid,
        email: email || null,
        name: employeeData.name || decodedToken.name || "Profissional",
        role: saasRole,
        company_id: superAdmin ? "__master__" : (employeeData.company_id || null),
        professional_id: employeeDoc.id,
        permissions: superAdmin ? [] : rbacPermissions,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
    } else {
      const saasUserDoc = saasUsersSnapshot.docs[0]

      if (superAdmin) {
        await saasUserDoc.ref.update({
          role: "master_admin",
          is_active: true,
          updated_at: now,
        })
      } else {
        await saasUserDoc.ref.update({
          company_id: employeeData.company_id || null,
          professional_id: employeeDoc.id,
          role: "professional",
          permissions: rbacPermissions,
          is_active: true,
          updated_at: now,
        })
      }
    }

    await adminDb.collection("audit_logs").add({
      module: "invites",
      action_type: "invite_accepted",
      description: "Convite aceito e usuario Google vinculado ao profissional.",
      user_id: uid,
      user_name: employeeData.name || decodedToken.name || email || "Profissional",
      user_role: saasRole,
      details: {
        professional_id: employeeDoc.id,
        company_id: employeeData.company_id || null,
        google_email: email || null,
        rbac_profile_id: employeeData.rbac_profile_id || null,
        permissions_count: rbacPermissions.length,
        super_admin: superAdmin,
      },
      created_at: now,
    })

    return NextResponse.json({ success: true, message: "Conta vinculada com sucesso!" })
  } catch (error) {
    console.error("Erro ao processar aceite de convite:", error)
    return NextResponse.json({ error: "Erro interno ao processar aceite." }, { status: 500 })
  }
}
