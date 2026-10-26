/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DatabaseService, generateId } from '../utils/db';
import { User, Receita, DespesaFixa, Parcelamento, Transacao } from '../types';
import LucideIcon from './LucideIcon';
import { motion } from 'motion/react';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email || !password || (isSignUp && !name)) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (isSignUp) {
      // Sign Up
      const user = DatabaseService.createUser(email, password, name);
      if (!user) {
        setError('O email fornecido já está em uso.');
      } else {
        setSuccessMsg('Conta criada com sucesso! Redirecionando...');
        setTimeout(() => {
          onLoginSuccess(user);
        }, 1000);
      }
    } else {
      // Sign In
      const user = DatabaseService.loginUser(email, password);
      if (!user) {
        setError('E-mail ou senha incorretos.');
      } else {
        onLoginSuccess(user);
      }
    }
  };

  const handleGuestLogin = () => {
    // Check if guest user already exists or create it
    const guestEmail = 'demo@convidado.com';
    const guestPassword = 'demo';
    
    let guestUser = DatabaseService.loginUser(guestEmail, guestPassword);
    
    if (!guestUser) {
      // Create guest
      guestUser = DatabaseService.createUser(guestEmail, guestPassword, 'Visitante Premium');
      if (guestUser) {
        // Pre-populate rich demonstration databases for this Guest user
        const uId = guestUser.id;
        
        // Seeding Receitas
        DatabaseService.createReceita(uId, {
          nome: 'Salário Principal',
          valor: 6500.00,
          categoria_id: 'cat-salario',
          recorrente: true,
          dia_recebimento: 5,
          ativa: true
        });
        
        DatabaseService.createReceita(uId, {
          nome: 'Projeto Freelance Dev',
          valor: 1550.00,
          categoria_id: 'cat-freelance',
          recorrente: false,
          dia_recebimento: 15,
          ativa: true
        });

        DatabaseService.createReceita(uId, {
          nome: 'Dividendos FIIs',
          valor: 320.00,
          categoria_id: 'cat-investimentos',
          recorrente: true,
          dia_recebimento: 10,
          ativa: true
        });

        // Seeding Despesas Fixas
        DatabaseService.createDespesaFixa(uId, {
          nome: 'Aluguel Loft',
          valor: 1800.00,
          categoria_id: 'cat-moradia',
          dia_vencimento: 10,
          forma_pagamento: 'pix',
          ativa: true,
          observacao: 'Ajustado com IGP-M anual'
        });

        DatabaseService.createDespesaFixa(uId, {
          nome: 'Condomínio',
          valor: 450.00,
          categoria_id: 'cat-moradia',
          dia_vencimento: 10,
          forma_pagamento: 'debito',
          ativa: true
        });

        DatabaseService.createDespesaFixa(uId, {
          nome: 'Internet Fibra 400MB',
          valor: 129.90,
          categoria_id: 'cat-assinaturas',
          dia_vencimento: 20,
          forma_pagamento: 'boleto',
          ativa: true
        });

        DatabaseService.createDespesaFixa(uId, {
          nome: 'Energia Elétrica',
          valor: 215.40,
          categoria_id: 'cat-moradia',
          dia_vencimento: 15,
          forma_pagamento: 'debito',
          ativa: true
        });

        // Seeding Parcelamentos / Assinaturas
        DatabaseService.createParcelamento(uId, {
          nome: 'MacBook Pro 14"',
          valor_parcela: 389.90,
          categoria_id: 'cat-educacao',
          forma_pagamento: 'credito',
          tipo: 'parcelado',
          data_primeira_cobranca: '2026-03-01',
          total_parcelas: 10,
          dia_cobranca: 5,
          ativa: true,
          observacao: 'Compra para trabalho e estudos'
        });

        DatabaseService.createParcelamento(uId, {
          nome: 'Spotify Premium Family',
          valor_parcela: 34.90,
          categoria_id: 'cat-assinaturas',
          forma_pagamento: 'credito',
          tipo: 'assinatura',
          data_primeira_cobranca: '2025-01-01',
          total_parcelas: null,
          dia_cobranca: 5,
          ativa: true
        });

        DatabaseService.createParcelamento(uId, {
          nome: 'Netflix UHD 4K',
          valor_parcela: 55.90,
          categoria_id: 'cat-assinaturas',
          forma_pagamento: 'credito',
          tipo: 'assinatura',
          data_primeira_cobranca: '2025-01-01',
          total_parcelas: null,
          dia_cobranca: 5,
          ativa: true
        });

        DatabaseService.createParcelamento(uId, {
          nome: 'Seguro Automotivo',
          valor_parcela: 180.00,
          categoria_id: 'cat-transporte',
          forma_pagamento: 'credito',
          tipo: 'parcelado',
          data_primeira_cobranca: '2026-01-10',
          total_parcelas: 12,
          dia_cobranca: 10,
          ativa: true
        });

        // Seeding Transações do dia a dia (in June 2026 for demonstration)
        DatabaseService.createTransacao(uId, {
          nome: 'Supermercado Mensal',
          valor: 489.50,
          categoria_id: 'cat-alimentacao',
          forma_pagamento: 'credito',
          data: '2026-06-06',
          observacao: 'Abastecimento do mês'
        });

        DatabaseService.createTransacao(uId, {
          nome: 'Combustível Posto Ipiranga',
          valor: 150.00,
          categoria_id: 'cat-transporte',
          forma_pagamento: 'credito',
          data: '2026-06-08'
        });

        DatabaseService.createTransacao(uId, {
          nome: 'Almoço Executivo',
          valor: 45.90,
          categoria_id: 'cat-alimentacao',
          forma_pagamento: 'debito',
          data: '2026-06-09'
        });

        DatabaseService.createTransacao(uId, {
          nome: 'Cinema e Pipoca',
          valor: 76.00,
          categoria_id: 'cat-lazer',
          forma_pagamento: 'credito',
          data: '2026-06-12'
        });

        DatabaseService.createTransacao(uId, {
          nome: 'Farmácia Medicamentos',
          valor: 58.70,
          categoria_id: 'cat-saude',
          forma_pagamento: 'debito',
          data: '2026-06-15'
        });

        DatabaseService.createTransacao(uId, {
          nome: 'Uber Visita Familiar',
          valor: 24.50,
          categoria_id: 'cat-transporte',
          forma_pagamento: 'pix',
          data: '2026-06-18'
        });

        // Seeding Notas libres (Section 4.3)
        DatabaseService.createNota(uId, 'Metas de Gastos 2026 🎯', '# Planejamento de Metas\n- Guardar pelo menos **20%** da receita líquida.\n- Renegociar planos de assinaturas até o fim do semestre.\n- Focar em investimentos recorrentes de renda variável.');
        DatabaseService.createNota(uId, 'Lista de Desejos 🛍️', '## Wishlist\n- [ ] Kindle Paperwhite (R$ 650,00) - Aguardar Black Friday\n- [ ] Cadeira Ergonômica (R$ 1.200,00) - Prioridade média\n- [x] Livro Aprendendo TypeScript (Comprado!)');

        // Toggle some items as paid
        DatabaseService.toggleReceitaRecebida('rec-salario', '2026-06');
        
        // Safe check for newly created items
        const dFixas = DatabaseService.getDespesasFixas(uId);
        const rent = dFixas.find(x => x.nome.includes('Aluguel'));
        if (rent) DatabaseService.toggleDespesaPaga(rent.id, '2026-06');
        
        const condo = dFixas.find(x => x.nome.includes('Condomínio'));
        if (condo) DatabaseService.toggleDespesaPaga(condo.id, '2026-06');

        const parts = DatabaseService.getParcelamentos(uId);
        const mac = parts.find(x => x.nome.includes('MacBook'));
        if (mac) DatabaseService.toggleParcelaPaga(mac.id, '2026-06');
        const spot = parts.find(x => x.nome.includes('Spotify'));
        if (spot) DatabaseService.toggleParcelaPaga(spot.id, '2026-06');
      }
    }

    onLoginSuccess(guestUser!);
  };

  return (
    <div id="login-screen" className="min-h-screen bg-[#0F1419] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-radial-at-t from-[#1A2332] via-transparent to-[#0F1419] opacity-70 pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md bg-[#1A2332] border border-[#2E3C51] rounded-2xl p-8 shadow-2xl relative overflow-hidden"
      >
        {/* Subtle top visual element */}
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-transparent via-[#C9A84C] to-transparent" />

        {/* Brand / Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-[#0F1419] rounded-xl border border-[#C9A84C]/20 mb-3 text-[#C9A84C]">
            <LucideIcon name="Briefcase" size={28} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F5F5F7] text-center">
            Finanças Mensais
          </h1>
          <p className="text-[#8A95A5] text-sm text-center mt-1">
            Gestão financeira clara, focada no seu fechamento mensal.
          </p>
        </div>

        {/* Error or Success warnings */}
        {error && (
          <div className="bg-[#E63946]/10 border border-[#E63946]/30 text-[#E63946] text-xs p-3 rounded-lg mb-4 flex items-center gap-2">
            <LucideIcon name="ShieldAlert" size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-[#06A77D]/10 border border-[#06A77D]/30 text-[#06A77D] text-xs p-3 rounded-lg mb-4 flex items-center gap-2">
            <LucideIcon name="UserCheck" size={14} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Credential form */}
        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">
                Nome Completo
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-[#8A95A5]/60">
                  <LucideIcon name="FileText" size={16} />
                </span>
                <input
                  type="text"
                  placeholder="Ex: Pedro Henrique"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl py-2.5 pl-10 pr-4 text-[#F5F5F7] text-sm focus:outline-none focus:border-[#C9A84C] transition"
                  required={isSignUp}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">
              E-mail
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-[#8A95A5]/60">
                <LucideIcon name="Coins" size={16} />
              </span>
              <input
                type="email"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl py-2.5 pl-10 pr-4 text-[#F5F5F7] text-sm focus:outline-none focus:border-[#C9A84C] transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8A95A5] mb-1">
              Senha
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-[#8A95A5]/60">
                <LucideIcon name="Key" size={16} />
              </span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0F1419] border border-[#2E3C51] rounded-xl py-2.5 pl-10 pr-4 text-[#F5F5F7] text-sm focus:outline-none focus:border-[#C9A84C] transition"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-[#C9A84C] hover:bg-[#B0923E] text-[#0F1419] font-medium text-sm py-3 rounded-xl transition shadow-lg mt-3 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{isSignUp ? 'Criar Conta e Iniciar' : 'Entrar na Conta'}</span>
            <LucideIcon name="ChevronRight" size={16} />
          </button>
        </form>

        {/* Separator */}
        <div className="relative flex py-4 items-center">
          <div className="flex-grow border-t border-[#2E3C51]"></div>
          <span className="flex-shrink mx-4 text-xs text-[#8A95A5]/70 uppercase tracking-widest">ou</span>
          <div className="flex-grow border-t border-[#2E3C51]"></div>
        </div>

        {/* Testing Guest login */}
        <button
          onClick={handleGuestLogin}
          className="w-full bg-[#2E3C51]/40 hover:bg-[#2E3C51]/60 text-[#F5F5F7] border border-[#2E3C51] font-medium text-sm py-3 rounded-xl transition mb-4 flex items-center justify-center gap-2 cursor-pointer"
        >
          <LucideIcon name="Sparkles" size={16} className="text-[#C9A84C]" />
          <span>Explorar como Convidado</span>
        </button>

        {/* Switch mode */}
        <div className="text-center mt-6">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
              setSuccessMsg('');
            }}
            className="text-xs text-[#C9A84C] hover:underline transition focus:outline-none cursor-pointer"
          >
            {isSignUp ? 'Já tem uma conta? Conecte-se' : 'Não tem conta? Cadastrar grátis'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
