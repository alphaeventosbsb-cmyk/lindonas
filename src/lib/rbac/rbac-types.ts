// ===================== RBAC TYPES =====================

export interface RBACPermission {
  key: string
  label: string
  description: string
}

export interface RBACModule {
  id: string
  label: string
  icon: string // emoji
  permissions: RBACPermission[]
}

export interface RBACProfile {
  id: string
  name: string
  description: string
  permissions: string[]
  isSystem: boolean
}

// ===================== MODULES & PERMISSIONS =====================

export const RBAC_MODULES: RBACModule[] = [
  {
    id: "agenda", label: "Agenda", icon: "📅",
    permissions: [
      { key: "agenda.view", label: "Acessar agenda", description: "Visualizar agenda geral" },
      { key: "agenda.view_own", label: "Visualizar apenas agenda própria", description: "Vê somente seus próprios agendamentos" },
      { key: "agenda.create", label: "Criar agendamentos", description: "Pode criar novos agendamentos" },
      { key: "agenda.edit", label: "Editar agendamentos", description: "Pode modificar agendamentos" },
      { key: "agenda.cancel", label: "Cancelar agendamentos", description: "Pode cancelar agendamentos" },
      { key: "agenda.delete", label: "Excluir agendamentos", description: "Pode excluir agendamentos" },
      { key: "agenda.reschedule", label: "Reagendar agendamentos", description: "Mover para outro horário" },
      { key: "agenda.drag", label: "Arrastar agendamento", description: "Drag & drop na agenda" },
      { key: "agenda.change_professional", label: "Alterar profissional", description: "Trocar profissional do agendamento" },
      { key: "agenda.change_service", label: "Alterar serviço", description: "Trocar serviço do agendamento" },
      { key: "agenda.change_price", label: "Alterar valor do serviço", description: "Modificar preço no agendamento" },
      { key: "agenda.change_duration", label: "Alterar duração", description: "Modificar duração do serviço" },
      { key: "agenda.status.confirm", label: "Confirmar agendamento", description: "Marcar como confirmado" },
      { key: "agenda.status.waiting", label: "Marcar como esperando", description: "Status esperando" },
      { key: "agenda.status.in_progress", label: "Marcar como em atendimento", description: "Status em atendimento" },
      { key: "agenda.status.completed", label: "Marcar como concluído", description: "Status concluído" },
      { key: "agenda.status.cancelled", label: "Marcar como cancelado", description: "Status cancelado" },
      { key: "agenda.status.no_show", label: "Marcar como não compareceu", description: "Status no-show" },
      { key: "agenda.payment.close", label: "Fechar pagamento", description: "Fechar conta do agendamento" },
      { key: "agenda.view_price", label: "Visualizar preço do serviço", description: "Ver valores na agenda" },
      { key: "agenda.add_service", label: "Adicionar serviço ao agendamento", description: "Incluir serviço adicional" },
      { key: "agenda.remove_service", label: "Remover serviço do agendamento", description: "Retirar serviço" },
      { key: "agenda.notes", label: "Adicionar observação", description: "Escrever notas" },
      { key: "agenda.labels", label: "Aplicar etiquetas", description: "Gerenciar etiquetas" },
      { key: "agenda.whatsapp", label: "Enviar WhatsApp", description: "Enviar mensagem pelo WhatsApp" },
      { key: "agenda.block_time", label: "Bloquear horário", description: "Bloquear slots" },
      { key: "agenda.unblock_time", label: "Liberar horário bloqueado", description: "Desbloquear slots" },
      { key: "agenda.absence.create", label: "Registrar ausência própria", description: "Criar ausência para si" },
      { key: "agenda.absence.create_other", label: "Registrar ausência para outro", description: "Criar ausência para outro profissional" },
    ],
  },
  {
    id: "clients", label: "Clientes", icon: "👤",
    permissions: [
      { key: "clients.view", label: "Acessar clientes", description: "Visualizar lista de clientes" },
      { key: "clients.create", label: "Cadastrar clientes", description: "Criar novos clientes" },
      { key: "clients.edit", label: "Editar clientes", description: "Modificar dados de clientes" },
      { key: "clients.delete", label: "Excluir clientes", description: "Remover clientes" },
      { key: "clients.export", label: "Exportar clientes", description: "Download de dados" },
      { key: "clients.import", label: "Importar clientes", description: "Importar lista em massa" },
      { key: "clients.history", label: "Ver histórico do cliente", description: "Agendamentos e transações" },
      { key: "clients.credit.add", label: "Adicionar crédito", description: "Lançar crédito para cliente" },
      { key: "clients.credit.remove", label: "Remover crédito", description: "Retirar crédito do cliente" },
      { key: "clients.debit.add", label: "Adicionar débito", description: "Lançar débito para cliente" },
      { key: "clients.debit.pay", label: "Quitar débito", description: "Registrar pagamento de débito" },
      { key: "clients.debit.export", label: "Exportar débitos", description: "Download de lista de débitos" },
      { key: "clients.credit.export", label: "Exportar créditos", description: "Download de lista de créditos" },
      { key: "clients.ranking", label: "Acessar ranking", description: "Ver ranking de clientes" },
      { key: "clients.ranking.export", label: "Exportar ranking", description: "Download do ranking" },
    ],
  },
  {
    id: "professionals", label: "Profissionais", icon: "👥",
    permissions: [
      { key: "professionals.view", label: "Acessar profissionais", description: "Visualizar equipe" },
      { key: "professionals.create", label: "Cadastrar profissionais", description: "Adicionar novo profissional" },
      { key: "professionals.edit", label: "Editar profissionais", description: "Modificar dados" },
      { key: "professionals.delete", label: "Excluir profissionais", description: "Remover profissional" },
      { key: "professionals.export", label: "Exportar profissionais", description: "Download de dados" },
      { key: "professionals.toggle_active", label: "Ativar/inativar", description: "Alterar status" },
      { key: "professionals.schedule.edit", label: "Editar horários", description: "Configurar horários de trabalho" },
      { key: "professionals.services.edit", label: "Editar serviços vinculados", description: "Configurar serviços do profissional" },
      { key: "professionals.commission.view", label: "Visualizar comissão", description: "Ver percentual de comissão" },
      { key: "professionals.commission.edit", label: "Editar comissão base", description: "Alterar percentual" },
      { key: "professionals.access.manage", label: "Gerenciar acesso", description: "Convites e revogação" },
      { key: "professionals.permissions.manage", label: "Editar permissões", description: "Configurar RBAC" },
    ],
  },
  {
    id: "services", label: "Serviços", icon: "✂️",
    permissions: [
      { key: "services.view", label: "Acessar serviços", description: "Visualizar catálogo" },
      { key: "services.create", label: "Cadastrar serviços", description: "Criar novo serviço" },
      { key: "services.edit", label: "Editar serviços", description: "Modificar serviço" },
      { key: "services.delete", label: "Excluir serviços", description: "Remover serviço" },
      { key: "services.export", label: "Exportar serviços", description: "Download do catálogo" },
      { key: "services.import", label: "Importar serviços", description: "Importar catálogo em massa" },
      { key: "services.bulk_delete", label: "Excluir em massa", description: "Excluir múltiplos serviços" },
      { key: "services.category.manage", label: "Gerenciar categorias", description: "Criar/editar/excluir categorias" },
      { key: "services.photo.edit", label: "Editar foto", description: "Alterar imagem do serviço" },
      { key: "services.visibility", label: "Configurar visibilidade online", description: "Exibir/ocultar no agendamento público" },
      { key: "services.stock.configure", label: "Configurar saída de estoque", description: "Vincular produtos ao serviço" },
      { key: "services.promotion", label: "Configurar promoção", description: "Gerenciar preços promocionais" },
    ],
  },
  {
    id: "finance", label: "Financeiro", icon: "💰",
    permissions: [
      { key: "finance.view", label: "Acessar financeiro", description: "Visualizar dados financeiros" },
      { key: "finance.create", label: "Criar lançamento", description: "Novo lançamento financeiro" },
      { key: "finance.edit", label: "Editar lançamento", description: "Modificar lançamento" },
      { key: "finance.delete", label: "Excluir lançamento", description: "Remover lançamento" },
      { key: "finance.expenses", label: "Lançar despesas", description: "Registrar despesas" },
      { key: "finance.export", label: "Exportar financeiro", description: "Download de relatórios" },
      { key: "finance.by_professional", label: "Ver por profissional", description: "Relatório financeiro por profissional" },
    ],
  },
  {
    id: "cash", label: "Caixa", icon: "🏦",
    permissions: [
      { key: "cash.view", label: "Acessar caixa", description: "Visualizar caixa" },
      { key: "cash.open", label: "Abrir caixa", description: "Iniciar operação do dia" },
      { key: "cash.close", label: "Fechar caixa", description: "Encerrar operação do dia" },
      { key: "cash.entry.create", label: "Lançar entrada", description: "Registrar entrada no caixa" },
      { key: "cash.entry.remove", label: "Lançar saída", description: "Registrar saída do caixa" },
      { key: "cash.entry.cancel", label: "Cancelar lançamento", description: "Cancelar operação" },
      { key: "cash.history", label: "Ver histórico", description: "Visualizar caixas anteriores" },
      { key: "cash.export", label: "Exportar caixa", description: "Download de fechamentos e transações" },
      { key: "cash.print", label: "Imprimir resumo", description: "Imprimir fechamento" },
      { key: "cash.refund", label: "Estornar pagamento", description: "Estornar conta fechada" },
      { key: "cash.manage", label: "Gerenciar caixas", description: "Abrir caixa extra e operar caixas de outros operadores" },
      { key: "cash.view_all", label: "Ver todos os caixas", description: "Visualizar caixas de todos os operadores" },
    ],
  },
  {
    id: "closing", label: "Fechamento de Conta", icon: "🧾",
    permissions: [
      { key: "closing.access", label: "Acessar fechamento", description: "Pode fechar contas" },
      { key: "closing.discount", label: "Adicionar descontos", description: "Aplicar descontos nos itens" },
      { key: "closing.change_price", label: "Alterar preço", description: "Modificar valores na conta" },
      { key: "closing.change_payment", label: "Alterar forma de pagamento", description: "Trocar método" },
      { key: "closing.use_credit", label: "Usar crédito do cliente", description: "Aplicar crédito" },
      { key: "closing.generate_debit", label: "Gerar débito parcial", description: "Criar débito para cliente" },
      { key: "closing.refund", label: "Estornar pagamento", description: "Reverter pagamento fechado" },
    ],
  },
  {
    id: "commissions", label: "Comissões / Rateio", icon: "💸",
    permissions: [
      { key: "commissions.view", label: "Acessar comissões", description: "Visualizar comissões" },
      { key: "commissions.view_own", label: "Ver comissões próprias", description: "Apenas suas comissões" },
      { key: "commissions.pay", label: "Pagar comissão", description: "Efetuar pagamento" },
      { key: "commissions.edit", label: "Editar rateio", description: "Ajustar valores antes do pagamento" },
      { key: "commissions.history", label: "Ver histórico", description: "Histórico de pagamentos" },
      { key: "commissions.export", label: "Exportar relatório", description: "Download de comissões" },
      { key: "commissions.details", label: "Ver detalhes", description: "Detalhamento completo" },
    ],
  },
  {
    id: "products", label: "Produtos", icon: "📦",
    permissions: [
      { key: "products.view", label: "Acessar produtos", description: "Visualizar lista" },
      { key: "products.create", label: "Cadastrar produtos", description: "Criar novo produto" },
      { key: "products.edit", label: "Editar produtos", description: "Modificar produto" },
      { key: "products.delete", label: "Excluir produtos", description: "Remover produto" },
      { key: "products.export", label: "Exportar produtos", description: "Download do catálogo de produtos" },
      { key: "products.import", label: "Importar produtos", description: "Importar produtos em massa" },
    ],
  },
  {
    id: "inventory", label: "Estoque", icon: "📋",
    permissions: [
      { key: "inventory.view", label: "Acessar estoque", description: "Visualizar inventário" },
      { key: "inventory.movement.in", label: "Registrar entrada", description: "Entrada de produto" },
      { key: "inventory.movement.out", label: "Registrar saída", description: "Saída de produto" },
      { key: "inventory.adjustment", label: "Corrigir estoque", description: "Ajuste de inventário" },
    ],
  },
  {
    id: "reports", label: "Relatórios", icon: "📊",
    permissions: [
      { key: "reports.view", label: "Acessar relatórios", description: "Visualizar relatórios" },
      { key: "reports.financial", label: "Relatório financeiro", description: "Demonstrativo de resultado" },
      { key: "reports.clients_ranking", label: "Ranking de clientes", description: "Top clientes" },
      { key: "reports.professionals_ranking", label: "Ranking de profissionais", description: "Top profissionais" },
      { key: "reports.services_ranking", label: "Ranking de serviços", description: "Serviços mais realizados" },
      { key: "reports.export", label: "Exportar relatórios", description: "Download de dados gerenciais" },
      { key: "reports.print", label: "Imprimir relatórios", description: "Impressão de resumos" },
    ],
  },
  {
    id: "invoices", label: "Notas Fiscais", icon: "📄",
    permissions: [
      { key: "invoices.view", label: "Acessar notas fiscais", description: "Visualizar notas" },
      { key: "invoices.create", label: "Emitir nota fiscal", description: "Criar nota" },
      { key: "invoices.edit", label: "Editar nota", description: "Modificar nota" },
      { key: "invoices.export", label: "Exportar notas fiscais", description: "Download do histórico de notas" },
    ],
  },
  {
    id: "settings", label: "Configurações", icon: "⚙️",
    permissions: [
      { key: "settings.view", label: "Acessar configurações", description: "Visualizar configurações" },
      { key: "settings.edit", label: "Editar configurações", description: "Modificar configurações do sistema" },
    ],
  },
  {
    id: "security", label: "Segurança de Dados", icon: "🔒",
    permissions: [
      { key: "security.cpf.view", label: "Visualizar CPF", description: "Ver CPF de clientes e profissionais" },
      { key: "security.email.view", label: "Visualizar e-mail", description: "Ver e-mail completo" },
      { key: "security.phone.view", label: "Visualizar telefone", description: "Ver telefone completo" },
      { key: "security.export_sensitive", label: "Exportar dados sensíveis", description: "Incluir dados sensíveis em exportações" },
    ],
  },
  {
    id: "rbac", label: "Perfis e Permissões", icon: "🛡️",
    permissions: [
      { key: "rbac.manage", label: "Gerenciar permissões", description: "Configurar RBAC de profissionais" },
      { key: "rbac.profiles.manage", label: "Gerenciar perfis", description: "Criar/editar perfis de acesso" },
      { key: "rbac.audit.view", label: "Ver histórico de alterações", description: "Logs de auditoria" },
    ],
  },
]

