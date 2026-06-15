import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 400 });
    }

    // Buscar o profissional pelo token do convite usando Admin SDK (ignora Firestore Rules)
    const snapshot = await adminDb
      .collection("employees")
      .where("invite.token_hash", "==", token)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "Convite não encontrado ou inválido." }, { status: 404 });
    }

    const employeeDoc = snapshot.docs[0];
    const employeeData = employeeDoc.data();
    const invite = employeeData.invite;

    if (!invite) {
      return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
    }

    // Validar status
    if (invite.status === "revoked") {
      return NextResponse.json({ error: "Este convite foi revogado." }, { status: 403 });
    }

    // Validar expiração
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      if (invite.status !== "expired") {
        await employeeDoc.ref.update({ "invite.status": "expired" });
      }
      return NextResponse.json({ error: "Este convite expirou. Solicite um novo acesso." }, { status: 403 });
    }

    if (employeeData.access_enabled === false) {
      return NextResponse.json({ error: "Seu acesso ao painel está desativado." }, { status: 403 });
    }

    if (invite.status === "active" && employeeData.auth_uid) {
      return NextResponse.json({ error: "Este convite já foi utilizado.", used: true }, { status: 403 });
    }

    // Buscar informações da empresa para mostrar na tela
    let companyName = "Estabelecimento";
    if (employeeData.company_id) {
      const compDoc = await adminDb.collection("companies").doc(employeeData.company_id).get();
      if (compDoc.exists) {
        companyName = compDoc.data()?.name || "Estabelecimento";
      }
    }

    // Retorna apenas dados não-sensíveis necessários para a tela de convite
    return NextResponse.json({
      employee_id: employeeDoc.id,
      employee_name: employeeData.name,
      employee_email: employeeData.email,
      company_id: employeeData.company_id,
      company_name: companyName,
      status: invite.status,
    });

  } catch (error) {
    console.error("Erro ao validar convite:", error);
    return NextResponse.json({ error: "Erro interno ao validar o convite." }, { status: 500 });
  }
}
