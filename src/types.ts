/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  email: string;
  nome: string;
  closing_day: number; // 1-28
  card_limit: number;
  created_at: string;
  onboarding_completed?: boolean;
}

export type PaymentMethod = 'debito' | 'credito' | 'boleto' | 'pix' | 'dinheiro';

export interface Categoria {
  id: string;
  user_id: string | null; // null = predefinida global
  nome: string;
  tipo: 'receita' | 'despesa';
  cor: string; // hex color code
  icone?: string; // Lucide icon name
}

export interface Receita {
  id: string;
  user_id: string;
  nome: string;
  valor: number;
  categoria_id: string;
  recorrente: boolean;
  dia_recebimento?: number; // dia do mês que entra
  ativa: boolean;
  created_at: string;
}

// Track if a receita was received in a given financial month
export interface ReceitaRecebida {
  id: string;
  receita_id: string;
  mes_financeiro: string; // YYYY-MM
  data_pagamento: string;
}

export interface DespesaFixa {
  id: string;
  user_id: string;
  nome: string;
  valor: number;
  categoria_id: string;
  dia_vencimento: number;
  forma_pagamento: PaymentMethod;
  ativa: boolean;
  observacao?: string;
  created_at: string;
}

// Track if a despesa fixa was paid in a given financial month
export interface DespesaPaga {
  id: string;
  despesa_id: string;
  mes_financeiro: string; // YYYY-MM
  data_pagamento: string;
}

export interface Parcelamento {
  id: string;
  user_id: string;
  nome: string;
  valor_parcela: number;
  categoria_id: string;
  forma_pagamento: PaymentMethod;
  tipo: 'parcelado' | 'assinatura';
  data_primeira_cobranca: string; // YYYY-MM-DD
  total_parcelas: number | null; // null = assinatura
  dia_cobranca: number;
  ativa: boolean;
  observacao?: string;
  created_at: string;
}

export interface ParcelaPaga {
  id: string;
  parcelamento_id: string;
  mes_financeiro: string; // YYYY-MM format
  data_pagamento: string;
}

export interface Transacao {
  id: string;
  user_id: string;
  nome: string;
  valor: number;
  categoria_id: string;
  forma_pagamento: PaymentMethod;
  data: string; // YYYY-MM-DD
  observacao?: string;
  created_at: string;
}

export interface Nota {
  id: string;
  user_id: string;
  titulo: string;
  conteudo: string; // Markdown level lightweight text
  created_at: string;
  updated_at: string;
}

export interface ProjecaoAjuste {
  tipo_acao: 'adicionar' | 'remover' | 'modificar';
  tabela: 'receitas' | 'despesas_fixas' | 'parcelamentos' | 'transacoes';
  item_id: string; // For remover/modificar
  dados_novos?: any; // New entity data
}

export interface Projecao {
  id: string;
  user_id: string;
  nome: string;
  mes_referencia: string; // YYYY-MM
  ajustes: ProjecaoAjuste[]; // List of overrides
  created_at: string;
}
