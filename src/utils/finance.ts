/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Receita,
  ReceitaRecebida,
  DespesaFixa,
  DespesaPaga,
  Parcelamento,
  ParcelaPaga,
  Transacao,
  Categoria,
  User
} from '../types';

// Convert a Date to a YYYY-MM code based on closingDay
export function getFinancialMonth(date: Date | string, closingDay: number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  }
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed
  const day = d.getDate();

  if (day >= closingDay) {
    const mStr = String(month + 1).padStart(2, '0');
    return `${year}-${mStr}`;
  } else {
    const prevDate = new Date(year, month - 1, 1);
    const pYear = prevDate.getFullYear();
    const pMonthStr = String(prevDate.getMonth() + 1).padStart(2, '0');
    return `${pYear}-${pMonthStr}`;
  }
}

// Generate the start and end dates of a financial month
export function getFinancialMonthRange(financialMonthStr: string, closingDay: number): { start: Date; end: Date } {
  const [yearStr, monthStr] = financialMonthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed

  const start = new Date(year, month, closingDay, 0, 0, 0, 0);
  
  let end: Date;
  if (closingDay === 1) {
    end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  } else {
    end = new Date(year, month + 1, closingDay - 1, 23, 59, 59, 999);
  }
  
  return { start, end };
}

// Format Date as DD/MM/YYYY
export function formatDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Format Currency with BRL symbol
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

// Check if a date string falls inside the range of a financial month
export function isDateInFinancialMonth(dateStr: string | Date, financialMonthStr: string, closingDay: number): boolean {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  
  const m = getFinancialMonth(date, closingDay);
  return m === financialMonthStr;
}

// Get the actual payment/cobrança date of a day of month in a given financial month
export function getPaymentDateForMonth(dayOfMonth: number, financialMonthStr: string, closingDay: number): Date {
  const { start } = getFinancialMonthRange(financialMonthStr, closingDay);
  let targetMonth = start.getMonth();
  let targetYear = start.getFullYear();

  if (dayOfMonth < closingDay) {
    // If the day of cobrança is less than the closing day, it falls in the second half of the financial month (which is the next calendar month)
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
  }

  // Handle month duration variations (e.g. 31st of February)
  const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
  const finalDay = Math.min(dayOfMonth, maxDays);

  return new Date(targetYear, targetMonth, finalDay);
}

// Generate financial month suggestions (e.g., current, previous, next 3)
export function getFinancialMonthOptions(closingDay: number): string[] {
  const options: string[] = [];
  const today = new Date();
  
  // Start from 6 months ago to 6 months in future
  const baseMonth = today.getMonth();
  const baseYear = today.getFullYear();
  
  for (let i = -6; i <= 6; i++) {
    const temp = new Date(baseYear, baseMonth + i, 1);
    const mStr = getFinancialMonth(new Date(temp.getFullYear(), temp.getMonth(), closingDay), closingDay);
    if (!options.includes(mStr)) {
      options.push(mStr);
    }
  }
  
  return options.sort();
}

export interface FinancialStats {
  saldoDisponivelHoje: number;
  saldoPrevistoFimMes: number;
  
  totalReceitasPrevistas: number;
  totalReceitasRecebidas: number;
  
  totalDespesasFixasPrevistas: number;
  totalDespesasFixasPagas: number;
  
  totalParcelasPrevistas: number;
  totalParcelasPagasForMonth: number;
  
  totalTransacoes: number;
  usoCartaoCredito: number;
  
  receitasList: { item: Receita; recebido: boolean; recordId?: string }[];
  despesasFixasList: { item: DespesaFixa; pago: boolean; recordId?: string }[];
  parcelasPredictsList: {
    item: Parcelamento;
    paga: boolean;
    recordId?: string;
    numParcelaStr: string; // e.g. "3/12" or "Assinatura"
    valor: number;
    paymentDate: string;
  }[];
  transacoesList: Transacao[];
}