// All permission keys flat
export const ALL_PERMISSION_KEYS: string[] = RBAC_MODULES.flatMap(m => m.permissions.map(p => p.key))

// ===================== PROFILES =====================

const allKeys = ALL_PERMISSION_KEYS

const recepcionistaKeys = [
  "agenda.view", "agenda.create", "agenda.edit", "agenda.cancel", "agenda.reschedule",
  "agenda.drag", "agenda.change_professional", "agenda.change_service",
  "agenda.status.confirm", "agenda.status.waiting", "agenda.status.in_progress",
  "agenda.status.completed", "agenda.status.cancelled", "agenda.status.no_show",
  "agenda.payment.close", "agenda.view_price", "agenda.add_service", "agenda.remove_service",
  "agenda.notes", "agenda.labels", "agenda.whatsapp", "agenda.block_time", "agenda.unblock_time",
  "clients.view", "clients.create", "clients.edit", "clients.history",
  "clients.credit.add", "clients.debit.add", "clients.debit.pay", "clients.ranking",
  "professionals.view",
  "services.view",
  "cash.view", "cash.open", "cash.close", "cash.entry.create", "cash.entry.remove", "cash.history",
  "closing.access", "closing.discount", "closing.change_payment", "closing.use_credit", "closing.generate_debit",
  "products.view",
  "inventory.view",
  "security.phone.view", "security.email.view",
]

