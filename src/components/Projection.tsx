/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, Receita, DespesaFixa, Parcelamento, Transacao, Categoria, PaymentMethod, Projecao } from '../types';
import { DatabaseService, generateId } from '../utils/db';
import {
  formatCurrency,
  formatDate,
  getFinancialMonthOptions,
  getFinancialMonthRange,
  calculateFinancialStats,
  getAutomaticEvaluation,
  getAutomaticRecommendations,
  FinancialStats
} from '../utils/finance';
import LucideIcon from './LucideIcon';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip
} from 'recharts';

interface ProjectionProps {
  user: User;
}

export default function Projection({ user }: ProjectionProps) {
  // Month selection (all options)
  const monthOptions = getFinancialMonthOptions(user.closing_day);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[7] || monthOptions[monthOptions.length - 1] || '2026-07');

  // Core Data States
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [savedProjections, setSavedProjections] = useState<Projecao[]>([]);

  // Simulation Sandbox Sandbox Cloned States
  const [sandboxReceitas, setSandboxReceitas] = useState<Receita[]>([]);
  const [sandboxDespesas, setSandboxDespesas] = useState<DespesaFixa[]>([]);
  const [sandboxParcelamentos, setSandboxParcelamentos] = useState<Parcelamento[]>([]);
  const [sandboxTransacoes, setSandboxTransacoes] = useState<Transacao[]>([]);

  // Quick addition states within sandbox
  const [addingType, setAddingType] = useState<'rec' | 'df' | 'parc' | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [valInput, setValInput] = useState('');
  const [catInput, setCatInput] = useState('');
  const [fpInput, setFpInput] = useState<PaymentMethod>('debito');
  const [diaInput, setDiaInput] = useState('10');

  // Saved Scenario Inputs
  const [scenarioName, setScenarioName] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Load and clone base state
  useEffect(() => {
    const cats = DatabaseService.getCategories(user.id);
    const recs = DatabaseService.getReceitas(user.id).filter(r => r.ativa);
    const dfs = DatabaseService.getDespesasFixas(user.id).filter(d => d.ativa);
    const parcs = DatabaseService.getParcelamentos(user.id).filter(p => p.ativa);
    const projs = DatabaseService.getProjecoes(user.id);

    setCategories(cats);
    setSavedProjections(projs);

    // Deep clone recipes/costs into sandbox context
    setSandboxReceitas(JSON.parse(JSON.stringify(recs)));
    setSandboxDespesas(JSON.parse(JSON.stringify(dfs)));
    setSandboxParcelamentos(JSON.parse(JSON.stringify(parcs)));
    setSandboxTransacoes([]); // Keep transaction empty for future forecasts

    setCatInput(cats.find(c => c.tipo === 'despesa')?.id || '');
  }, [user.id, selectedMonth]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3000);
  };

  // 2. SANDBOX MUTATIONS - ONLY IN STATE MEMORY
  const handleAddSandboxItem = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(valInput);
    if (!nameInput || isNaN(val) || val <= 0 || !catInput) return;

    if (addingType === 'rec') {
      const newItem: Receita = {
        id: `sandbox-rec-${generateId()}`,
        user_id: user.id,
        nome: nameInput,
        valor: val,
        categoria_id: catInput,
        recorrente: true,
        ativa: true,
        created_at: new Date().toISOString()
      };
      setSandboxReceitas([...sandboxReceitas, newItem]);
      showToast(`Receita "${nameInput}" adicionada à simulação.`);
    } else if (addingType === 'df') {
      const newItem: DespesaFixa = {
        id: `sandbox-df-${generateId()}`,
        user_id: user.id,
        nome: nameInput,
        valor: val,
        categoria_id: catInput,
        dia_vencimento: parseInt(diaInput, 10) || 10,
        forma_pagamento: fpInput,
        ativa: true,
        created_at: new Date().toISOString()
      };
      setSandboxDespesas([...sandboxDespesas, newItem]);
      showToast(`Despesa "${nameInput}" adicionada à simulação.`);
    } else if (addingType === 'parc') {
      const newItem: Parcelamento = {
        id: `sandbox-parc-${generateId()}`,
        user_id: user.id,
        nome: nameInput,
        valor_parcela: val,
        categoria_id: catInput,
        forma_pagamento: fpInput,
        tipo: 'parcelado',
        data_primeira_cobranca: '2026-01-01',
        total_parcelas: 12,
        dia_cobranca: parseInt(diaInput, 10) || 5,
        ativa: true,
        created_at: new Date().toISOString()
      };
      setSandboxParcelamentos([...sandboxParcelamentos, newItem]);
      showToast(`Parcelamento "${nameInput}" adicionado à simulação.`);
    }

    setNameInput('');
    setValInput('');
    setAddingType(null);
  };

  const handleRemoveSandboxItem = (id: string, type: 'rec' | 'df' | 'parc') => {
    if (type === 'rec') {
      setSandboxReceitas(sandboxReceitas.filter(r => r.id !== id));
    } else if (type === 'df') {
      setSandboxDespesas(sandboxDespesas.filter(d => d.id !== id));
    } else if (type === 'parc') {
      setSandboxParcelamentos(sandboxParcelamentos.filter(p => p.id !== id));
    }
    showToast('Lançamento removido da simulação.');
  };

  // Convert Sandbox states to standard financial calculation arrays (pretending everything is checked or unchecked for prediction)
  // By default, forecast predicts all active receipts and bills are computed. So we pass them representing standard state
  const mockReceitasPagas: any[] = []; // empty, so we see "Predicted/Previsto" calculations
  const mockDespesasPagas: any[] = [];
  const mockParcelasPagas: any[] = [];

  const stats: FinancialStats = calculateFinancialStats(
    user,
    selectedMonth,
    sandboxReceitas,
    mockReceitasPagas,
    sandboxDespesas,
    mockDespesasPagas,
    sandboxParcelamentos,
    mockParcelasPagas,
    sandboxTransacoes
  );

  const automEval = getAutomaticEvaluation(stats.saldoPrevistoFimMes, user.card_limit);

  // Recharts Pie Chart Spending distribution sandbox mapping
  const categorySummary: { [catId: string]: { value: number; name: string; color: string } } = {};
  
  stats.despesasFixasList.forEach(d => {
    const c = categories.find(cat => cat.id === d.item.categoria_id);
    if (c) {
      categorySummary[c.id] = categorySummary[c.id] || { value: 0, name: c.nome, color: c.cor };
      categorySummary[c.id].value += d.item.valor;
    }
  });

  stats.parcelasPredictsList.forEach(p => {
    const c = categories.find(cat => cat.id === p.item.categoria_id);
    if (c) {
      categorySummary[c.id] = categorySummary[c.id] || { value: 0, name: c.nome, color: c.cor };
      categorySummary[c.id].value += p.valor;
    }
  });

  const pieChartData = Object.keys(categorySummary)
    .map(key => categorySummary[key])
    .filter(item => item.value > 0);

  const topSpentCategories = [...pieChartData]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const highestTopValue = topSpentCategories[0]?.value || 1;

  // 3. PERSISTING SIMULATED SCENARIOS
  const handleSaveScenario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scenarioName.trim()) return;

    // Package modifications array
    const adjustments = [
      ...sandboxReceitas.map(r => ({ tipo_acao: 'adicionar', tabela: 'receitas', dados_novos: r })),
      ...sandboxDespesas.map(d => ({ tipo_acao: 'adicionar', tabela: 'despesas_fixas', dados_novos: d })),
      ...sandboxParcelamentos.map(p => ({ tipo_acao: 'adicionar', tabela: 'parcelamentos', dados_novos: p }))
    ];

    DatabaseService.createProjecao(user.id, scenarioName.trim(), selectedMonth, adjustments);
    setScenarioName('');
    
    // Refresh list
    setSavedProjections(DatabaseService.getProjecoes(user.id));
    showToast('Projeção / Cenário salvo com sucesso!');
  };

  const handleDeleteScenario = (id: string) => {
    if (!window.confirm('Deletar este cenário salvo?')) return;
    DatabaseService.deleteProjecao(id);
    setSavedProjections(DatabaseService.getProjecoes(user.id));
    showToast('Cenário removido.');
  };

  const handleLoadScenario = (proj: Projecao) => {
    // Reconstruct sandbox state from saved adjustment arrays
    const recs: Receita[] = [];
    const dfs: DespesaFixa[] = [];
    const parcs: Parcelamento[] = [];

    proj.ajustes.forEach((adj: any) => {
      if (adj.tabela === 'receitas') recs.push(adj.dados_novos);
      else if (adj.tabela === 'despesas_fixas') dfs.push(adj.dados_novos);
      else if (adj.tabela === 'parcelamentos') parcs.push(adj.dados_novos);
    });

    setSandboxReceitas(recs);
    setSandboxDespesas(dfs);
    setSandboxParcelamentos(parcs);
    setSelectedMonth(proj.mes_referencia);
    showToast(`Carregou cenário: "${proj.nome}"`);
  };

  const formatRangeShort = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${day}/${months[d.getMonth()]}`;
  };
  const { start, end } = getFinancialMonthRange(selectedMonth, user.closing_day);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Toast notifications */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-4 right-4 z-50 bg-[#06A77D] text-white border border-[#078866] text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2"
          >
            <LucideIcon name="Check" size={14} />
            <span>{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OPERATIONS SIMULATOR GATES COLS (60%) */}
      <div className="lg:col-span-3 space-y-6">
        <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2E3C51]/30 pb-4 mb-6">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#8A95A5] flex items-center gap-1.5">
                <LucideIcon name="Sparkles" className="text-[#C9A84C]" size={16} />
                Cenários Dinâmicos & Projeções
              </h2>
              <p className="text-[10px] text-[#C9A84C] font-mono mt-0.5">
                Mapeamento do fluxo: {formatRangeShort(start)} a {formatRangeShort(end)}
              </p>
            </div>

            <div className="flex items-center gap-2 bg-[#0F1419] p-1.5 rounded-xl border border-[#2E3C51]/70">
              <span className="text-xs text-[#8A95A5] pl-2 pr-1 font-medium select-none">Mês Alvo:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-[#1A2332] border border-[#2E3C51] text-xs font-mono text-[#F5F5F7] rounded-lg px-2.5 py-1 focus:outline-none focus:ring-0 cursor-pointer text-left focus:border-[#C9A84C]"
              >
                {monthOptions.map(opt => {
                  const [y, m] = opt.split('-');
                  const monthsName = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                  return <option key={opt} value={opt}>{monthsName[parseInt(m, 10) - 1]}/{y}</option>;
                })}
              </select>
            </div>
          </div>

          <p className="text-[#8A95A5] text-xs leading-relaxed mb-4">
            Modifique, exclua ou planeje novas receitas e despesas livremente nesta área. As alterações são aplicadas **apenas nesta projeção**, fornecendo previsões sem interferir nas suas contas atuais.
          </p>

          {/* Quick interactive sandbox buttons */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={() => {
                setAddingType(addingType === 'rec' ? null : 'rec');
                setCatInput(categories.find(c => c.tipo === 'receita')?.id || '');
              }}
              className={`text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 font-medium transition border cursor-pointer ${
                addingType === 'rec' ? 'bg-[#06A77D] text-white border-[#06A77D]' : 'bg-[#0F1419] text-[#06A77D] border-[#06A77D]/30 hover:border-[#06A77D]/60'
              }`}
            >
              <LucideIcon name="Plus" size={14} /> + Receita Simulada
            </button>
            <button
              onClick={() => {
                setAddingType(addingType === 'df' ? null : 'df');
                setCatInput(categories.find(c => c.tipo === 'despesa')?.id || '');
              }}
              className={`text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 font-medium transition border cursor-pointer ${
                addingType === 'df' ? 'bg-[#E63946] text-white border-[#E63946]' : 'bg-[#0F1419] text-[#E63946] border-[#E63946]/30 hover:border-[#E63946]/60'
              }`}
            >
              <LucideIcon name="Plus" size={14} /> + Despesa Simulada
            </button>
            <button
              onClick={() => {
                setAddingType(addingType === 'parc' ? null : 'parc');
                setCatInput(categories.find(c => c.tipo === 'despesa')?.id || '');
              }}
              className={`text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 font-medium transition border cursor-pointer ${
                addingType === 'parc' ? 'bg-[#C9A84C] text-[#0F1419] border-[#C9A84C]' : 'bg-[#0F1419] text-[#C9A84C] border-[#C9A84C]/30 hover:border-[#C9A84C]/60'
              }`}
            >
              <LucideIcon name="Plus" size={14} /> + Parcelamento Simulado
            </button>
          </div>

          {/* Quick inputs for the interactive sandbox adds */}
          {addingType && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              onSubmit={handleAddSandboxItem}
              className="mt-4 p-4 bg-[#0F1419] border border-[#2E3C51] rounded-xl space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  placeholder="Nome do item"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="bg-[#1A2332] border border-[#2E3C51] rounded-lg p-2.5 text-xs text-white"
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="R$ Valor"
                  value={valInput}
                  onChange={(e) => setValInput(e.target.value)}
                  className="bg-[#1A2332] border border-[#2E3C51] rounded-lg p-2.5 text-xs text-white font-mono"
                  required
                />
                <select
                  value={catInput}
                  onChange={(e) => setCatInput(e.target.value)}
                  className="bg-[#1A2332] border border-[#2E3C51] rounded-lg p-2.5 text-xs text-white cursor-pointer"
                  required
                >
                  {categories.filter(c => c.tipo === (addingType === 'rec' ? 'receita' : 'despesa')).map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setAddingType(null)}
                  className="px-3 py-1.5 rounded bg-[#2E3C51] text-[#8A95A5] hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-[#C9A84C] text-[#0F1419] font-semibold hover:bg-[#B0923E] cursor-pointer"
                >
                  Incluir na Simulação
                </button>
              </div>
            </motion.form>
          )}
        </div>

        {/* CLONED IN-SANDBOX ELEMENTS LEDGER */}
        <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6 space-y-6">
          {/* Sandbox Recipes */}
          <div>
            <h3 className="text-xs font-bold uppercase text-[#06A77D] tracking-wider pb-2 border-b border-[#2E3C51]/20 mb-3 flex items-center gap-1">
              <LucideIcon name="TrendingUp" size={14} /> receitas simuladas ({sandboxReceitas.length})
            </h3>
            <div className="space-y-1.5">
              {sandboxReceitas.map(r => (
                <div key={r.id} className="flex justify-between items-center p-2.5 bg-[#0F1419]/60 border border-[#2E3C51]/40 rounded-xl text-xs">
                  <span className="text-[#F5F5F7] font-medium">{r.nome}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[#06A77D] font-bold">{formatCurrency(r.valor)}</span>
                    <button
                      onClick={() => handleRemoveSandboxItem(r.id, 'rec')}
                      className="text-[#E63946] opacity-75 hover:opacity-100 transition cursor-pointer"
                    >
                      <LucideIcon name="Trash2" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sandbox Fixed Cost */}
          <div>
            <h3 className="text-xs font-bold uppercase text-[#E63946] tracking-wider pb-2 border-b border-[#2E3C51]/20 mb-3 flex items-center gap-1">
              <LucideIcon name="HeartPulse" size={14} /> despesas fixas simuladas ({sandboxDespesas.length})
            </h3>
            <div className="space-y-1.5">
              {sandboxDespesas.map(d => (
                <div key={d.id} className="flex justify-between items-center p-2.5 bg-[#0F1419]/60 border border-[#2E3C51]/40 rounded-xl text-xs">
                  <div>
                    <span className="text-[#F5F5F7] font-medium">{d.nome}</span>
                    <span className="text-[9px] text-[#8A95A5] font-mono block uppercase">Vencimento: dia {d.dia_vencimento} • {d.forma_pagamento}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[#E63946] font-bold">{formatCurrency(d.valor)}</span>
                    <button
                      onClick={() => handleRemoveSandboxItem(d.id, 'df')}
                      className="text-[#E63946] opacity-75 hover:opacity-100 transition cursor-pointer"
                    >
                      <LucideIcon name="Trash2" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sandbox Installments */}
          <div>
            <h3 className="text-xs font-bold uppercase text-[#C9A84C] tracking-wider pb-2 border-b border-[#2E3C51]/20 mb-3 flex items-center gap-1">
              <LucideIcon name="CreditCard" size={14} /> parcelados & assinaturas simulados ({sandboxParcelamentos.length})
            </h3>
            <div className="space-y-1.5">
              {sandboxParcelamentos.map(p => (
                <div key={p.id} className="flex justify-between items-center p-2.5 bg-[#0F1419]/60 border border-[#2E3C51]/40 rounded-xl text-xs">
                  <div>
                    <span className="text-[#F5F5F7] font-medium">{p.nome}</span>
                    <span className="text-[9px] text-[#8A95A5] font-mono block uppercase">Cobrança: dia {p.dia_cobranca} • {p.forma_pagamento}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[#E63946] font-bold">{formatCurrency(p.valor_parcela)}</span>
                    <button
                      onClick={() => handleRemoveSandboxItem(p.id, 'parc')}
                      className="text-[#E63946] opacity-75 hover:opacity-100 transition cursor-pointer"
                    >
                      <LucideIcon name="Trash2" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SAVING SCENARIO FORM */}
        <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6">
          <h3 className="text-sm font-bold text-[#F5F5F7] pb-3 border-b border-[#2E3C51]/30 mb-4 flex items-center gap-1.5">
            <LucideIcon name="Save" className="text-[#C9A84C]" size={16} /> Salvar Cenário de Simulação
          </h3>
          <form onSubmit={handleSaveScenario} className="flex gap-2.5">
            <input
              type="text"
              placeholder="Ex: Cenário pós-saída da Academia ou Promoção"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="flex-grow bg-[#0F1419] border border-[#2E3C51] rounded-xl text-xs px-4 py-3 text-white focus:outline-none focus:border-[#C9A84C]"
              required
            />
            <button
              type="submit"
              className="bg-[#C9A84C] hover:bg-[#B0923E] text-[#0F1419] font-bold text-xs px-5 rounded-xl transition cursor-pointer"
            >
              Salvar Cenário
            </button>
          </form>
        </div>

        {/* PRESERVED HISTORIC SCENARIOS LEDGER */}
        <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-[#F5F5F7] pb-3 border-b border-[#2E3C51]/30 mb-4 flex items-center gap-2">
            <LucideIcon name="BookOpen" className="text-[#C9A84C]" size={16} />
            Cenários Salvos Comparativos
          </h3>

          {savedProjections.length === 0 ? (
            <p className="text-xs text-[#8A95A5] text-center py-4">Nenhum cenário salvo ainda.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedProjections.map(proj => (
                <div
                  key={proj.id}
                  onClick={() => handleLoadScenario(proj)}
                  className="bg-[#0F1419] border border-[#2E3C51] hover:border-[#C9A84C] p-4 rounded-xl flex flex-col justify-between cursor-pointer transition select-none group"
                >
                  <div className="space-y-1 text-left">
                    <h4 className="text-xs font-bold text-[#F5F5F7] group-hover:text-[#C9A84C] transition">{proj.nome}</h4>
                    <p className="text-[10px] text-[#8A95A5] font-mono uppercase">Mês alvo: {proj.mes_referencia}</p>
                    <p className="text-[10px] text-[#C9A84C] mt-1 italic font-medium">Contém {proj.ajustes.length} lançamentos simulados</p>
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-[#8A95A5]/60 pt-3 border-t border-[#2E3C51]/20 mt-4">
                    <span>Criado: {formatDate(proj.created_at)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteScenario(proj.id);
                      }}
                      className="text-[#E63946] hover:underline cursor-pointer font-semibold"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FORECAST COMPLETED COLS RECHARTS VIEWER (40%) */}
      <div className="lg:col-span-2 space-y-6">
        {/* RESUME SUM CABINET */}
        <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6 space-y-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8A95A5] pb-3 border-b border-[#2E3C51]/30">
            Previsão do Fluxo Simulado
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0F1419] p-3.5 border border-[#2E3C51]/50 rounded-xl">
              <span className="text-[10px] text-[#8A95A5] block">Total Receita Simulada</span>
              <span className="text-sm font-mono font-bold text-[#06A77D] mt-1 block">
                {formatCurrency(stats.totalReceitasPrevistas)}
              </span>
            </div>
            <div className="bg-[#0F1419] p-3.5 border border-[#2E3C51]/50 rounded-xl">
              <span className="text-[10px] text-[#8A95A5] block">Total Despesa Simulada</span>
              <span className="text-sm font-mono font-bold text-[#E63946] mt-1 block">
                {formatCurrency(stats.totalDespesasFixasPrevistas + stats.totalParcelasPrevistas)}
              </span>
            </div>
          </div>

          <div className="bg-[#0F1419] p-4 border border-[#2E3C51]/60 rounded-xl">
            <span className="text-[10px] text-[#8A95A5] block">Balanço Final Previsto</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className={`text-lg font-mono font-bold ${stats.saldoPrevistoFimMes >= 0 ? 'text-[#06A77D]' : 'text-[#E63946]'}`}>
                {formatCurrency(stats.saldoPrevistoFimMes)}
              </span>
              <span className={`text-[9px] font-semibold uppercase px-2 py-0.5 rounded ${automEval.type === 'success' ? 'bg-[#06A77D]/10 text-[#06A77D]' : 'bg-[#E63946]/10 text-[#E63946]'}`}>
                {automEval.title}
              </span>
            </div>
          </div>

          {/* Autom evaluation */}
          <div className="bg-[#101724] border border-[#2E3C51] p-4 rounded-xl space-y-1.5 text-left">
            <h4 className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Avaliação da Simulação</h4>
            <p className="text-xs text-[#8A95A5] leading-relaxed">
              {automEval.desc}
            </p>
          </div>
        </div>

        {/* PIE DISTRIBUTION FOR SIMULATED STATE */}
        <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8A95A5] pb-3 border-b border-[#2E3C51]/30 mb-4">
            Previsão Distribuição pizza
          </h3>

          {pieChartData.length === 0 ? (
            <p className="text-xs text-[#8A95A5] text-center py-8">Sem despesas ou parcelamentos incluídos na simulação.</p>
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
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                    <span className="truncate">{e.name}:</span>
                    <span className="font-mono text-[#F5F5F7] text-left">{formatCurrency(e.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* TOP SPECIFIC BRACKETEER SIM */}
        <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8A95A5] pb-3 border-b border-[#2E3C51]/30 mb-4">
            Top 5 Gastos na Simulação
          </h3>

          {topSpentCategories.length === 0 ? (
            <p className="text-xs text-[#8A95A5] text-center py-4">Nenhuma despesa simulada.</p>
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
                        className="h-full rounded-full"
                        style={{ width: `${percentage}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