export function calculateFinancialStats(
  user: User,
  financialMonth: string,
  receitas: Receita[],
  receitasRecebidas: ReceitaRecebida[],
  despesasFixas: DespesaFixa[],
  despesasPagas: DespesaPaga[],
  parcelamentos: Parcelamento[],
  parcelasPagas: ParcelaPaga[],
  transacoes: Transacao[]
): FinancialStats {
  const closingDay = user.closing_day;
  const { start, end } = getFinancialMonthRange(financialMonth, closingDay);

  // 1. RECEITAS
  // Predicted: all active recipes, or those that fall within this month creator-wise or are recurrent
  const activeReceitas = receitas.filter(r => {
    if (!r.ativa) return false;
    const itemDate = new Date(r.created_at);
    const itemMonth = getFinancialMonth(itemDate, closingDay);
    // Chronological safety: item must have been created in or before this financial month
    return r.recorrente || itemMonth <= financialMonth;
  });

  const receitasList = activeReceitas.map(r => {
    const clearance = receitasRecebidas.find(rr => rr.receita_id === r.id && rr.mes_financeiro === financialMonth);
    return {
      item: r,
      recebido: !!clearance,
      recordId: clearance?.id
    };
  });

  const totalReceitasPrevistas = activeReceitas.reduce((sum, r) => sum + r.valor, 0);
  const totalReceitasRecebidas = receitasList.reduce((sum, r) => sum + (r.recebido ? r.item.valor : 0), 0);

  // 2. DESPESAS FIXAS
  // Predicted: all active despesas, chronologically valid
  const activeDespesas = despesasFixas.filter(d => {
    if (!d.ativa) return false;
    const itemDate = new Date(d.created_at);
    const itemMonth = getFinancialMonth(itemDate, closingDay);
    return itemMonth <= financialMonth;
  });

  const despesasFixasList = activeDespesas.map(d => {
    const clearance = despesasPagas.find(dp => dp.despesa_id === d.id && dp.mes_financeiro === financialMonth);
    return {
      item: d,
      pago: !!clearance,
      recordId: clearance?.id
    };
  });

  const totalDespesasFixasPrevistas = activeDespesas.reduce((sum, d) => sum + d.valor, 0);
  const totalDespesasFixasPagas = despesasFixasList.reduce((sum, d) => sum + (d.pago ? d.item.valor : 0), 0);

  // 3. PARCELAMENTOS (INSTALLMENTS & SUBSCRIPTIONS)
  // Predicted to exist in month finance X
  const parcelasPredictsList: FinancialStats['parcelasPredictsList'] = [];
  let totalParcelasPrevistas = 0;
  let totalParcelasPagasForMonth = 0;

  parcelamentos.forEach(p => {
    if (!p.ativa) return;
    
    // Parse start date of cobrança
    const firstCobrancaDate = new Date(p.data_primeira_cobranca);
    if (isNaN(firstCobrancaDate.getTime())) return;

    const monthFirst = getFinancialMonth(firstCobrancaDate, closingDay);
    
    // Calculate months passed between monthFirst and selected financialMonth
    const [yearX, monthX] = financialMonth.split('-').map(Number);
    const [yearF, monthF] = monthFirst.split('-').map(Number);
    const monthsPassed = (yearX - yearF) * 12 + (monthX - monthF);

    if (monthsPassed < 0) return; // Has not started yet

    let shouldCharge = false;
    let numParcelaStr = '';

    if (p.tipo === 'assinatura') {
      shouldCharge = true;
      numParcelaStr = 'Assinatura';
    } else if (p.tipo === 'parcelado' && p.total_parcelas !== null) {
      if (monthsPassed < p.total_parcelas) {
        shouldCharge = true;
        numParcelaStr = `${monthsPassed + 1}/${p.total_parcelas}`;
      }
    }

    if (shouldCharge) {
      const isPaid = parcelasPagas.some(pp => pp.parcelamento_id === p.id && pp.mes_financeiro === financialMonth);
      const payDate = getPaymentDateForMonth(p.dia_cobranca, financialMonth, closingDay);

      parcelasPredictsList.push({
        item: p,
        paga: isPaid,
        recordId: parcelasPagas.find(pp => pp.parcelamento_id === p.id && pp.mes_financeiro === financialMonth)?.id,
        numParcelaStr,
        valor: p.valor_parcela,
        paymentDate: payDate.toISOString()
      });

      totalParcelasPrevistas += p.valor_parcela;
      if (isPaid) {
        totalParcelasPagasForMonth += p.valor_parcela;
      }
    }
  });

  // 4. TRANSACOES (Gasto do dia-a-dia)
  // Trancactions created within this financial month
  const transacoesList = transacoes.filter(t => isDateInFinancialMonth(t.data, financialMonth, closingDay));
  const totalTransacoes = transacoesList.reduce((sum, t) => sum + t.valor, 0);

  // 5. CREDIT CARD USE (Forma de pagamento = 'credito' in financial month)
  // Everything inside current financial month with credit payment
  const creditTransacoes = transacoesList.filter(t => t.forma_pagamento === 'credito').reduce((sum, t) => sum + t.valor, 0);
  
  // Fixed expenses paid on credit
  const creditDespesas = despesasFixasList.filter(d => d.item.forma_pagamento === 'credito').reduce((sum, d) => sum + d.item.valor, 0);
  
  // Installments paid on credit (by default, installments are credit)
  const creditParcelas = parcelasPredictsList.filter(p => p.item.forma_pagamento === 'credito').reduce((sum, p) => sum + p.valor, 0);

  const usoCartaoCredito = creditTransacoes + creditDespesas + creditParcelas;

  // 5.1 SALDO DISPONÍVEL HOJE
  // Saldo Disponível Hoje = + receitas(recebidas) - despesas(pagas) - parcelas(pagas) - transações
  const saldoDisponivelHoje = totalReceitasRecebidas - totalDespesasFixasPagas - totalParcelasPagasForMonth - totalTransacoes;

  // 5.2 SALDO PREVISTO FIM DO MÊS
  // Saldo Previsto = + totalReceitasPrevistas - totalDespesasFixasPrevistas - totalParcelasPrevistas - totalTransacoes
  const saldoPrevistoFimMes = totalReceitasPrevistas - totalDespesasFixasPrevistas - totalParcelasPrevistas - totalTransacoes;

  return {
    saldoDisponivelHoje,
    saldoPrevistoFimMes,
    
    totalReceitasPrevistas,
    totalReceitasRecebidas,
    
    totalDespesasFixasPrevistas,
    totalDespesasFixasPagas,
    
    totalParcelasPrevistas,
    totalParcelasPagasForMonth,
    
    totalTransacoes,
    usoCartaoCredito,
    
    receitasList,
    despesasFixasList,
    parcelasPredictsList,
    transacoesList
  };
}