const profissionalIKeys = [
  "agenda.view_own", "agenda.status.confirm", "agenda.status.in_progress",
  "agenda.status.completed", "agenda.view_price", "agenda.notes",
  "agenda.absence.create",
  "clients.view",
  "services.view",
  "professionals.view",
  "commissions.view_own", "commissions.history",
]

const profissionalIIKeys = [
  ...profissionalIKeys,
  "agenda.view", "agenda.create", "agenda.edit", "agenda.cancel",
  "agenda.whatsapp", "agenda.labels",
  "clients.create", "clients.edit", "clients.history",
  "agenda.absence.create_other",
  "commissions.details",
  "security.phone.view",
]

const gerenteKeys = allKeys.filter(k =>
  k !== "rbac.manage" && k !== "rbac.profiles.manage" && k !== "rbac.audit.view" &&
  k !== "professionals.permissions.manage" && k !== "professionals.delete" &&
  k !== "cash.manage" && k !== "cash.view_all"
)

const estoquistaKeys = [
  "products.view", "products.create", "products.edit", "products.delete",
  "inventory.view", "inventory.movement.in", "inventory.movement.out", "inventory.adjustment",
  "services.view", "services.stock.configure",
]

const consultaFinanceiraKeys = [
  "finance.view", "finance.by_professional",
  "cash.view", "cash.history",
  "commissions.view", "commissions.history", "commissions.details",
  "reports.view", "reports.financial", "reports.clients_ranking",
  "reports.professionals_ranking", "reports.services_ranking",
]

