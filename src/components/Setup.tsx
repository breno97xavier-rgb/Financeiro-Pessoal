/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, Receita, DespesaFixa, PaymentMethod } from '../types';
import { DatabaseService } from '../utils/db';
import { formatCurrency } from '../utils/finance';
import LucideIcon from './LucideIcon';
import { motion, AnimatePresence } from 'motion/react';

interface SetupProps {
  user: User;
  onOnboardingComplete: (updatedUser: User) => void;
}

export default function Setup({ user, onOnboardingComplete }: SetupProps) {
  const [step, setStep] = useState(1);
  const [closingDay, setClosingDay] = useState(user.closing_day || 5);
  const [cardLimit, setCardLimit] = useState(user.card_limit || 5000);

  // Prefill Lists
  const [initialReceitas, setInitialReceitas] = useState<{ nome: string; valor: number }[]>([]);
  const [initialDespesas, setInitialDespesas] = useState<{ nome: string; valor: number; vencimento: number; fp: PaymentMethod }[]>([]);

  // Inputs for additions list
  const [recNome, setRecNome] = useState('');
  const [recValor, setRecValor] = useState('');
  const [despNome, setDespNome] = useState('');
  const [despValor, setDespValor] = useState('');
  const [despVenc, setDespVenc] = useState('10');
  const [despFP, setDespFP] = useState<PaymentMethod>('pix');

  const addInitialReceita = () => {
    if (!recNome || !recValor) return;
    const val = parseFloat(recValor);
    if (!isNaN(val) && val > 0) {
      setInitialReceitas([...initialReceitas, { nome: recNome, valor: val }]);
      setRecNome('');
      setRecValor('');
    }
  };

  const removeInitialReceita = (idx: number) => {
    setInitialReceitas(initialReceitas.filter((_, i) => i !== idx));
  };

  const addInitialDespesa = () => {
    if (!despNome || !despValor) return;
    const val = parseFloat(despValor);
    const vencInt = parseInt(despVenc, 10);
    if (!isNaN(val) && val > 0 && !isNaN(vencInt)) {
      setInitialDespesas([...initialDespesas, { nome: despNome, valor: val, vencimento: vencInt, fp: despFP }]);
      setDespNome('');
      setDespValor('');
    }
  };

  const removeInitialDespesa = (idx: number) => {
    setInitialDespesas(initialDespesas.filter((_, i) => i !== idx));
  };

  const handleFinish = () => {
    // Update user properties
    const updated = DatabaseService.updateUserProfile(user.id, {
      closing_day: Math.min(Math.max(closingDay, 1), 28),
      card_limit: cardLimit >= 0 ? cardLimit : 0
    });

    // Save added preloaded entries
    initialReceitas.forEach(r => {
      DatabaseService.createReceita(user.id, {
        nome: r.nome,
        valor: r.valor,
        categoria_id: 'cat-salario', // Default to Salário
        recorrente: true,
        dia_recebimento: closingDay,
        ativa: true
      });
    });

    initialDespesas.forEach(d => {
      DatabaseService.createDespesaFixa(user.id, {
        nome: d.nome,
        valor: d.valor,
        categoria_id: 'cat-moradia', // Default to Moradia or Outros
        dia_vencimento: d.vencimento,
        forma_pagamento: d.fp,
        ativa: true
      });
    });

    onOnboardingComplete(updated);
  };

  return (
    <div id="onboarding-setup" className="min-h-screen bg-[#0F1419] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1A2332] via-transparent to-[#0F1419] opacity-40" />

      <div className="w-full max-w-xl bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-8 shadow-2xl relative">
        {/* Step indicator bar */}
        <div className="flex justify-between items-center mb-8 bg-[#0F1419] p-3 rounded-xl border border-[#2E3C51] text-xs">
          <span className={`px-2.5 py-1 rounded-md font-medium text-center ${step === 1 ? 'bg-[#C9A84C] text-[#0F1419]' : 'text-[#8A95A5]'}`}>
            1. Ciclo Cartão
          </span>
          <span className="text-[#8A95A5]/40">➤</span>
          <span className={`px-2.5 py-1 rounded-md font-medium text-center ${step === 2 ? 'bg-[#C9A84C] text-[#0F1419]' : 'text-[#8A95A5]'}`}>
            2. Limite
          </span>
          <span className="text-[#8A95A5]/40">➤</span>
          <span className={`px-2.5 py-1 rounded-md font-medium text-center ${step === 3 ? 'bg-[#C9A84C] text-[#0F1419]' : 'text-[#8A95A5]'}`}>
            3. Registro Fixo
          </span>
        </div>

        {/* STEP 1: CLOSING DAY */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-xl font-semibold text-[#F5F5F7] tracking-tight flex items-center gap-2">
                <LucideIcon name="Calendar" className="text-[#C9A84C]" />
                Dia do Fechamento do Cartão
              </h2>
              <p className="text-[#8A95A5] text-sm mt-1">
                O seu "mês financeiro" começará neste dia. Por exemplo, se escolher o dia 5, seu ciclo de Junho irá de 5 de junho até 4 de julho.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-2">
                Dia de Fechamento (1 a 28)
              </label>
              <input
                type="number"
                min="1"
                max="28"
                value={closingDay}
                onChange={(e) => setClosingDay(Math.min(28, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                className="w-full max-w-xs bg-[#0F1419] border border-[#2E3C51] text-[#F5F5F7] text-lg font-mono rounded-xl p-3 focus:outline-none focus:border-[#C9A84C] transition"
              />
            </div>

            <div className="pt-4 border-t border-[#2E3C51]/50 flex justify-end">
              <button
                onClick={() => setStep(2)}
                className="bg-[#C9A84C] text-[#0F1419] font-medium text-sm px-6 py-2.5 rounded-xl cursor-pointer hover:bg-[#B0923E] transition flex items-center gap-2"
              >
                <span>Avançar</span>
                <LucideIcon name="ChevronRight" size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: CREDIT CARD LIMIT */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-xl font-semibold text-[#F5F5F7] tracking-tight flex items-center gap-2">
                <LucideIcon name="CreditCard" className="text-[#C9A84C]" />
                Limite do Cartão de Crédito
              </h2>
              <p className="text-[#8A95A5] text-sm mt-1">
                Insira o limite total do seu cartão principal para acompanharmos o percentual de gasto e evitar estouros.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-2">
                Limite Total (em R$)
              </label>
              <input
                type="number"
                min="0"
                value={cardLimit}
                onChange={(e) => setCardLimit(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full max-w-xs bg-[#0F1419] border border-[#2E3C51] text-[#F5F5F7] text-lg font-mono rounded-xl p-3 focus:outline-none focus:border-[#C9A84C] transition"
              />
            </div>

            <div className="pt-4 border-t border-[#2E3C51]/50 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="text-[#8A95A5] hover:text-[#F5F5F7] text-sm font-medium transition cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep(3)}
                className="bg-[#C9A84C] text-[#0F1419] font-medium text-sm px-6 py-2.5 rounded-xl cursor-pointer hover:bg-[#B0923E] transition flex items-center gap-2"
              >
                <span>Avançar</span>
                <LucideIcon name="ChevronRight" size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: PRE-LOAD FIXED BUDGETS */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-xl font-semibold text-[#F5F5F7] tracking-tight flex items-center gap-2">
                <LucideIcon name="Coins" className="text-[#C9A84C]" />
                Lançamento Inicial de Orçamento
              </h2>
              <p className="text-[#8A95A5] text-sm mt-1">
                Lançar receitas recorrentes (ex: seu salário líquido) e gastos fixos previsíveis (ex: aluguel, condomínio) ajuda o aplicativo a iniciar ativo e calibrado.
              </p>
            </div>

            {/* Incomes add section */}
            <div className="space-y-3 bg-[#0F1419] p-4 rounded-xl border border-[#2E3C51]/50">
              <h3 className="text-xs font-semibold uppercase text-[#06A77D] tracking-wider flex items-center gap-1.5">
                <LucideIcon name="TrendingUp" size={14} /> Receitas Fixas / Recorrentes
              </h3>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nome (ex: Salário)"
                  value={recNome}
                  onChange={(e) => setRecNome(e.target.value)}
                  className="flex-grow bg-[#1A2332] border border-[#2E3C51] text-[#F5F5F7] text-xs rounded-lg p-2.5 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Valor"
                  value={recValor}
                  onChange={(e) => setRecValor(e.target.value)}
                  className="w-24 bg-[#1A2332] border border-[#2E3C51] text-[#F5F5F7] text-xs font-mono rounded-lg p-2.5 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addInitialReceita}
                  className="bg-[#06A77D]/20 border border-[#06A77D]/40 text-[#06A77D] text-xs px-3 rounded-lg hover:bg-[#06A77D]/30 transition cursor-pointer"
                >
                  Incluir
                </button>
              </div>

              {initialReceitas.length > 0 && (
                <div className="divide-y divide-[#2E3C51]/40 pt-1">
                  {initialReceitas.map((r, i) => (
                    <div key={i} className="flex justify-between items-center py-1.5 text-xs">
                      <span className="text-[#8A95A5]">{r.nome}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#06A77D]">{formatCurrency(r.valor)}</span>
                        <button onClick={() => removeInitialReceita(i)} className="text-[#E63946] opacity-70 hover:opacity-100 cursor-pointer">
                          <LucideIcon name="X" size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Expenses add section */}
            <div className="space-y-3 bg-[#0F1419] p-4 rounded-xl border border-[#2E3C51]/50">
              <h3 className="text-xs font-semibold uppercase text-[#E63946] tracking-wider flex items-center gap-1.5">
                <LucideIcon name="HeartPulse" size={14} /> Despesas Fixas Mensais
              </h3>
              
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Nome (ex: Aluguel)"
                  value={despNome}
                  onChange={(e) => setDespNome(e.target.value)}
                  className="bg-[#1A2332] border border-[#2E3C51] text-[#F5F5F7] text-xs rounded-lg p-2.5 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Valor"
                  value={despValor}
                  onChange={(e) => setDespValor(e.target.value)}
                  className="bg-[#1A2332] border border-[#2E3C51] text-[#F5F5F7] text-xs font-mono rounded-lg p-2.5 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Dia Vencimento"
                  value={despVenc}
                  min="1"
                  max="31"
                  onChange={(e) => setDespVenc(e.target.value)}
                  className="bg-[#1A2332] border border-[#2E3C51] text-[#F5F5F7] text-xs rounded-lg p-2.5 focus:outline-none"
                />
                <select
                  value={despFP}
                  onChange={(e) => setDespFP(e.target.value as PaymentMethod)}
                  className="bg-[#1A2332] border border-[#2E3C51] text-[#F5F5F7] text-xs rounded-lg p-2.5 focus:outline-none cursor-pointer"
                >
                  <option value="pix">PIX</option>
                  <option value="boleto">Boleto</option>
                  <option value="debito">Débito em Conta</option>
                  <option value="credito">Cartão de Crédito</option>
                  <option value="dinheiro">Dinheiro</option>
                </select>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={addInitialDespesa}
                  className="bg-[#E63946]/20 border border-[#E63946]/40 text-[#E63946] text-xs px-4 py-1.5 rounded-lg hover:bg-[#E63946]/30 transition cursor-pointer"
                >
                  Incluir
                </button>
              </div>

              {initialDespesas.length > 0 && (
                <div className="divide-y divide-[#2E3C51]/40 pt-1">
                  {initialDespesas.map((d, i) => (
                    <div key={i} className="flex justify-between items-center py-1.5 text-xs">
                      <span className="text-[#8A95A5]">{d.nome} <span className="text-[10px] bg-[#2E3C51] px-1.5 py-0.5 rounded text-white ml-1 font-sans">{d.fp.toUpperCase()}</span></span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#E63946]">{formatCurrency(d.valor)}</span>
                        <button onClick={() => removeInitialDespesa(i)} className="text-[#E63946] opacity-70 hover:opacity-100 cursor-pointer">
                          <LucideIcon name="X" size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Setup Completion Actions */}
            <div className="pt-4 border-t border-[#2E3C51]/50 flex justify-between items-center">
              <button
                onClick={() => setStep(2)}
                className="text-[#8A95A5] hover:text-[#F5F5F7] text-sm font-medium transition cursor-pointer"
              >
                Voltar
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleFinish}
                  className="text-xs text-[#8A95A5] hover:text-[#F5F5F7] transition px-4 py-2 cursor-pointer"
                >
                  Ignorar etapa
                </button>
                <button
                  onClick={handleFinish}
                  className="bg-[#06A77D] text-[#F5F5F7] hover:bg-[#058F6B] font-medium text-sm px-6 py-2.5 rounded-xl cursor-pointer transition shadow-lg flex items-center gap-2"
                >
                  <LucideIcon name="Check" size={16} />
                  <span>Concluir Onboarding</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
