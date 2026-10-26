/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, Categoria } from '../types';
import { DatabaseService } from '../utils/db';
import { formatCurrency } from '../utils/finance';
import LucideIcon from './LucideIcon';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsProps {
  user: User;
  onUpdateUser: (updatedUser: User) => void;
  onSignOut: () => void;
}

export default function Settings({ user, onUpdateUser, onSignOut }: SettingsProps) {
  // Account cycle settings
  const [closingDay, setClosingDay] = useState(user.closing_day || 5);
  const [cardLimit, setCardLimit] = useState(user.card_limit || 5000);

  // Categories addition States
  const [customCategories, setCustomCategories] = useState<Categoria[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatCor, setNewCatCor] = useState('#7209B7');
  const [newCatIcon, setNewCatIcon] = useState('Tag');
  const [newCatTipo, setNewCatTipo] = useState<'despesa' | 'receita'>('despesa');

  // Redefine data states
  const [confirmInput, setConfirmInput] = useState('');
  const [isResetOpen, setIsResetOpen] = useState(false);

  // Toast notifier
  const [toastText, setToastText] = useState('');

  const loadCategories = () => {
    setCustomCategories(DatabaseService.getCategories(user.id));
  };

  useEffect(() => {
    loadCategories();
  }, [user.id]);

  const triggerToast = (msg: string) => {
    setToastText(msg);
    setTimeout(() => setToastText(''), 3000);
  };

  // 1. UPDATE CYCLE CONFIGS
  const handleUpdateCycle = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = DatabaseService.updateUserProfile(user.id, {
      closing_day: Math.min(28, Math.max(1, closingDay)),
      card_limit: Math.max(0, cardLimit)
    });
    onUpdateUser(updated);
    triggerToast('Configurações de ciclo salvas! Todo o calendário financeiro foi recalculado.');
  };

  // 2. ADD CATEGORIES
  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    DatabaseService.createCategory(user.id, {
      nome: newCatName.trim(),
      cor: newCatCor,
      icone: newCatIcon,
      tipo: newCatTipo
    });

    setNewCatName('');
    setNewCatCor('#7209B7');
    setNewCatIcon('Tag');
    loadCategories();
    triggerToast('Categoria criada com sucesso!');
  };

  // 3. DELETE CATEGORY WITH DENSE VERIFICATIONS
  const handleDeleteCategory = (catId: string, name: string) => {
    // Check if category is used in real data
    const isUsed = DatabaseService.checkCategoryUsage(user.id, catId);
    
    if (isUsed) {
      alert(`Bloqueado: A categoria "${name}" possui transações, receitas ou despesas recorrentes ativas. Substitua essas transações por outra categoria antes de removê-la.`);
      return;
    }

    if (window.confirm(`Tem certeza de que deseja remover a categoria "${name}"?`)) {
      DatabaseService.deleteCategory(catId);
      loadCategories();
      triggerToast('Categoria removida.');
    }
  };

  // 4. RESET SYSTEM DATA
  const handleSystemReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmInput.trim().toUpperCase() !== 'REDEFINIR') {
      alert('Código incorreto de confirmação.');
      return;
    }

    DatabaseService.resetUserData(user.id);
    setIsResetOpen(false);
    setConfirmInput('');
    loadCategories();
    
    // Also reset configurations visually
    setClosingDay(5);
    setCardLimit(5000);
    
    // Update active state
    const updated = DatabaseService.getUserById(user.id);
    if (updated) onUpdateUser(updated);

    triggerToast('Todo o seu histórico financeiro foi limpado com sucesso!');
  };

  return (
    <div className="space-y-6">
      {/* Toast notifier banner */}
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* PARAMS ADJUSTMENTS LEFT BOX (60%) */}
        <div className="lg:col-span-3 space-y-6 text-left">
          {/* PROFILE CONTROL CARD */}
          <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white pb-3 border-b border-[#2E3C51]/30 mb-5 flex items-center gap-2">
              <span className="p-1 px-1.5 bg-[#C9A84C]/10 text-[#C9A84C] rounded border border-[#C9A84C]/25"><LucideIcon name="Settings" size={14} /></span>
              Parâmetros Básicos do Mês Financeiro
            </h3>

            <form onSubmit={handleUpdateCycle} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1.5">
                    Fechamento do Cartão (Dia 1 a 28)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={closingDay}
                    onChange={(e) => setClosingDay(parseInt(e.target.value, 10))}
                    className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-3 text-xs text-white font-mono focus:border-[#C9A84C] focus:outline-none"
                    required
                  />
                  <p className="text-[10px] text-[#8A95A5] mt-1 pr-2 leading-relaxed">
                    Ajustar o dia de fechamento moverá os pontos de início dos cálculos de todos os meses de forma dinâmica.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1.5">
                    Limite do Cartão Principal (em R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={cardLimit}
                    onChange={(e) => setCardLimit(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-3 text-xs text-white font-mono focus:border-[#C9A84C] focus:outline-none"
                    required
                  />
                  <p className="text-[10px] text-[#8A95A5] mt-1 pr-2 leading-relaxed">
                    Utilizado para guiar os percentuais de uso e alertar em caso de saturação do limite de crédito.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#2E3C51]/20 flex justify-end">
                <button
                  type="submit"
                  className="bg-[#C9A84C] hover:bg-[#B0923E] text-[#0F1419] text-xs font-bold px-6 py-2.5 rounded-xl transition cursor-pointer"
                >
                  Salvar Mudanças
                </button>
              </div>
            </form>
          </div>

          {/* DANGER ZONE SETTINGS */}
          <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white pb-3 border-b border-[#2E3C51]/30 mb-5 flex items-center gap-2">
              <span className="p-1 px-1.5 bg-[#E63946]/10 text-[#E63946] rounded border border-[#E63946]/25"><LucideIcon name="ShieldAlert" size={14} /></span>
              Zona de Risco e Segurança
            </h3>

            <p className="text-[#8A95A5] text-xs leading-relaxed mb-5">
              Se você deseja reiniciar seu gerenciador para um novo período limpo, use as opções abaixo. O reset desativará ou removerá todas as anotações, despesas e transações cadastradas.
            </p>

            <div className="flex flex-wrap justify-between items-center gap-4 bg-[#0F1419] p-4 border border-[#E63946]/25 rounded-xl">
              <div>
                <h4 className="text-xs font-bold text-[#E63946]">Limpar Historico</h4>
                <p className="text-[10px] text-[#8A95A5] mt-0.5">Apaga todas as despesas lançadas, receitas e notas cadastradas.</p>
              </div>
              <button
                onClick={() => setIsResetOpen(true)}
                className="bg-[#E63946]/10 hover:bg-[#E63946]/20 border border-[#E63946]/45 text-[#E63946] text-xs font-semibold px-4 py-2.5 rounded-xl transition cursor-pointer"
              >
                Limpar Banco de Dados
              </button>
            </div>
          </div>
        </div>

        {/* CATEGORY WORKSPACE RIGHT BOX (40%) */}
        <div className="lg:col-span-2 text-left space-y-6">
          {/* CATEGORY MANAGER CREATES */}
          <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white pb-3 border-b border-[#2E3C51]/30 mb-4 flex items-center gap-2">
              <span className="p-1 px-1.5 bg-[#C9A84C]/10 text-[#C9A84C] rounded border border-[#C9A84C]/25"><LucideIcon name="Tag" size={14} /></span>
              Gerenciador de Categorias
            </h3>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-semibold text-[#8A95A5] mb-1">Nome Categoria</label>
                <input
                  type="text"
                  placeholder="Ex: Assinaturas ou Farmácia"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[#8A95A5] mb-1">Cor</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={newCatCor}
                      onChange={(e) => setNewCatCor(e.target.value)}
                      className="w-10 h-10 p-0 block bg-[#0F1419] border border-[#2E3C51] rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={newCatCor}
                      onChange={(e) => setNewCatCor(e.target.value)}
                      className="w-full font-mono text-center text-xs bg-[#0F1419] border border-[#2E3C51] rounded-xl text-white py-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[#8A95A5] mb-1">Ícone Lucide</label>
                  <select
                    value={newCatIcon}
                    onChange={(e) => setNewCatIcon(e.target.value)}
                    className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-white cursor-pointer"
                  >
                    <option value="Tag">Etiqueta (Tag)</option>
                    <option value="BookOpen">Livro (Study)</option>
                    <option value="Home">Casa (Home)</option>
                    <option value="Car">Carro (Transport)</option>
                    <option value="Coffee">Café (Coffee)</option>
                    <option value="Utensils">Garfo (Alimentação)</option>
                    <option value="Heart">Coração (Saúde)</option>
                    <option value="Tv">TV (Assinaturas)</option>
                    <option value="ShoppingBag">Sacola (Compras)</option>
                    <option value="Coins">Moedas (Geral)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-semibold text-[#8A95A5] mb-1">Finalidade</label>
                <select
                  value={newCatTipo}
                  onChange={(e) => setNewCatTipo(e.target.value as any)}
                  className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl p-2.5 text-xs text-white"
                >
                  <option value="despesa">Despesa (Gasto)</option>
                  <option value="receita">Receita (Entrada)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-[#C9A84C] hover:bg-[#B0923E] text-[#0F1419] py-2.5 rounded-xl font-bold text-xs"
              >
                Cadastrar Categoria
              </button>
            </form>
          </div>

          {/* ACTIVE CATEGORIES GRID */}
          <div className="bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-6">
            <h3 className="text-xs font-bold uppercase text-[#8A95A5] pb-2 border-b border-[#2E3C51]/20 mb-4">
              Categorias Ativas ({customCategories.length})
            </h3>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {customCategories.map(cat => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-2.5 bg-[#0F1419]/75 border border-[#2E3C51]/40 rounded-xl text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="p-1 px-1.5 rounded text-white flex items-center justify-center font-bold"
                      style={{ backgroundColor: `${cat.cor}15`, color: cat.cor }}
                    >
                      <LucideIcon name={cat.icone} size={14} />
                    </div>
                    <div>
                      <span className="text-[#F5F5F7] font-medium">{cat.nome}</span>
                      <span className="text-[10px] font-mono text-[#8A95A5] mt-0.5 block uppercase">
                        {cat.tipo} • {cat.cor}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteCategory(cat.id, cat.nome)}
                    className="text-[#E63946] hover:text-[#C5303C] transition p-1 cursor-pointer"
                  >
                    <LucideIcon name="Trash2" size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* DETAILED DOUBLE-GATE REDEFINE DATA CONFIRMATION POPUP */}
      <AnimatePresence>
        {isResetOpen && (
          <div className="fixed inset-0 bg-[#0F1419]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A2332] border border-[#2E3C51] w-full max-w-sm rounded-2xl p-6 space-y-4 text-left shadow-2xl relative"
            >
              <h4 className="text-base font-bold text-[#E63946] flex items-center gap-2">
                <LucideIcon name="ShieldAlert" />
                Deseja realmente apagar tudo?
              </h4>
              <p className="text-xs text-[#8A95A5] leading-relaxed">
                Essas ações irão remover permanentemente **todas** as notas, contas variáveis, receitas e configurações registradas para seu usuário.
              </p>
              <form onSubmit={handleSystemReset} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-[#E63946] uppercase mb-1">
                    Digite "REDEFINIR" para confirmar
                  </label>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder="REDEFINIR"
                    className="w-full bg-[#0F1419] border border-[#E63946]/40 text-xs font-bold text-white rounded-xl p-2.5 uppercase text-center focus:outline-none focus:border-[#E63946]"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetOpen(false);
                      setConfirmInput('');
                    }}
                    className="px-4 py-2 bg-[#0F1419] border border-[#2E3C51] text-[#8A95A5] rounded-xl font-medium cursor-pointer hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#E63946] hover:bg-[#C5303C] text-white rounded-xl font-bold cursor-pointer"
                  >
                    Sim, Excluir Tudo
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