export const RBAC_PROFILES: Record<string, RBACProfile> = {
  no_access: {
    id: "no_access", name: "Sem Acesso", description: "Não acessa o painel",
    permissions: [], isSystem: true,
  },
  admin: {
    id: "admin", name: "Administrador", description: "Acesso total ao sistema",
    permissions: allKeys, isSystem: true,
  },
  programmer: {
    id: "programmer", name: "Programador Bruno", description: "Acesso total (desenvolvedor)",
    permissions: allKeys, isSystem: true,
  },
  manager: {
    id: "manager", name: "Gerente", description: "Acesso amplo com limitações em RBAC",
    permissions: gerenteKeys, isSystem: true,
  },
  receptionist: {
    id: "receptionist", name: "Recepcionista", description: "Agenda, clientes e atendimento",
    permissions: recepcionistaKeys, isSystem: true,
  },
  stockist: {
    id: "stockist", name: "Estoquista", description: "Produtos e estoque",
    permissions: estoquistaKeys, isSystem: true,
  },
  professional_i: {
    id: "professional_i", name: "Profissional I", description: "Acesso limitado à Web",
    permissions: profissionalIKeys, isSystem: true,
  },
  professional_ii: {
    id: "professional_ii", name: "Profissional II", description: "Acesso Web e App",
    permissions: profissionalIIKeys, isSystem: true,
  },
  financial_viewer: {
    id: "financial_viewer", name: "Consulta Financeira", description: "Visualiza financeiro e relatórios",
    permissions: consultaFinanceiraKeys, isSystem: true,
  },
  custom: {
    id: "custom", name: "Personalizado", description: "Permissões configuradas manualmente",
    permissions: [], isSystem: true,
  },
}

export const PROFILE_LIST = Object.values(RBAC_PROFILES)
export const PROFILE_OPTIONS = PROFILE_LIST.filter(p => p.id !== "custom")
