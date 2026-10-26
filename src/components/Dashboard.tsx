/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { User, Receita, DespesaFixa, Parcelamento, Transacao, Nota, Categoria, PaymentMethod } from '../types';
import { DatabaseService, generateId } from '../utils/db';
import {
  formatCurrency,
  formatDate,
  getFinancialMonth,
  getFinancialMonthRange,
  getFinancialMonthOptions,
  calculateFinancialStats,
  getAutomaticEvaluation,
  getAutomaticRecommendations,
  getPaymentDateForMonth,
  FinancialStats
} from '../utils/finance';
import LucideIcon from './LucideIcon';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip
} from 'recharts';

interface DashboardProps {
  user: User;
  onUpdateUser: (updated: User) => void;
}

interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'info' | 'warn';
}

export default function Dashboard({ user, onUpdateUser }: DashboardProps) {
  // Financial Selection
  const monthOptions = getFinancialMonthOptions(user.closing_day);
  const currentActualMonth = getFinancialMonth(new Date(), user.closing_day);
  const [selectedMonth, setSelectedMonth] = useState(
    monthOptions.includes(currentActualMonth) ? currentActualMonth : monthOptions[6] || currentActualMonth
  );

  // Database States
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [receitasPagas, setReceitasPagas] = useState<any[]>([]);
  const [despesas, setDespesas] = useState<DespesaFixa[]>([]);
  const [despesasPagas, setDespesasPagas] = useState<any[]>([]);
  const [parcelamentos, setParcelamentos] = useState<Parcelamento[]>([]);
  const [parcelasPagas, setParcelasPagas] = useState<any[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modals / Double click editors
  const [activeModal, setActiveModal] = useState<'receita' | 'despesa' | 'parcelamento' | 'edit-item' | null>(null);
  const [editTarget, setEditTarget] = useState<{ type: 'rec' | 'df' | 'parc' | 'tr'; data: any } | null>(null);
  
  // Uncheck confirmation modal
  const [uncheckConfirm, setUncheckConfirm] = useState<{ id: string; type: 'rec' | 'df' | 'parc'; name: string } | null>(null);

  // Daily transaction quick inputs
  const [trNome, setTrNome] = useState('');
  const [trValor, setTrValor] = useState('');
  const [trCat, setTrCat] = useState('');
  const [trFP, setTrFP] = useState<PaymentMethod>('credito');
  const [trData, setTrData] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const trInputRef = useRef<HTMLInputElement>(null);

  // Note editor states
  const [activeNoteEditId, setActiveNoteEditId] = useState<string | null>(null);
  const [noteEditTitle, setNoteEditTitle] = useState('');
  const [noteEditContent, setNoteEditContent] = useState('');

  // General Addition States
  const [addRecNome, setAddRecNome] = useState('');
  const [addRecValor, setAddRecValor] = useState('');
  const [addRecCat, setAddRecCat] = useState('');
  const [addRecRecorrente, setAddRecRecorrente] = useState(true);
  const [addRecDia, setAddRecDia] = useState('5');

  const [addDespNome, setAddDespNome] = useState('');
  const [addDespValor, setAddDespValor] = useState('');
  const [addDespCat, setAddDespCat] = useState('');
  const [addDespDia, setAddDespDia] = useState('10');
  const [addDespFP, setAddDespFP] = useState<PaymentMethod>('pix');
  const [addDespObs, setAddDespObs] = useState('');

  const [addParcNome, setAddParcNome] = useState('');
  const [addParcVal, setAddParcVal] = useState('');
  const [addParcCat, setAddParcCat] = useState('');
  const [addParcFP, setAddParcFP] = useState<PaymentMethod>('credito');
  const [addParcTipo, setAddParcTipo] = useState<'parcelado' | 'assinatura'>('parcelado');
  const [addParcStart, setAddParcStart] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [addParcTotal, setAddParcTotal] = useState('12');
  const [addParcDia, setAddParcDia] = useState('5');
  const [addParcObs, setAddParcObs] = useState('');

  // Keyboard shortcut hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in fields
      const tag = document.activeElement?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        trInputRef.current?.focus();
        showToast('Atalho: Novo gasto rápido focado!', 'info');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch core data from local database
  const refreshData = () => {
    const cats = DatabaseService.getCategories(user.id);
    const recs = DatabaseService.getReceitas(user.id);
    const dfs = DatabaseService.getDespesasFixas(user.id);
    const parcs = DatabaseService.getParcelamentos(user.id);
    const trs = DatabaseService.getTransacoes(user.id);
    const nts = DatabaseService.getNotas(user.id);

    setCategories(cats);
    setReceitas(recs);
    setDespesas(dfs);
    setParcelamentos(parcs);
    setTransacoes(trs);
    setNotas(nts);

    // Filter defaults for daily transactions
    const defaultExpenseCat = cats.find(c => c.tipo === 'despesa')?.id || '';
    if (!trCat) setTrCat(defaultExpenseCat);
    if (!addRecCat) setAddRecCat(cats.find(c => c.tipo === 'receita')?.id || '');
    if (!addDespCat) setAddDespCat(cats.find(c => c.tipo === 'despesa')?.id || '');
    if (!addParcCat) setAddParcCat(cats.find(c => c.tipo === 'despesa')?.id || '');

    // Monthly status clearance registers lists
    const activeRecIds = recs.map(r => r.id);
    const activeDespIds = dfs.map(d => d.id);
    const activeParcIds = parcs.map(p => p.id);

    const recClearance = DatabaseService.getReceitasRecebidas(selectedMonth, activeRecIds);
    const despClearance = DatabaseService.getDespesasPagas(selectedMonth, activeDespIds);
    const parcClearance = DatabaseService.getParcelasPagas(selectedMonth, activeParcIds);

    setReceitasPagas(recClearance);
    setDespesasPagas(despClearance);
    setParcelasPagas(parcClearance);
  };

  useEffect(() => {
    refreshData();
  }, [user.id, selectedMonth]);

  // Toast notifier helper
  const showToast = (text: string, type: ToastMessage['type'] = 'success') => {
    const newToast: ToastMessage = { id: generateId(), text, type };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newToast.id));
    }, 3500);
  };

  // 1. Calculations & statistics engine
  const stats: FinancialStats = calculateFinancialStats(
    user,
    selectedMonth,
    receitas,
    receitasPagas,
    despesas,
    despesasPagas,
    parcelamentos,
    parcelasPagas,
    transacoes
  );

  // Derive previous month statistics for automated recommendations difference checking
  const optionIdx = monthOptions.indexOf(selectedMonth);
  const prevMonthStr = optionIdx > 0 ? monthOptions[optionIdx - 1] : undefined;
  let prevStats: FinancialStats | undefined;

  if (prevMonthStr) {
    // Lazy mock load of previous month clearances state
    const prevRecPaid = DatabaseService.getReceitasRecebidas(prevMonthStr, receitas.map(r => r.id));
    const prevDespPaid = DatabaseService.getDespesasPagas(prevMonthStr, despesas.map(d => d.id));
    const prevParcPaid = DatabaseService.getParcelasPagas(prevMonthStr, parcelamentos.map(p => p.id));
    
    prevStats = calculateFinancialStats(
      user,
      prevMonthStr,
      receitas,
      prevRecPaid,
      despesas,
      prevDespPaid,
      parcelamentos,
      prevParcPaid,
      transacoes
    );
  }

  // Monthly Period Ranges Title string
  const { start, end } = getFinancialMonthRange(selectedMonth, user.closing_day);
  const formatRangeShort = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${day}/${months[d.getMonth()]}`;
  };
  const headerPeriodStr = `Mês financeiro: ${formatRangeShort(start)} a ${formatRangeShort(end)}`;

  // Quick Daily Expenditure registration
  const handleAddTransacao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trNome || !trValor || !trCat) {
      showToast('Por favor, preencha todos os campos do gasto rápido.', 'warn');
      return;
    }
    const val = parseFloat(trValor);
    if (isNaN(val) || val <= 0) {
      showToast('Insira um valor numérico válido.', 'warn');
      return;
    }

    const categoryObj = categories.find(c => c.id === trCat);
    const newTr = DatabaseService.createTransacao(user.id, {
      nome: trNome.trim(),
      valor: val,
      categoria_id: trCat,
      forma_pagamento: trFP,
      data: trData
    });

    setTrNome('');
    setTrValor('');
    refreshData();
    showToast(`+ ${formatCurrency(val)} em Lançamento: "${newTr.nome}" [${categoryObj?.nome || 'Gasto'}]`, 'success');
    
    // Focus back on the transaction input for continuous speed registration!
    trInputRef.current?.focus();
  };

  // Toggle checklist clearances
  const handleToggleReceita = (id: string, name: string, isCurrentlyPaid: boolean) => {
    if (isCurrentlyPaid) {
      // Prompt confirm on uncheck
      setUncheckConfirm({ id, type: 'rec', name });
    } else {
      DatabaseService.toggleReceitaRecebida(id, selectedMonth);
      refreshData();
      showToast(`Recebimento registrado: ${name}`, 'success');
    }
  };

  const handleToggleDespesa = (id: string, name: string, isCurrentlyPaid: boolean) => {
    if (isCurrentlyPaid) {
      // Prompt confirm on uncheck
      setUncheckConfirm({ id, type: 'df', name });
    } else {
      DatabaseService.toggleDespesaPaga(id, selectedMonth);
      refreshData();
      showToast(`Despesa registrada como Paga: ${name}`, 'success');
    }
  };

  const handleToggleParcela = (id: string, name: string, isCurrentlyPaid: boolean) => {
    if (isCurrentlyPaid) {
      setUncheckConfirm({ id, type: 'parc', name });
    } else {
      DatabaseService.toggleParcelaPaga(id, selectedMonth);
      refreshData();
      showToast(`Parcela registrada como Paga: ${name}`, 'success');
    }
  };

  const handleConfirmUncheck = () => {
    if (!uncheckConfirm) return;
    const { id, type } = uncheckConfirm;

    if (type === 'rec') {
      DatabaseService.toggleReceitaRecebida(id, selectedMonth);
    } else if (type === 'df') {
      DatabaseService.toggleDespesaPaga(id, selectedMonth);
    } else if (type === 'parc') {
      DatabaseService.toggleParcelaPaga(id, selectedMonth);
    }

    refreshData();
    showToast('Item desmarcado. Saldo recalculado.', 'info');
    setUncheckConfirm(null);
  };

  // Additions inside Modals
  const handleModalAddReceita = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(addRecValor);
    if (!addRecNome || isNaN(val) || val <= 0 || !addRecCat) {
      showToast('Formulário inválido.', 'warn');
      return;
    }

    DatabaseService.createReceita(user.id, {
      nome: addRecNome.trim(),
      valor: val,
      categoria_id: addRecCat,
      recorrente: addRecRecorrente,
      dia_recebimento: parseInt(addRecDia, 10) || 5,
      ativa: true
    });

    setAddRecNome('');
    setAddRecValor('');
    setActiveModal(null);
    refreshData();
    showToast('Receita adicionada!', 'success');
  };

  const handleModalAddDespesa = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(addDespValor);
    if (!addDespNome || isNaN(val) || val <= 0 || !addDespCat) {
      showToast('Formulário de despesa inválido.', 'warn');
      return;
    }

    DatabaseService.createDespesaFixa(user.id, {
      nome: addDespNome.trim(),
      valor: val,
      categoria_id: addDespCat,
      dia_vencimento: parseInt(addDespDia, 10) || 10,
      forma_pagamento: addDespFP,
      ativa: true,
      observacao: addDespObs.trim() || undefined
    });

    setAddDespNome('');
    setAddDespValor('');
    setAddDespObs('');
    setActiveModal(null);
    refreshData();
    showToast('Despesa fixa cadastrada!', 'success');
  };

  const handleModalAddParcelamento = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(addParcVal);
    if (!addParcNome || isNaN(val) || val <= 0 || !addParcCat) {
      showToast('Formulário de parcelamento inválido.', 'warn');
      return;
    }

    DatabaseService.createParcelamento(user.id, {
      nome: addParcNome.trim(),
      valor_parcela: val,
      categoria_id: addParcCat,
      forma_pagamento: addParcFP,
      tipo: addParcTipo,
      data_primeira_cobranca: addParcStart,
      total_parcelas: addParcTipo === 'parcelado' ? (parseInt(addParcTotal, 10) || 12) : null,
      dia_cobranca: parseInt(addParcDia, 10) || 5,
      ativa: true,
      observacao: addParcObs.trim() || undefined
    });

    setAddParcNome('');
    setAddParcVal('');
    setAddParcObs('');
    setActiveModal(null);
    refreshData();
    showToast('Novo plano de parcelamento ou assinatura adicionado!', 'success');
  };

  // Editing logic (double click)
  const handleStartEdit = (type: 'rec' | 'df' | 'parc' | 'tr', data: any) => {
    setEditTarget({ type, data });
    setActiveModal('edit-item');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    const { type, data } = editTarget;
    try {
      if (type === 'rec') {
        DatabaseService.updateReceita(data.id, {
          nome: data.nome,
          valor: parseFloat(data.valor) || 0,
          categoria_id: data.categoria_id,
          recorrente: data.recorrente,
          dia_recebimento: parseInt(data.dia_recebimento, 10) || 5
        });
      } else if (type === 'df') {
        DatabaseService.updateDespesaFixa(data.id, {
          nome: data.nome,
          valor: parseFloat(data.valor) || 0,
          categoria_id: data.categoria_id,
          dia_vencimento: parseInt(data.dia_vencimento, 10) || 10,
          forma_pagamento: data.forma_pagamento,
          observacao: data.observacao
        });
      } else if (type === 'parc') {
        DatabaseService.updateParcelamento(data.id, {
          nome: data.nome,
          valor_parcela: parseFloat(data.valor_parcela) || 0,
          categoria_id: data.categoria_id,
          forma_pagamento: data.forma_pagamento,
          dia_cobranca: parseInt(data.dia_cobranca, 10) || 5,
          observacao: data.observacao
        });
      } else if (type === 'tr') {
        DatabaseService.updateTransacao(data.id, {
          nome: data.nome,
          valor: parseFloat(data.valor) || 0,
          categoria_id: data.categoria_id,
          forma_pagamento: data.forma_pagamento,
          data: data.data,
          observacao: data.observacao
        });
      }

      refreshData();
      showToast('Registro editado com sucesso!', 'success');
      setActiveModal(null);
      setEditTarget(null);
    } catch {
      showToast('Ocorreu um erro ao atualizar o registro.', 'warn');
    }
  };

  const handleDeleteItem = (type: 'rec' | 'df' | 'parc' | 'tr', id: string) => {
    if (!window.confirm('Tem certeza de que deseja excluir permanentemente este registro?')) return;
    
    if (type === 'rec') DatabaseService.deleteReceita(id);
    else if (type === 'df') DatabaseService.deleteDespesaFixa(id);
    else if (type === 'parc') DatabaseService.deleteParcelamento(id);
    else if (type === 'tr') DatabaseService.deleteTransacao(id);

    refreshData();
    showToast('Lançamento deletado.', 'info');
    setActiveModal(null);
    setEditTarget(null);
  };

  // Notes freeform management
  const handleAddNota = () => {
    const fresh = DatabaseService.createNota(user.id, 'Nova Anotação de Gastos 📝', '## Título\nEscreva os lembretes do mês aqui... ');
    refreshData();
    setActiveNoteEditId(fresh.id);
    setNoteEditTitle(fresh.titulo);
    setNoteEditContent(fresh.conteudo);
    showToast('Anotação criada!', 'success');
  };

  const handleSaveNota = (id: string) => {
    DatabaseService.updateNota(id, {
      titulo: noteEditTitle,
      conteudo: noteEditContent
    });
    setActiveNoteEditId(null);
    refreshData();
    showToast('Anotação salva!', 'success');
  };

  const handleDeleteNota = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Excluir esta nota?')) return;
    DatabaseService.deleteNota(id);
    setActiveNoteEditId(null);
    refreshData();
    showToast('Anotação removida.', 'info');
  };

  // Charts data derivation logic
  // A. Category Distribution Pie Chart
  const categorySummary: { [catId: string]: { value: number; name: string; color: string; type: 'despesa' | 'receita' } } = {};
  
  // Aggregate daily expenditures
  stats.transacoesList.forEach(t => {
    const c = categories.find(cat => cat.id === t.categoria_id);
    if (c) {
      if (!categorySummary[c.id]) {
        categorySummary[c.id] = { value: 0, name: c.nome, color: c.cor, type: 'despesa' };
      }
      categorySummary[c.id].value += t.valor;
    }
  });

  // Aggregate fixed expenses paid
  stats.despesasFixasList.forEach(d => {
    const c = categories.find(cat => cat.id === d.item.categoria_id);
    if (c) {
      if (!categorySummary[c.id]) {
        categorySummary[c.id] = { value: 0, name: c.nome, color: c.cor, type: 'despesa' };
      }
      categorySummary[c.id].value += d.item.valor;
    }
  });

  // Aggregate installments predicted
  stats.parcelasPredictsList.forEach(p => {
    const c = categories.find(cat => cat.id === p.item.categoria_id);
    if (c) {
      if (!categorySummary[c.id]) {
        categorySummary[c.id] = { value: 0, name: c.nome, color: c.cor, type: 'despesa' };
      }
      categorySummary[c.id].value += p.valor;
    }
  });

  const pieChartData = Object.keys(categorySummary)
    .map(key => categorySummary[key])
    .filter(item => item.value > 0);

  // B. Top 5 Categories spending list with bars
  const topSpentCategories = [...pieChartData]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const highestTopValue = topSpentCategories[0]?.value || 1;

  // C. Daily balances line chart calculation (Section 5.1/5.2 math model)
  const lineChartData: { diaLabel: string; saldo: number; val: Date }[] = [];
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  // Build balances arrays day by day
  let accumulatedRevenues = 0;
  let accumulatedExpenses = 0;

  for (let idx = 0; idx <= daysDiff + 1; idx++) {
    const dayTick = new Date(start.getTime() + idx * 24 * 60 * 60 * 1000);
    if (dayTick > end) break;

    // Filter clear income items on or before this tick
    const dayTickLimit = dayTick.getTime();
    accumulatedRevenues = stats.receitasList
      .filter(r => r.recebido)
      .reduce((sum, r) => sum + r.item.valor, 0); // revenues treated as starting boost
    
    // Sum fixed bills paid on or before this tick
    const paidFixedBefore = stats.despesasFixasList
      .filter(d => d.pago)
      .filter(d => {
        const payDate = getPaymentDateForMonth(d.item.dia_vencimento, selectedMonth, user.closing_day);
        return payDate.getTime() <= dayTickLimit;
      })
      .reduce((sum, d) => sum + d.item.valor, 0);

    // Sum installments paid on or before this tick
    const paidInstallmentsBefore = stats.parcelasPredictsList
      .filter(p => p.paga)
      .filter(p => {
        const payDate = new Date(p.paymentDate);
        return payDate.getTime() <= dayTickLimit;
      })
      .reduce((sum, p) => sum + p.valor, 0);

    // Sum transactions happening on or before this tick
    const transactionsBefore = stats.transacoesList
      .filter(t => new Date(t.data).getTime() <= dayTickLimit)
      .reduce((sum, t) => sum + t.valor, 0);

    const dayBalance = accumulatedRevenues - paidFixedBefore - paidInstallmentsBefore - transactionsBefore;

    lineChartData.push({
      diaLabel: String(dayTick.getDate()).padStart(2, '0'),
      saldo: parseFloat(dayBalance.toFixed(2)),
      val: dayTick
    });
  }

  // Rules auto assessment
  const automEval = getAutomaticEvaluation(stats.saldoPrevistoFimMes, user.card_limit);
  const automRecommends = getAutomaticRecommendations(stats, categories, prevStats);

  // Credit limit visual safety percentage
  const limitPct = Math.min(100, Math.round((stats.usoCartaoCredito / (user.card_limit || 1)) * 100));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Toast floating notify list */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-xl shadow-2xl border text-xs text-white font-medium flex items-center gap-2 pointer-events-auto shrink-0 ${
              t.type === 'success' ? 'bg-[#06A77D] border-[#078866]' :
              t.type === 'warn' ? 'bg-[#E63946] border-[#BA2B37]' :
              'bg-[#1A2332] border-[#C9A84C]'
            }`}
          >
            <LucideIcon name={t.type === 'success' ? 'Check' : t.type === 'warn' ? 'ShieldAlert' : 'Sparkles'} size={14} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* OPERATIONAL SECTION COL (60%) */}
      <div className="lg:col-span-3 space-y-6">
        {/* HEADER & GLOBAL SALDO AREA */}
        <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2E3C51]/50 pb-4 mb-6">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8A95A5]">Visão Operacional</h2>
              <p className="text-[10px] text-[#C9A84C] font-mono mt-0.5">{headerPeriodStr}</p>
            </div>
            
            {/* Monthly switcher toggle panel */}
            <div className="flex items-center gap-1.5 self-start md:self-auto bg-[#0F1419] p-1 rounded-xl border border-[#2E3C51]/80">
              <button
                onClick={() => {
                  const idx = monthOptions.indexOf(selectedMonth);
                  if (idx > 0) setSelectedMonth(monthOptions[idx - 1]);
                }}
                disabled={monthOptions.indexOf(selectedMonth) === 0}
                className="p-1 px-2 text-xs text-[#8A95A5] hover:text-[#F5F5F7] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                ◀
              </button>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs text-[#F5F5F7] font-mono border-none focus:outline-none focus:ring-0 cursor-pointer text-center px-1 py-0.5"
              >
                {monthOptions.map(opt => {
                  const [y, m] = opt.split('-');
                  const monthsName = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                  const label = `${monthsName[parseInt(m, 10) - 1]}/${y}`;
                  return <option key={opt} value={opt} className="bg-[#0F1419] text-[#F5F5F7] text-left">{label}</option>;
                })}
              </select>
              <button
                onClick={() => {
                  const idx = monthOptions.indexOf(selectedMonth);
                  if (idx !== -1 && idx < monthOptions.length - 1) setSelectedMonth(monthOptions[idx + 1]);
                }}
                disabled={monthOptions.indexOf(selectedMonth) === monthOptions.length - 1}
                className="p-1 px-2 text-xs text-[#8A95A5] hover:text-[#F5F5F7] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                ▶
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Large Balance Display */}
            <div className="space-y-1">
              <span className="text-xs text-[#8A95A5] block">Saldo Disponível Hoje</span>
              <span className={`text-3xl font-mono font-bold tracking-tight block ${stats.saldoDisponivelHoje >= 0 ? 'text-[#06A77D]' : 'text-[#E63946]'}`}>
                {formatCurrency(stats.saldoDisponivelHoje)}
              </span>
              <div className="pt-2">
                <span className="text-xs text-[#8A95A5] block">Saldo Previsto do Fim do Mês:</span>
                <span className={`text-sm font-mono font-semibold ${stats.saldoPrevistoFimMes >= 0 ? 'text-[#06A77D]/90' : 'text-[#E63946]'}`}>
                  {formatCurrency(stats.saldoPrevistoFimMes)}
                </span>
                {stats.saldoPrevistoFimMes < 0 && (
                  <p className="text-[10px] text-[#E63946] mt-1 italic font-medium leading-normal animate-pulse">
                    ⚠️ Você vai usar {formatCurrency(Math.abs(stats.saldoPrevistoFimMes))} de crédito do cartão neste mês
                  </p>
                )}
              </div>
            </div>

            {/* Credit limit progress */}
            <div className="bg-[#0F1419] p-4 rounded-xl border border-[#2E3C51]/40 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-[#8A95A5] font-medium">Uso do Cartão no Ciclo</span>
                  <span className="font-mono text-[#F4A261] font-semibold">{limitPct}%</span>
                </div>
                <div className="w-full bg-[#1A2332] h-2.5 rounded-full overflow-hidden border border-[#2E3C51]">
                  <div
                    className="h-full bg-gradient-to-r from-[#F4A261] to-[#E63946] transition-all duration-500"
                    style={{ width: `${limitPct}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between items-center text-[11px] font-mono mt-2 pt-2 border-t border-[#2E3C51]/20">
                <span className="text-[#8A95A5]">Gasto: {formatCurrency(stats.usoCartaoCredito)}</span>
                <span className="text-[#8A95A5]/60">Limite: {formatCurrency(user.card_limit)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RECEITAS SUBPANEL */}
        <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6">
          <div className="flex justify-between items-center pb-4 mb-4 border-b border-[#2E3C51]/30">
            <h3 className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
              <span className="p-1 px-1.5 bg-[#06A77D]/10 text-[#06A77D] rounded border border-[#06A77D]/30"><LucideIcon name="TrendingUp" size={14} /></span>
              Receitas Realizadas / Previstas
            </h3>
            <button
              onClick={() => setActiveModal('receita')}
              className="text-[#C9A84C] hover:text-[#B0923E] text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <LucideIcon name="Plus" size={14} /> Adicionar
            </button>
          </div>

          {stats.receitasList.length === 0 ? (
            <p className="text-xs text-[#8A95A5] text-center py-4">Nenhuma receita prevista registrada.</p>
          ) : (
            <div className="space-y-2.5">
              {stats.receitasList.map(({ item, recebido }) => (
                <div
                  key={item.id}
                  onDoubleClick={() => handleStartEdit('rec', item)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer select-none ${
                    recebido
                      ? 'bg-[#06A77D]/5 border-[#06A77D]/20 opacity-60'
                      : 'bg-[#0F1419] border-[#2E3C51] hover:border-[#2E3C51]*2'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={recebido}
                      onChange={() => handleToggleReceita(item.id, item.nome, recebido)}
                      className="w-4 h-4 rounded border-[#2E3C51] bg-[#1A2332] text-[#C9A84C] focus:ring-[#C9A84C] shrink-0 cursor-pointer"
                    />
                    <div>
                      <span className={`text-xs font-medium block text-[#F5F5F7] ${recebido ? 'line-through decoration-[#8A95A5]' : ''}`}>
                        {item.nome}
                      </span>
                      {item.recorrente && <span className="text-[9px] uppercase tracking-wider font-semibold text-[#8A95A5] bg-[#2E3C51] rounded px-1 mt-0.5 inline-block">Recorrente</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-xs font-bold text-[#06A77D]">{formatCurrency(item.valor)}</span>
                    {item.dia_recebimento && <p className="text-[10px] text-[#8A95A5] font-mono mt-0.5">Dia {item.dia_recebimento}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FIXED EXPENSES SUBPANEL */}
        <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6">
          <div className="flex justify-between items-center pb-4 mb-4 border-b border-[#2E3C51]/30">
            <h3 className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
              <span className="p-1 px-1.5 bg-[#E63946]/10 text-[#E63946] rounded border border-[#E63946]/30"><LucideIcon name="HeartPulse" size={14} /></span>
              Despesas Fixas
            </h3>
            <button
              onClick={() => setActiveModal('despesa')}
              className="text-[#C9A84C] hover:text-[#B0923E] text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <LucideIcon name="Plus" size={14} /> Adicionar
            </button>
          </div>

          {stats.despesasFixasList.length === 0 ? (
            <p className="text-xs text-[#8A95A5] text-center py-4">Nenhuma despesa fixa prevista registrada.</p>
          ) : (
            <div className="space-y-2.5">
              {stats.despesasFixasList.map(({ item, pago }) => (
                <div
                  key={item.id}
                  onDoubleClick={() => handleStartEdit('df', item)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer select-none ${
                    pago
                      ? 'bg-[#E63946]/5 border-[#E63946]/20 opacity-60'
                      : 'bg-[#0F1419] border-[#2E3C51] hover:border-[#2E3C51]*2'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={pago}
                      onChange={() => handleToggleDespesa(item.id, item.nome, pago)}
                      className="w-4 h-4 rounded border-[#2E3C51] bg-[#1A2332] text-[#C9A84C] focus:ring-[#C9A84C] shrink-0 cursor-pointer"
                    />
                    <div>
                      <span className={`text-xs font-medium block text-[#F5F5F7] ${pago ? 'line-through decoration-[#8A95A5]' : ''}`}>
                        {item.nome}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] font-semibold text-white bg-[#2E3C51] rounded px-1.5 py-0.5 uppercase tracking-wider font-mono shrink-0">
                          {item.forma_pagamento}
                        </span>
                        {item.observacao && (
                          <span className="text-[10px] text-[#8A95A5] truncate max-w-[120px] inline-block">{item.observacao}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-xs font-bold text-[#E63946]">{formatCurrency(item.valor)}</span>
                    <p className="text-[10px] text-[#8A95A5] font-mono mt-0.5">Venc. {item.dia_vencimento}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* INSTALLMENTS & SUBSCRIPTIONS ACTIVE SUBPANEL */}
        <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6">
          <div className="flex justify-between items-center pb-4 mb-4 border-b border-[#2E3C51]/30">
            <h3 className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
              <span className="p-1 px-1.5 bg-[#C9A84C]/10 text-[#C9A84C] rounded border border-[#C9A84C]/30"><LucideIcon name="CreditCard" size={14} /></span>
              Parcelamentos & Assinaturas Ativas
            </h3>
            <button
              onClick={() => setActiveModal('parcelamento')}
              className="text-[#C9A84C] hover:text-[#B0923E] text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <LucideIcon name="Plus" size={14} /> Novo
            </button>
          </div>

          {stats.parcelasPredictsList.length === 0 ? (
            <p className="text-xs text-[#8A95A5] text-center py-4">Nenhum parcelamento ativo neste ciclo.</p>
          ) : (
            <div className="space-y-2.5">
              {stats.parcelasPredictsList.map(({ item, paga, numParcelaStr, valor }) => (
                <div
                  key={item.id}
                  onDoubleClick={() => handleStartEdit('parc', item)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer select-none ${
                    paga
                      ? 'bg-[#C9A84C]/5 border-[#C9A84C]/20 opacity-60'
                      : 'bg-[#0F1419] border-[#2E3C51] hover:border-[#2E3C51]*2'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={paga}
                      onChange={() => handleToggleParcela(item.id, item.nome, paga)}
                      className="w-4 h-4 rounded border-[#2E3C51] bg-[#1A2332] text-[#C9A84C] focus:ring-[#C9A84C] shrink-0 cursor-pointer"
                    />
                    <div>
                      <span className={`text-xs font-medium block text-[#F5F5F7] ${paga ? 'line-through decoration-[#8A95A5]' : ''}`}>
                        {item.nome}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1 font-mono">
                        <span className="text-[9px] bg-[#2E3C51] text-[#C9A84C] font-semibold uppercase tracking-wider py-0.5 px-2 rounded shrink-0">
                          {numParcelaStr}
                        </span>
                        <span className="text-[9px] text-[#8A95A5] uppercase font-semibold">
                          ({item.forma_pagamento})
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-xs font-bold text-[#E63946]">{formatCurrency(valor)}</span>
                    <p className="text-[10px] text-[#8A95A5] font-mono mt-0.5">Cobrança: dia {item.dia_cobranca}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DAILY EXPENDITURE LANÇAMENTO RÁPIDO */}
        <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6">
          <div className="border-b border-[#2E3C51]/30 pb-4 mb-4">
            <h3 className="text-base font-semibold text-[#F5F5F7] flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="p-1 px-1.5 bg-[#F4A261]/10 text-[#F4A261] rounded border border-[#F4A261]/30"><LucideIcon name="Car" size={14} /></span>
                Gastos do Dia a Dia
              </span>
              <kbd className="hidden sm:inline-block px-2 py-0.5 bg-[#0F1419] border border-[#2E3C51] rounded text-[10px] text-[#8A95A5] font-mono shadow-sm">
                Aperte 'N' para focar
              </kbd>
            </h3>
          </div>

          {/* Quick inline entry form */}
          <form onSubmit={handleAddTransacao} className="space-y-3 bg-[#0F1419] p-4 rounded-xl border border-[#2E3C51]/40 mb-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                ref={trInputRef}
                type="text"
                placeholder="Nome do gasto"
                value={trNome}
                onChange={(e) => setTrNome(e.target.value)}
                className="bg-[#1A2332] border border-[#2E3C51] text-[#F5F5F7] text-xs rounded-lg p-2.5 focus:outline-none focus:border-[#C9A84C]"
                required
              />
              <input
                type="number"
                step="0.01"
                placeholder="R$ Valor"
                value={trValor}
                onChange={(e) => setTrValor(e.target.value)}
                className="bg-[#1A2332] border border-[#2E3C51] text-[#F5F5F7] text-xs font-mono rounded-lg p-2.5 focus:outline-none focus:border-[#C9A84C]"
                required
              />
              <select
                value={trCat}
                onChange={(e) => setTrCat(e.target.value)}
                className="bg-[#1A2332] border border-[#2E3C51] text-[#F5F5F7] text-xs rounded-lg p-2.5 focus:outline-none cursor-pointer"
                required
              >
                {categories.filter(c => c.tipo === 'despesa').map(c => (
                  <option key={c.id} value={c.id} className="bg-[#1A2332]">
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                value={trFP}
                onChange={(e) => setTrFP(e.target.value as PaymentMethod)}
                className="bg-[#1A2332] border border-[#2E3C51] text-[#F5F5F7] text-xs rounded-lg p-2.5 focus:outline-none cursor-pointer"
              >
                <option value="credito">Cartão de Crédito</option>
                <option value="debito">Débito em Conta</option>
                <option value="pix">PIX</option>
                <option value="boleto">Boleto</option>
                <option value="dinheiro">Dinheiro</option>
              </select>
              <input
                type="date"
                value={trData}
                onChange={(e) => setTrData(e.target.value)}
                className="bg-[#1A2332] border border-[#2E3C51] text-[#F5F5F7] text-xs font-mono rounded-lg p-2.5 focus:outline-none focus:border-[#C9A84C]"
                required
              />
              <button
                type="submit"
                className="bg-[#F4A261] hover:bg-[#DE9152] text-[#0F1419] font-semibold text-xs py-2.5 rounded-lg transition shadow flex items-center justify-center gap-1 cursor-pointer"
              >
                <LucideIcon name="Plus" size={14} /> Adicionar Lançamento
              </button>
            </div>
          </form>

          {stats.transacoesList.length === 0 ? (
            <p className="text-xs text-[#8A95A5] text-center py-4">Nenhum gasto lançado para este ciclo ainda.</p>
          ) : (
            <div className="space-y-2">
              {[...stats.transacoesList]
                .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime() || b.created_at.localeCompare(a.created_at))
                .slice(0, 20)
                .map(tr => {
                  const cat = categories.find(c => c.id === tr.categoria_id);
                  return (
                    <div
                      key={tr.id}
                      onDoubleClick={() => handleStartEdit('tr', tr)}
                      className="flex items-center justify-between p-3 bg-[#0F1419] border border-[#2E3C51] rounded-xl hover:border-[#2E3C51]*2 transition select-none cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat?.cor || '#6C757D' }}
                        />
                        <div>
                          <span className="text-xs font-medium text-[#F5F5F7] block">{tr.nome}</span>
                          <span className="text-[10px] text-[#8A95A5] font-mono block mt-0.5">
                            {formatDate(tr.data)} • {tr.forma_pagamento.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end">
                        <span className="font-mono text-xs font-bold text-[#E63946]">{formatCurrency(tr.valor)}</span>
                        {cat && (
                          <span
                            className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded mt-1"
                            style={{ backgroundColor: `${cat.cor}15`, color: cat.cor }}
                          >
                            {cat.nome}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              {stats.transacoesList.length > 20 && (
                <div className="text-center pt-3 mt-1 text-xs text-[#8A95A5]">
                  Mostrando as últimas 20 transações. Para mais detalhes, consulte a aba Cadastros.
                </div>
              )}
            </div>
          )}
        </div>

        {/* FREEFORM ANNOTATIONS PANEL */}
        <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6">
          <div className="flex justify-between items-center pb-4 mb-4 border-b border-[#2E3C51]/30">
            <h3 className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
              <span className="p-1 px-1.5 bg-[#7209B7]/10 text-[#7209B7] rounded border border-[#7209B7]/30"><LucideIcon name="BookOpen" size={14} /></span>
              Anotações Livres
            </h3>
            <button
              onClick={handleAddNota}
              className="text-[#C9A84C] hover:text-[#B0923E] text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <LucideIcon name="Plus" size={14} /> Nova Nota
            </button>
          </div>

          {notas.length === 0 ? (
            <p className="text-xs text-[#8A95A5] text-center py-4">Crie anotações para planejar suas metas financeiras.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {notas.map(note => {
                const isEditing = activeNoteEditId === note.id;
                return (
                  <div
                    key={note.id}
                    className="bg-[#0F1419] border border-[#2E3C51] rounded-xl p-4 flex flex-col justify-between focus-within:border-[#C9A84C] transition"
                  >
                    {isEditing ? (
                      <div className="space-y-3 w-full">
                        <input
                          type="text"
                          value={noteEditTitle}
                          onChange={(e) => setNoteEditTitle(e.target.value)}
                          className="w-full bg-[#1A2332] border border-[#2E3C51] text-[#F5F5F7] text-xs font-bold rounded p-2 focus:outline-none focus:border-[#C9A84C]"
                        />
                        <textarea
                          rows={4}
                          value={noteEditContent}
                          onChange={(e) => setNoteEditContent(e.target.value)}
                          className="w-full bg-[#1A2332] border border-[#2E3C51] text-[#8A95A5] text-xs rounded p-2 focus:outline-none focus:border-[#C9A84C] resize-none font-mono"
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setActiveNoteEditId(null)}
                            className="px-2.5 py-1.5 rounded bg-[#2E3C51] text-xs text-[#8A95A5] hover:text-white transition cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleSaveNota(note.id)}
                            className="px-3 py-1.5 rounded bg-[#C9A84C] text-[#0F1419] font-medium text-xs hover:bg-[#B0923E] transition cursor-pointer"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col h-full justify-between gap-4">
                        <div onClick={() => {
                          setActiveNoteEditId(note.id);
                          setNoteEditTitle(note.titulo);
                          setNoteEditContent(note.conteudo);
                        }} className="space-y-2 cursor-pointer w-full text-left">
                          <h4 className="text-xs font-bold text-[#F5F5F7] hover:text-[#C9A84C] transition tracking-tight flex items-center justify-between">
                            <span>{note.titulo}</span>
                            <LucideIcon name="Edit2" size={12} className="opacity-45" />
                          </h4>
                          <p className="text-[11px] text-[#8A95A5] truncate leading-relaxed">
                            {note.conteudo.replace(/[#*`[\]]/g, '')}
                          </p>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-[#8A95A5]/60 pt-2 border-t border-[#2E3C51]/20 mt-auto">
                          <span>Alt: {formatDate(note.updated_at)}</span>
                          <button
                            onClick={(e) => handleDeleteNota(note.id, e)}
                            className="text-[#E63946] hover:underline cursor-pointer"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ANALYTIC CABINET SECTIONS (40%) */}
      <div className="lg:col-span-2 space-y-6">
        {/* CARD OVERALL RESUME */}
        <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6 space-y-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8A95A5] pb-3 border-b border-[#2E3C51]/30">
            Relatório de Balanço Geral
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0F1419] p-3.5 rounded-xl border border-[#2E3C51]/50">
              <span className="text-[10px] text-[#8A95A5] block">Total Previsto Receita</span>
              <span className="text-base font-mono font-bold text-[#06A77D] mt-1 block">
                {formatCurrency(stats.totalReceitasPrevistas)}
              </span>
            </div>
            <div className="bg-[#0F1419] p-3.5 rounded-xl border border-[#2E3C51]/50">
              <span className="text-[10px] text-[#8A95A5] block">Total Despesa Prevista</span>
              <span className="text-base font-mono font-bold text-[#E63946] mt-1 block">
                {formatCurrency(stats.totalDespesasFixasPrevistas + stats.totalParcelasPrevistas)}
              </span>
            </div>
          </div>

          <div className="bg-[#0F1419] p-4 rounded-xl border border-[#2E3C51]/60">
            <span className="text-[10px] text-[#8A95A5] block">Saldo Previsto Final do Mês</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className={`text-xl font-mono font-bold ${stats.saldoPrevistoFimMes >= 0 ? 'text-[#06A77D]' : 'text-[#E63946]'}`}>
                {formatCurrency(stats.saldoPrevistoFimMes)}
              </span>
              <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${automEval.type === 'success' ? 'bg-[#06A77D]/10 text-[#06A77D]' : 'bg-[#E63946]/10 text-[#E63946]'}`}>
                {automEval.title}
              </span>
            </div>
          </div>

          <div className="bg-[#101724] border border-[#2E3C51] p-4 rounded-xl space-y-2">
            <h4 className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Avaliação do Mês</h4>
            <p className="text-xs text-[#8A95A5] leading-relaxed">
              {automEval.desc}
            </p>
          </div>
        </div>

        {/* RECHARTS PIE CHART FOR SPENDING */}
        <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8A95A5] pb-3 border-b border-[#2E3C51]/30 mb-4">
            Distribuição de Gastos por Categoria
          </h3>

          {pieChartData.length === 0 ? (
            <p className="text-xs text-[#8A95A5] text-center py-8">Não há dados suficientes de gastos pagos para desenhar a pizza.</p>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-full h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: any) => formatCurrency(Number(value))}
                      contentStyle={{ backgroundColor: '#1A2332', border: '1px solid #2E3C51', borderRadius: '8px' }}
                      itemStyle={{ color: '#F5F5F7', fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Legends */}
              <div className="mt-2 grid grid-cols-2 gap-2.5 w-full">
                {pieChartData.map((e, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[10px] text-[#8A95A5] truncate">
                    <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: e.color }} />
                    <span className="truncate">{e.name}:</span>
                    <span className="font-mono text-[#F5F5F7] text-left">{formatCurrency(e.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* TOP 5 SPENDING HIERARCHY */}
        <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8A95A5] pb-3 border-b border-[#2E3C51]/30 mb-4">
            Top 5 de Gastos
          </h3>

          {topSpentCategories.length === 0 ? (
            <p className="text-xs text-[#8A95A5] text-center py-4">Nenhuma despesa ou parcelas pagas este mês.</p>
          ) : (
            <div className="space-y-4">
              {topSpentCategories.map((item, idx) => {
                const percentage = Math.round((item.value / highestTopValue) * 100);
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#F5F5F7] font-medium">{idx + 1}. {item.name}</span>
                      <span className="font-mono text-[#8A95A5]">{formatCurrency(item.value)}</span>
                    </div>
                    <div className="w-full bg-[#0F1419] h-2 rounded-full overflow-hidden border border-[#2E3C51]/40">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RECHARTS HISTORICAL BALANCE LINE EVOLUTION */}
        <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8A95A5] pb-3 border-b border-[#2E3C51]/30 mb-4">
            Evolução de Saldo Diário no Mês
          </h3>

          <div className="w-full h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <XAxis dataKey="diaLabel" stroke="#8A95A5" fontSize={9} />
                <YAxis stroke="#8A95A5" fontSize={9} />
                <RechartsTooltip
                  formatter={(value: any) => formatCurrency(Number(value))}
                  contentStyle={{ backgroundColor: '#1A2332', border: '1px solid #2E3C51', borderRadius: '8px' }}
                  itemStyle={{ color: '#F5F5F7', fontSize: '11px' }}
                />
                <Line
                  type="monotone"
                  dataKey="saldo"
                  stroke="#C9A84C"
                  strokeWidth={2}
                  dot={{ r: 1 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[9px] text-[#8A95A5] font-mono text-center mt-2">
            Acompanhamento contínuo dia-a-dia do saldo disponível
          </p>
        </div>

        {/* RULE AUTOMATED ADVISOR / RECOMMENDATIONS */}
        <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8A95A5] pb-3 border-b border-[#2E3C51]/30 flex items-center gap-1">
            <LucideIcon name="Sparkles" size={14} className="text-[#C9A84C]" /> Recomendação da Carteira
          </h3>

          <ul className="space-y-3">
            {automRecommends.map((item, idx) => (
              <li
                key={idx}
                className="bg-[#0F1419] border-l-2 border-[#C9A84C] text-[11px] text-[#8A95A5] p-3 rounded-r-xl leading-relaxed font-sans"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* CONFIRMATION DIALOG GATES FOR CHECKBOX SAFETY */}
      <AnimatePresence>
        {uncheckConfirm && (
          <div className="fixed inset-0 bg-[#0F1419]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A2332] border border-[#2E3C51] max-w-sm rounded-2xl p-6 space-y-4 shadow-2xl relative"
            >
              <h4 className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
                <LucideIcon name="ShieldAlert" className="text-[#F4A261]" />
                Tem certeza?
              </h4>
              <p className="text-xs text-[#8A95A5] leading-relaxed">
                Você está prestes a desmarcar o pagamento da parcela/conta "{uncheckConfirm.name}". Isso irá recalcular instantaneamente os saldos e gráficos do seu mês financeiro de {selectedMonth}.
              </p>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setUncheckConfirm(null)}
                  className="px-4 py-2 bg-[#0F1419] border border-[#2E3C51] text-xs font-medium rounded-xl text-[#8A95A5] hover:text-white transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmUncheck}
                  className="px-4 py-2 bg-[#E63946] hover:bg-[#C5303C] text-white text-xs font-medium rounded-xl transition cursor-pointer"
                >
                  Sim, Desmarcar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* GENERAL ADD/EDIT MODALS */}
        {activeModal && activeModal !== 'edit-item' && (
          <div className="fixed inset-0 bg-[#0F1419]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-[#1A2332] border border-[#2E3C51] w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-center border-b border-[#2E3C51]/30 pb-3">
                <h4 className="text-sm font-bold text-[#F5F5F7] flex items-center gap-2">
                  <LucideIcon name="Plus" className="text-[#C9A84C]" />
                  {activeModal === 'receita' ? 'Adicionar Nova Receita' :
                   activeModal === 'despesa' ? 'Cadastrar Despesa Fixa' :
                   'Adicionar Parcelamento / Assinatura'}
                </h4>
                <button onClick={() => setActiveModal(null)} className="text-[#8A95A5] hover:text-white cursor-pointer">
                  <LucideIcon name="X" size={18} />
                </button>
              </div>

              {/* RECEITA ADD MODAL FORM */}
              {activeModal === 'receita' && (
                <form onSubmit={handleModalAddReceita} className="space-y-4 text-left">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Nome da Receita</label>
                    <input
                      type="text"
                      className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                      placeholder="Ex: Freelance Web"
                      value={addRecNome}
                      onChange={(e) => setAddRecNome(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Valor</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7] font-mono"
                        placeholder="0.00"
                        value={addRecValor}
                        onChange={(e) => setAddRecValor(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Categoria</label>
                      <select
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7] cursor-pointer"
                        value={addRecCat}
                        onChange={(e) => setAddRecCat(e.target.value)}
                        required
                      >
                        {categories.filter(c => c.tipo === 'receita').map(c => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Dia Estimado</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                        value={addRecDia}
                        onChange={(e) => setAddRecDia(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <input
                        type="checkbox"
                        checked={addRecRecorrente}
                        onChange={(e) => setAddRecRecorrente(e.target.checked)}
                        className="w-4 h-4 rounded text-[#C9A84C] bg-[#0F1419] border-[#2E3C51]"
                      />
                      <label className="text-xs text-[#8A95A5] font-medium selection:bg-transparent">Recorrente mensal?</label>
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-[#06A77D] hover:bg-[#058F6B] text-white py-3 rounded-xl text-xs font-semibold mt-4 cursor-pointer">
                    Salvar Receita
                  </button>
                </form>
              )}

              {/* DESPESA ADD MODAL FORM */}
              {activeModal === 'despesa' && (
                <form onSubmit={handleModalAddDespesa} className="space-y-4 text-left">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Nome da Despesa</label>
                    <input
                      type="text"
                      className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                      placeholder="Ex: IPTU"
                      value={addDespNome}
                      onChange={(e) => setAddDespNome(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Valor</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7] font-mono"
                        placeholder="0.00"
                        value={addDespValor}
                        onChange={(e) => setAddDespValor(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Categoria</label>
                      <select
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7] cursor-pointer"
                        value={addDespCat}
                        onChange={(e) => setAddDespCat(e.target.value)}
                        required
                      >
                        {categories.filter(c => c.tipo === 'despesa').map(c => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Dia Vencimento</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                        value={addDespDia}
                        onChange={(e) => setAddDespDia(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Forma Pagamento</label>
                      <select
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                        value={addDespFP}
                        onChange={(e) => setAddDespFP(e.target.value as PaymentMethod)}
                      >
                        <option value="pix">PIX</option>
                        <option value="boleto">Boleto</option>
                        <option value="debito">Débito</option>
                        <option value="credito">Crédito</option>
                        <option value="dinheiro">Dinheiro</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Observações (opcional)</label>
                    <input
                      type="text"
                      className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                      placeholder="Alguma nota explicativa"
                      value={addDespObs}
                      onChange={(e) => setAddDespObs(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="w-full bg-[#E63946] hover:bg-[#C5303C] text-white py-3 rounded-xl text-xs font-semibold mt-4 cursor-pointer">
                    Salvar Despesa Fixa
                  </button>
                </form>
              )}

              {/* PARCELAMENTO ADD MODAL FORM */}
              {activeModal === 'parcelamento' && (
                <form onSubmit={handleModalAddParcelamento} className="space-y-4 text-left">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Nome</label>
                    <input
                      type="text"
                      className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                      placeholder="Ex: Smartphone Novo ou Netflix"
                      value={addParcNome}
                      onChange={(e) => setAddParcNome(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Valor Parcela</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7] font-mono"
                        placeholder="0.00"
                        value={addParcVal}
                        onChange={(e) => setAddParcVal(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Categoria</label>
                      <select
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7] cursor-pointer"
                        value={addParcCat}
                        onChange={(e) => setAddParcCat(e.target.value)}
                        required
                      >
                        {categories.filter(c => c.tipo === 'despesa').map(c => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Tipo de Lançamento</label>
                      <select
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                        value={addParcTipo}
                        onChange={(e) => setAddParcTipo(e.target.value as any)}
                        required
                      >
                        <option value="parcelado">Parcelado (compras e dívidas)</option>
                        <option value="assinatura">Assinatura / Serviço Fixo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Primeira Cobrança (Data)</label>
                      <input
                        type="date"
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7] font-mono"
                        value={addParcStart}
                        onChange={(e) => setAddParcStart(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Dia Cobrança</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                        value={addParcDia}
                        onChange={(e) => setAddParcDia(e.target.value)}
                        required
                      />
                    </div>
                    {addParcTipo === 'parcelado' && (
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Qtd Parcelas Total</label>
                        <input
                          type="number"
                          className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                          value={addParcTotal}
                          onChange={(e) => setAddParcTotal(e.target.value)}
                          required
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Forma Pagamento</label>
                      <select
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                        value={addParcFP}
                        onChange={(e) => setAddParcFP(e.target.value as PaymentMethod)}
                      >
                        <option value="credito">Cartão de Crédito</option>
                        <option value="debito">Débito</option>
                        <option value="pix">PIX</option>
                        <option value="boleto">Boleto</option>
                        <option value="dinheiro">Dinheiro</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Observações (opcional)</label>
                    <input
                      type="text"
                      className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                      placeholder="Anotações sobre a compra"
                      value={addParcObs}
                      onChange={(e) => setAddParcObs(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="w-full bg-[#C9A84C] hover:bg-[#B0923E] text-[#0F1419] py-3 rounded-xl text-xs font-bold mt-4 cursor-pointer">
                    Confirmar Cadastro
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}

        {/* COMPREHENSIVE REGISTERS EDIT/DOUBLE CLICK FORM MODAL */}
        {activeModal === 'edit-item' && editTarget && (
          <div className="fixed inset-0 bg-[#0F1419]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A2332] border border-[#2E3C51] w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl relative"
            >
              <div className="flex justify-between items-center border-b border-[#2E3C51]/30 pb-3">
                <h4 className="text-sm font-bold text-[#FDFDFD] flex items-center gap-2">
                  <LucideIcon name="Edit2" className="text-[#C9A84C]" />
                  Editar Lançamento
                </h4>
                <button
                  onClick={() => {
                    setActiveModal(null);
                    setEditTarget(null);
                  }}
                  className="text-[#8A95A5] hover:text-white cursor-pointer"
                >
                  <LucideIcon name="X" size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Nome</label>
                  <input
                    type="text"
                    className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                    value={editTarget.data.nome}
                    onChange={(e) => setEditTarget({ ...editTarget, data: { ...editTarget.data, nome: e.target.value } })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">
                      {editTarget.type === 'parc' ? 'Valor Parcela' : 'Valor'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7] font-mono"
                      value={editTarget.type === 'parc' ? editTarget.data.valor_parcela : editTarget.data.valor}
                      onChange={(e) => setEditTarget({
                        ...editTarget,
                        data: {
                          ...editTarget.data,
                          [editTarget.type === 'parc' ? 'valor_parcela' : 'valor']: e.target.value
                        }
                      })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Categoria</label>
                    <select
                      className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7] cursor-pointer"
                      value={editTarget.data.categoria_id}
                      onChange={(e) => setEditTarget({ ...editTarget, data: { ...editTarget.data, categoria_id: e.target.value } })}
                      required
                    >
                      {categories.filter(c => c.tipo === (editTarget.type === 'rec' ? 'receita' : 'despesa')).map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {editTarget.type === 'rec' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Dia Recebimento</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                        value={editTarget.data.dia_recebimento || ''}
                        onChange={(e) => setEditTarget({ ...editTarget, data: { ...editTarget.data, dia_recebimento: e.target.value } })}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <input
                        type="checkbox"
                        checked={editTarget.data.recorrente}
                        onChange={(e) => setEditTarget({ ...editTarget, data: { ...editTarget.data, recorrente: e.target.checked } })}
                        className="w-4 h-4 rounded text-[#C9A84C] bg-[#0F1419] border-[#2E3C51]"
                      />
                      <label className="text-xs text-[#8A95A5] font-semibold">Recorrente?</label>
                    </div>
                  </div>
                )}

                {editTarget.type === 'df' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Dia Vencimento</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                        value={editTarget.data.dia_vencimento}
                        onChange={(e) => setEditTarget({ ...editTarget, data: { ...editTarget.data, dia_vencimento: e.target.value } })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Forma Pagamento</label>
                      <select
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                        value={editTarget.data.forma_pagamento}
                        onChange={(e) => setEditTarget({ ...editTarget, data: { ...editTarget.data, forma_pagamento: e.target.value } })}
                      >
                        <option value="pix">PIX</option>
                        <option value="boleto">Boleto</option>
                        <option value="debito">Débito</option>
                        <option value="credito">Crédito</option>
                        <option value="dinheiro">Dinheiro</option>
                      </select>
                    </div>
                  </div>
                )}

                {editTarget.type === 'parc' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Dia Cobrança</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                        value={editTarget.data.dia_cobranca}
                        onChange={(e) => setEditTarget({ ...editTarget, data: { ...editTarget.data, dia_cobranca: e.target.value } })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Forma Pagamento</label>
                      <select
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                        value={editTarget.data.forma_pagamento}
                        onChange={(e) => setEditTarget({ ...editTarget, data: { ...editTarget.data, forma_pagamento: e.target.value } })}
                      >
                        <option value="credito">Crédito</option>
                        <option value="debito">Débito</option>
                        <option value="pix">PIX</option>
                        <option value="boleto">Boleto</option>
                        <option value="dinheiro">Dinheiro</option>
                      </select>
                    </div>
                  </div>
                )}

                {editTarget.type === 'tr' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Data Lançamento</label>
                      <input
                        type="date"
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7] font-mono"
                        value={editTarget.data.data}
                        onChange={(e) => setEditTarget({ ...editTarget, data: { ...editTarget.data, data: e.target.value } })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Forma Pagamento</label>
                      <select
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                        value={editTarget.data.forma_pagamento}
                        onChange={(e) => setEditTarget({ ...editTarget, data: { ...editTarget.data, forma_pagamento: e.target.value } })}
                      >
                        <option value="credito">Crédito</option>
                        <option value="debito">Débito</option>
                        <option value="pix">PIX</option>
                        <option value="boleto">Boleto</option>
                        <option value="dinheiro">Dinheiro</option>
                      </select>
                    </div>
                  </div>
                )}

                {(editTarget.type === 'df' || editTarget.type === 'parc' || editTarget.type === 'tr') && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Observações (opcional)</label>
                    <input
                      type="text"
                      className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-[#F5F5F7]"
                      value={editTarget.data.observacao || ''}
                      onChange={(e) => setEditTarget({ ...editTarget, data: { ...editTarget.data, observacao: e.target.value } })}
                    />
                  </div>
                )}

                <div className="pt-4 border-t border-[#2E3C51]/30 flex justify-between items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(editTarget.type, editTarget.data.id)}
                    className="bg-[#E63946]/10 border border-[#E63946]/30 text-[#E63946] hover:bg-[#E63946]/20 py-2.5 px-4 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Excluir Registro
                  </button>
                  <button type="submit" className="bg-[#C9A84C] hover:bg-[#B0923E] text-[#0F1419] font-bold text-xs py-2.5 px-6 rounded-xl transition cursor-pointer">
                    Salvar Mudanças
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