// Evaluation text based on rules (Section 4.3 Col Esquerda/Direita)
export function getAutomaticEvaluation(saldoPrevisto: number, cardLimit: number): { title: string; desc: string; type: 'success' | 'warn' | 'critical' | 'info' } {
  if (saldoPrevisto > 0) {
    return {
      title: "Mês positivo",
      desc: "Excelente controle! Suas receitas previstas cobrem todos os gastos previstos para o mês, finalizando com saldo azul.",
      type: 'success'
    };
  } else {
    const gap = Math.abs(saldoPrevisto);
    if (gap <= cardLimit * 0.10) {
      return {
        title: "Atenção, levemente no vermelho",
        desc: `Você passará a usar cerca de ${formatCurrency(gap)} do crédito do seu cartão para cobrir o fluxo de caixa deste mês.`,
        type: 'warn'
      };
    } else {
      return {
        title: "Crítico, fechando usando crédito",
        desc: `Alerta: o mês fechará no vermelho em ${formatCurrency(gap)}, consumindo mais de 10% do limite do seu cartão de crédito. É recomendado cortar gastos urgentes.`,
        type: 'critical'
      };
    }
  }
}

// Automatic recommendations based on rules (Section 4.3)
export function getAutomaticRecommendations(
  stats: FinancialStats,
  categories: Categoria[],
  prevMonthStats?: FinancialStats
): string[] {
  const recommendations: string[] = [];

  // Check if subscriptions spend > 15% of revenues
  const totalRevenues = stats.totalReceitasPrevistas || 1;
  const subscriptionsId = categories.find(c => c.nome.toLowerCase() === 'assinaturas')?.id;
  
  // Calculate total subscription costs this month
  let subsSum = stats.parcelasPredictsList
    .filter(p => p.item.tipo === 'assinatura')
    .reduce((sum, p) => sum + p.valor, 0);
  
  // also sum up fixed expenses categorized as subscriptions
  if (subscriptionsId) {
    subsSum += stats.despesasFixasList
      .filter(d => d.item.categoria_id === subscriptionsId)
      .reduce((sum, d) => sum + d.item.valor, 0);
  }

  const subsRatio = subsSum / totalRevenues;
  if (subsRatio > 0.15) {
    recommendations.push(
      `Suas assinaturas consomem ${(subsRatio * 100).toFixed(1)}% da sua receita prevista (${formatCurrency(subsSum)}). Considere revisar serviços que não utiliza frequentemente.`
    );
  }

  // Check if single daily transaction spends > 20% of revenues
  stats.transacoesList.forEach(t => {
    if (t.valor > totalRevenues * 0.20) {
      const cat = categories.find(c => c.id === t.categoria_id);
      recommendations.push(
        `A transação "${t.nome}" (${formatCurrency(t.valor)}) consumiu ${(t.valor / totalRevenues * 100).toFixed(0)}% de toda a sua receita prevista do mês.`
      );
    }
  });

  // Category with highest spending comparison from previous month
  const categorySpendCurrent: { [catId: string]: number } = {};
  stats.transacoesList.forEach(t => {
    categorySpendCurrent[t.categoria_id] = (categorySpendCurrent[t.categoria_id] || 0) + t.valor;
  });
  stats.despesasFixasList.forEach(d => {
    categorySpendCurrent[d.item.categoria_id] = (categorySpendCurrent[d.item.categoria_id] || 0) + d.item.valor;
  });
  stats.parcelasPredictsList.forEach(p => {
    categorySpendCurrent[p.item.categoria_id] = (categorySpendCurrent[p.item.categoria_id] || 0) + p.valor;
  });

  if (prevMonthStats) {
    const categorySpendPrev: { [catId: string]: number } = {};
    prevMonthStats.transacoesList.forEach(t => {
      categorySpendPrev[t.categoria_id] = (categorySpendPrev[t.categoria_id] || 0) + t.valor;
    });
    prevMonthStats.despesasFixasList.forEach(d => {
      categorySpendPrev[d.item.categoria_id] = (categorySpendPrev[d.item.categoria_id] || 0) + d.item.valor;
    });
    prevMonthStats.parcelasPredictsList.forEach(p => {
      categorySpendPrev[p.item.categoria_id] = (categorySpendPrev[p.item.categoria_id] || 0) + p.valor;
    });

    // Find custom differences
    let highestDiff = 0;
    let highestDiffCatId = '';
    
    Object.keys(categorySpendCurrent).forEach(catId => {
      const cur = categorySpendCurrent[catId];
      const prev = categorySpendPrev[catId] || 0;
      if (cur > prev && (cur - prev) > highestDiff) {
        highestDiff = cur - prev;
        highestDiffCatId = catId;
      }
    });

    if (highestDiffCategoryValid(highestDiff, totalRevenues, highestDiffCatId)) {
      const cat = categories.find(c => c.id === highestDiffCatId);
      if (cat) {
        const pct = ((highestDiff / (categorySpendPrev[highestDiffCatId] || 1)) * 100).toFixed(0);
        recommendations.push(
          `Você gastou R$ ${highestDiff.toFixed(2)} a mais em "${cat.nome}" do que no mês passado (um aumento de ${pct}%).`
        );
      }
    }
  }

  if (recommendations.length === 0) {
    recommendations.push("Seu comportamento de gastos está saudável e sob controle neste mês.");
  }

  return recommendations;
}

function highestDiffCategoryValid(highestDiff: number, totalRevenues: number, highestDiffCatId: string): boolean {
  return highestDiff > totalRevenues * 0.02 && highestDiffCatId !== '';
}
