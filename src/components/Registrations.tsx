/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, Receita, DespesaFixa, Parcelamento, Transacao, Categoria } from '../types';
import { DatabaseService, generateId } from '../utils/db';
import { formatCurrency, formatDate, getFinancialMonthOptions } from '../utils/finance';
import LucideIcon from './LucideIcon';
import { motion, AnimatePresence } from 'motion/react';

interface RegistrationsProps {
  user: User;
}

type RegistrationTab = 'transacoes' | 'receitas' | 'despesas' | 'parcelamentos';

export default function Registrations({ user }: RegistrationsProps) {
  const [activeTab, setActiveTab] = useState<RegistrationTab>('transacoes');
  
  // Queries & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const monthOptions = getFinancialMonthOptions(user.closing_day);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('all');

  // Core Data States
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [despesas, setDespesas] = useState<DespesaFixa[]>([]);
  const [parcelamentos, setParcelamentos] = useState<Parcelamento[]>([]);

  // Editing Modals
  const [editingItem, setEditingItem] = useState<{ type: RegistrationTab; data: any } | null>(null);
  const [toastText, setToastText] = useState('');

  const loadData = () => {
    setCategories(DatabaseService.getCategories(user.id));
    setTransacoes(DatabaseService.getTransacoes(user.id));
    setReceitas(DatabaseService.getReceitas(user.id));
    setDespesas(DatabaseService.getDespesasFixas(user.id));
    setParcelamentos(DatabaseService.getParcelamentos(user.id));
  };

  useEffect(() => {
    loadData();
  }, [user.id]);

  const triggerToast = (msg: string) => {
    setToastText(msg);
    setTimeout(() => setToastText(''), 3000);
  };

  // 1. BACKUP JSON IMPORTS & EXPORTS
  const handleExportBackup = () => {
    const backupData = DatabaseService.exportData();
    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `gestao-financeira-backup-${user.email}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast('Backup exportado com sucesso!');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonString = event.target?.result as string;
        const success = DatabaseService.importData(jsonString);
        if (success) {
          loadData();
          triggerToast('Backup importado e atualizado!');
        } else {
          alert('Não foi possível processar todos os dados do backup. Verifique se o formato está correto.');
        }
      } catch (err) {
        alert('Erro ao processar arquivo JSON de backup.');
      }
    };
    reader.readAsText(file);
  };

  // Tab Filtering & Query Searches
  const queryFilter = (item: any) => {
    const matchSearch = item.nome.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchCategory = selectedCategory === 'all' || item.categoria_id === selectedCategory;
    
    let matchMonth = true;
    if (selectedMonthFilter !== 'all') {
      // If filtering variables / transactions
      if (item.data) {
        const itemDate = new Date(item.data);
        const closingDay = user.closing_day;
        const [yStr, mStr] = selectedMonthFilter.split('-');
        const filterY = parseInt(yStr, 10);
        const filterM = parseInt(mStr, 10);
        
        // Derive boundary period for this transaction's date
        // Simple month matching
        const monthNum = itemDate.getMonth() + 1;
        const yearNum = itemDate.getFullYear();
        matchMonth = (monthNum === filterM && yearNum === filterY);
      }
    }

    return matchSearch && matchCategory && matchMonth;
  };

  // Items lists
  const filteredTransacoes = transacoes.filter(queryFilter);
  const filteredReceitas = receitas.filter(queryFilter);
  const filteredDespesas = despesas.filter(queryFilter);
  const filteredParcelamentos = parcelamentos.filter(queryFilter);

  // General Deletes
  const handleDeleteItem = (id: string, tab: RegistrationTab) => {
    if (!window.confirm('Tem certeza de que deseja permanentemente excluir este registro?')) return;
    
    if (tab === 'transacoes') DatabaseService.deleteTransacao(id);
    else if (tab === 'receitas') DatabaseService.deleteReceita(id);
    else if (tab === 'despesas') DatabaseService.deleteDespesaFixa(id);
    else if (tab === 'parcelamentos') DatabaseService.deleteParcelamento(id);

    loadData();
    triggerToast('Lançamento removido permanentemente.');
  };

  // Edit forms triggered double clicks
  const handleEditInit = (item: any, type: RegistrationTab) => {
    setEditingItem({ type, data: { ...item } });
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const { type, data } = editingItem;
    const val = parseFloat(data.valor_parcela || data.valor);

    if (isNaN(val) || val <= 0) {
      alert('Por favor insira um valor numérico positivo.');
      return;
    }

    if (type === 'transacoes') {
      DatabaseService.updateTransacao(data.id, {
        nome: data.nome,
        valor: val,
        categoria_id: data.categoria_id,
        forma_pagamento: data.forma_pagamento,
        data: data.data,
        observacao: data.observacao
      });
    } else if (type === 'receitas') {
      DatabaseService.updateReceita(data.id, {
        nome: data.nome,
        valor: val,
        categoria_id: data.categoria_id,
        recorrente: data.recorrente,
        dia_recebimento: parseInt(data.dia_recebimento, 10) || 5
      });
    } else if (type === 'despesas') {
      DatabaseService.updateDespesaFixa(data.id, {
        nome: data.nome,
        valor: val,
        categoria_id: data.categoria_id,
        dia_vencimento: parseInt(data.dia_vencimento, 10) || 10,
        forma_pagamento: data.forma_pagamento,
        observacao: data.observacao
      });
    } else if (type === 'parcelamentos') {
      DatabaseService.updateParcelamento(data.id, {
        nome: data.nome,
        valor_parcela: val,
        categoria_id: data.categoria_id,
        forma_pagamento: data.forma_pagamento,
        dia_cobranca: parseInt(data.dia_cobranca, 10) || 5,
        observacao: data.observacao
      });
    }

    loadData();
    setEditingItem(null);
    triggerToast('Registro atualizado!');
  };

  return (
    <div className="space-y-6">
      {/* Toast notifies */}
      <AnimatePresence>
        {toastText && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-4 right-4 z-50 bg-[#C9A84C] text-[#0F1419] border border-[#B0923E] text-xs font-bold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2"
          >
            <LucideIcon name="Check" size={14} />
            <span>{toastText}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2E3C51]/30 pb-4 mb-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="p-1 px-1.5 bg-[#C9A84C]/10 text-[#C9A84C] rounded border border-[#C9A84C]/25"><LucideIcon name="Table" size={14} /></span>
              Cadastro e Conciliação Geral
            </h2>
            <p className="text-xs text-[#8A95A5] mt-1">
              Visualize, filtre e gerencie detalhadamente todos os seus dados e realize backups periódicos.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {/* Backup export actionable button */}
            <button
              onClick={handleExportBackup}
              className="bg-[#0F1419] hover:bg-[#151D26] border border-[#2E3C51] text-[#F5F5F7] text-xs font-semibold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <LucideIcon name="Download" size={14} /> Exportar Backup JSON
            </button>

            {/* Backup import styled trigger */}
            <label className="bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/20 text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer">
              <LucideIcon name="Upload" size={14} /> Importar Backup
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* SEARCH AND ADVANCED FILTERS BLOCK */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-[#0F1419] p-4 rounded-xl border border-[#2E3C51]/40 mb-6 col-span-full">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#8A95A5] mb-1.5">Buscar por Nome</label>
            <input
              type="text"
              placeholder="Digite o lançamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#1A2332] border border-[#2E3C51] text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#C9A84C]"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#8A95A5] mb-1.5">Filtrar Categoria</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-[#1A2332] border border-[#2E3C51] text-xs text-white rounded-lg p-2.5 cursor-pointer focus:outline-none focus:border-[#C9A84C]"
            >
              <option value="all">Todas as Categorias</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nome} ({cat.tipo === 'receita' ? 'Receita' : 'Despesa'})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#8A95A5] mb-1.5">Mês Civil Lançamento</label>
            <select
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(e.target.value)}
              className="w-full bg-[#1A2332] border border-[#2E3C51] text-xs text-white rounded-lg p-2.5 cursor-pointer focus:outline-none focus:border-[#C9A84C]"
            >
              <option value="all">Mais Recentes</option>
              {monthOptions.map(opt => {
                const [y, m] = opt.split('-');
                return <option key={opt} value={opt}>{m}/{y}</option>;
              })}
            </select>
          </div>

          <div className="flex items-end text-xs text-[#8A95A5] leading-relaxed select-none pl-1 pb-1">
            Dica: Dê um duplo clique em qualquer linha para editar ou deletar rapidamente.
          </div>
        </div>

        {/* LEDGERS TABS */}
        <div className="flex border-b border-[#2E3C51]/30 mb-6 overflow-x-auto gap-1">
          {[
            { id: 'transacoes', label: 'Gastos Dia a Dia', color: '#F4A261' },
            { id: 'receitas', label: 'Receitas', color: '#06A77D' },
            { id: 'despesas', label: 'Despesas Fixas', color: '#E63946' },
            { id: 'parcelamentos', label: 'Parcelas e Assinaturas', color: '#C9A84C' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as RegistrationTab)}
              className={`px-4 py-3 text-xs font-semibold border-b-2 transition shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'border-[#C9A84C] text-[#C9A84C] bg-[#C9A84C]/5'
                  : 'border-transparent text-[#8A95A5] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TABULAR REGISTERS RENDERS */}
        <div>
          {/* TRANSACOES VARIABLE EXPENDITURE */}
          {activeTab === 'transacoes' && (
            <div className="overflow-x-auto border border-[#2E3C51]/40 rounded-xl">
              <table className="w-full text-left text-xs text-[#8A95A5]">
                <thead className="bg-[#0F1419] text-[#F5F5F7] font-semibold border-b border-[#2E3C51]/30">
                  <tr>
                    <th className="p-4">Nome do Gasto</th>
                    <th className="p-4">Valor</th>
                    <th className="p-4">Categoria</th>
                    <th className="p-4">Pagamento</th>
                    <th className="p-4">Data Lançamento</th>
                    <th className="p-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2E3C51]/20">
                  {filteredTransacoes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs text-[#8A95A5]/60">Nenhum gasto diário localizado com estes termos.</td>
                    </tr>
                  ) : (
                    filteredTransacoes.map(item => {
                      const cat = categories.find(c => c.id === item.categoria_id);
                      return (
                        <tr
                          key={item.id}
                          onDoubleClick={() => handleEditInit(item, 'transacoes')}
                          className="hover:bg-[#0F1419]/40 cursor-pointer transition select-none"
                        >
                          <td className="p-4 font-medium text-[#F5F5F7]">{item.nome}</td>
                          <td className="p-4 font-mono font-bold text-[#E63946]">{formatCurrency(item.valor)}</td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: `${cat?.cor}15`, color: cat?.cor }}>
                              {cat?.nome || 'Outros'}
                            </span>
                          </td>
                          <td className="p-4 font-mono uppercase text-[10px]">{item.forma_pagamento}</td>
                          <td className="p-4 font-mono text-[11px]">{formatDate(item.data)}</td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleDeleteItem(item.id, 'transacoes')}
                              className="text-[#E63946] hover:text-[#C5303C] transition p-1 cursor-pointer"
                            >
                              <LucideIcon name="Trash2" size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* RECEITAS */}
          {activeTab === 'receitas' && (
            <div className="overflow-x-auto border border-[#2E3C51]/40 rounded-xl">
              <table className="w-full text-left text-xs text-[#8A95A5]">
                <thead className="bg-[#0F1419] text-[#F5F5F7] font-semibold border-b border-[#2E3C51]/30">
                  <tr>
                    <th className="p-4">Receita</th>
                    <th className="p-4">Valor Estimado</th>
                    <th className="p-4">Categoria</th>
                    <th className="p-4">Dia Recebimento</th>
                    <th className="p-4">Periodicidade</th>
                    <th className="p-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2E3C51]/20">
                  {filteredReceitas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs text-[#8A95A5]/60">Nenhuma receita localizada com estes filtros.</td>
                    </tr>
                  ) : (
                    filteredReceitas.map(item => {
                      const cat = categories.find(c => c.id === item.categoria_id);
                      return (
                        <tr
                          key={item.id}
                          onDoubleClick={() => handleEditInit(item, 'receitas')}
                          className="hover:bg-[#0F1419]/40 cursor-pointer transition select-none"
                        >
                          <td className="p-4 font-medium text-[#F5F5F7]">{item.nome}</td>
                          <td className="p-4 font-mono font-bold text-[#06A77D]">{formatCurrency(item.valor)}</td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#06A77D]/10 text-[#06A77D]">
                              {cat?.nome || 'Salário'}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-[11px]">Dia {item.dia_recebimento || user.closing_day}</td>
                          <td className="p-4">
                            <span className="text-[10px] uppercase font-bold text-[#8A95A5] bg-[#2E3C51] rounded px-1.5 py-0.5">
                              {item.recorrente ? 'Recorrente Mensal' : 'Esporádico'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleDeleteItem(item.id, 'receitas')}
                              className="text-[#E63946] hover:text-[#C5303C] transition p-1 cursor-pointer"
                            >
                              <LucideIcon name="Trash2" size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* DESPESAS FIXAS */}
          {activeTab === 'despesas' && (
            <div className="overflow-x-auto border border-[#2E3C51]/40 rounded-xl">
              <table className="w-full text-left text-xs text-[#8A95A5]">
                <thead className="bg-[#0F1419] text-[#F5F5F7] font-semibold border-b border-[#2E3C51]/30">
                  <tr>
                    <th className="p-4">Despesa Fixa</th>
                    <th className="p-4">Valor Mensal</th>
                    <th className="p-4">Categoria</th>
                    <th className="p-4">Dia Vencimento</th>
                    <th className="p-4">Forma Pagamento</th>
                    <th className="p-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2E3C51]/20">
                  {filteredDespesas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs text-[#8A95A5]/60">Nenhuma despesa fixa listada para estes filtros.</td>
                    </tr>
                  ) : (
                    filteredDespesas.map(item => {
                      const cat = categories.find(c => c.id === item.categoria_id);
                      return (
                        <tr
                          key={item.id}
                          onDoubleClick={() => handleEditInit(item, 'despesas')}
                          className="hover:bg-[#0F1419]/40 cursor-pointer transition select-none"
                        >
                          <td className="p-4 font-medium text-[#F5F5F7]">{item.nome}</td>
                          <td className="p-4 font-mono font-bold text-[#E63946]">{formatCurrency(item.valor)}</td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#E63946]/10 text-[#E63946]">
                              {cat?.nome || 'Gastos Fixos'}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-[11px]">Dia {item.dia_vencimento}</td>
                          <td className="p-4 font-mono uppercase text-[10px]">{item.forma_pagamento}</td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleDeleteItem(item.id, 'despesas')}
                              className="text-[#E63946] hover:text-[#C5303C] transition p-1 cursor-pointer"
                            >
                              <LucideIcon name="Trash2" size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* PARCELAMENTOS */}
          {activeTab === 'parcelamentos' && (
            <div className="overflow-x-auto border border-[#2E3C51]/40 rounded-xl">
              <table className="w-full text-left text-xs text-[#8A95A5]">
                <thead className="bg-[#0F1419] text-[#F5F5F7] font-semibold border-b border-[#2E3C51]/30">
                  <tr>
                    <th className="p-4">Parcelamento</th>
                    <th className="p-4">Valor Cobrança</th>
                    <th className="p-4">Categoria</th>
                    <th className="p-4">Dia Cobrança</th>
                    <th className="p-4">Periodicidade / Total</th>
                    <th className="p-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2E3C51]/20">
                  {filteredParcelamentos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs text-[#8A95A5]/60">Nenhum parcelamento ativo com estes filtros.</td>
                    </tr>
                  ) : (
                    filteredParcelamentos.map(item => {
                      const cat = categories.find(c => c.id === item.categoria_id);
                      return (
                        <tr
                          key={item.id}
                          onDoubleClick={() => handleEditInit(item, 'parcelamentos')}
                          className="hover:bg-[#0F1419]/40 cursor-pointer transition select-none"
                        >
                          <td className="p-4 font-medium text-[#F5F5F7]">{item.nome}</td>
                          <td className="p-4 font-mono font-bold text-[#E63946]">{formatCurrency(item.valor_parcela)}</td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#C9A84C]/10 text-[#C9A84C]">
                              {cat?.nome || 'Eletroportáteis'}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-[11px]">Dia {item.dia_cobranca}</td>
                          <td className="p-4 font-mono text-[10px] uppercase">
                            {item.tipo === 'assinatura' ? 'Assinatura Recorrente' : `${item.total_parcelas} parcelas`}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleDeleteItem(item.id, 'parcelamentos')}
                              className="text-[#E63946] hover:text-[#C5303C] transition p-1 cursor-pointer"
                            >
                              <LucideIcon name="Trash2" size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* DOUBLE CLICK POPUP EDITING MODAL */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 bg-[#0F1419]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A2332] border border-[#2E3C51] w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl text-left"
            >
              <div className="flex justify-between items-center border-b border-[#2E3C51]/30 pb-3">
                <h4 className="text-sm font-bold text-[#FDFDFD] flex items-center gap-2">
                  <LucideIcon name="Edit" className="text-[#C9A84C]" />
                  Editar Registro Completo
                </h4>
                <button onClick={() => setEditingItem(null)} className="text-[#8A95A5] hover:text-white cursor-pointer">
                  <LucideIcon name="X" size={18} />
                </button>
              </div>

              <form onSubmit={handleEditSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Título / Nome</label>
                  <input
                    type="text"
                    className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-white"
                    value={editingItem.data.nome}
                    onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, nome: e.target.value } })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">
                      {editingItem.type === 'parcelamentos' ? 'Parcela' : 'Valor Total'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-white font-mono"
                      value={editingItem.type === 'parcelamentos' ? editingItem.data.valor_parcela : editingItem.data.valor}
                      onChange={(e) => setEditingItem({
                        ...editingItem,
                        data: {
                          ...editingItem.data,
                          [editingItem.type === 'parcelamentos' ? 'valor_parcela' : 'valor']: e.target.value
                        }
                      })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Categoria</label>
                    <select
                      className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-white cursor-pointer"
                      value={editingItem.data.categoria_id}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, categoria_id: e.target.value } })}
                      required
                    >
                      {categories.filter(c => c.tipo === (editingItem.type === 'receitas' ? 'receita' : 'despesa')).map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {editingItem.type === 'transacoes' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Data Gasto</label>
                      <input
                        type="date"
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-white font-mono"
                        value={editingItem.data.data}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, data: e.target.value } })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Forma Pagamento</label>
                      <select
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-white"
                        value={editingItem.data.forma_pagamento}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, forma_pagamento: e.target.value } })}
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

                {editingItem.type === 'receitas' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Dia Recebimento</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-white"
                        value={editingItem.data.dia_recebimento || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, dia_recebimento: e.target.value } })}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <input
                        type="checkbox"
                        checked={editingItem.data.recorrente}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, recorrente: e.target.checked } })}
                        className="w-4 h-4 rounded text-[#C9A84C]"
                      />
                      <label className="text-xs text-[#8A95A5]">Recorrente?</label>
                    </div>
                  </div>
                )}

                {editingItem.type === 'despesas' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Dia Vencimento</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-white"
                        value={editingItem.data.dia_vencimento}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, dia_vencimento: e.target.value } })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Forma Pagamento</label>
                      <select
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-white"
                        value={editingItem.data.forma_pagamento}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, forma_pagamento: e.target.value } })}
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

                {editingItem.type === 'parcelamentos' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Dia Cobrança</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-white"
                        value={editingItem.data.dia_cobranca}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, dia_cobranca: e.target.value } })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Forma Pagamento</label>
                      <select
                        className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-white"
                        value={editingItem.data.forma_pagamento}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, forma_pagamento: e.target.value } })}
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

                {(editingItem.type === 'transacoes' || editingItem.type === 'despesas' || editingItem.type === 'parcelamentos') && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">Observações</label>
                    <input
                      type="text"
                      className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-white"
                      value={editingItem.data.observacao || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, observacao: e.target.value } })}
                    />
                  </div>
                )}

                <div className="pt-4 border-t border-[#2E3C51]/30 flex justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteItem(editingItem.data.id, editingItem.type);
                      setEditingItem(null);
                    }}
                    className="p-2.5 font-semibold text-xs text-[#E63946] hover:bg-[#E63946]/5 rounded-xl border border-[#E63946]/30 px-5 transition cursor-pointer"
                  >
                    Remover permanentemente
                  </button>
                  <button
                    type="submit"
                    className="bg-[#C9A84C] hover:bg-[#B0923E] py-2.5 px-6 rounded-xl font-bold text-xs text-[#0F1419] transition cursor-pointer"
                  >
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
