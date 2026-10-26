/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  User,
  Categoria,
  Receita,
  ReceitaRecebida,
  DespesaFixa,
  DespesaPaga,
  Parcelamento,
  ParcelaPaga,
  Transacao,
  Nota,
  Projecao
} from '../types';

// Helper to generate IDs
export function generateId(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    try {
      return window.crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  return Math.random().toString(36).substring(2, 11);
}

// Initial Predefined Categories Seeding
export const PREDEFINED_CATEGORIES: Categoria[] = [
  // Despesas
  { id: 'cat-moradia', user_id: null, nome: 'Moradia', tipo: 'despesa', cor: '#0D1B2A', icone: 'Home' },
  { id: 'cat-alimentacao', user_id: null, nome: 'Alimentação', tipo: 'despesa', cor: '#E63946', icone: 'Utensils' },
  { id: 'cat-transporte', user_id: null, nome: 'Transporte', tipo: 'despesa', cor: '#457B9D', icone: 'Car' },
  { id: 'cat-saude', user_id: null, nome: 'Saúde', tipo: 'despesa', cor: '#06A77D', icone: 'HeartPulse' },
  { id: 'cat-educacao', user_id: null, nome: 'Educação', tipo: 'despesa', cor: '#7209B7', icone: 'GraduationCap' },
  { id: 'cat-lazer', user_id: null, nome: 'Lazer', tipo: 'despesa', cor: '#F4A261', icone: 'Compass' },
  { id: 'cat-assinaturas', user_id: null, nome: 'Assinaturas', tipo: 'despesa', cor: '#C9A84C', icone: 'Tv' },
  { id: 'cat-vestuario', user_id: null, nome: 'Vestuário', tipo: 'despesa', cor: '#A8DADC', icone: 'Shirt' },
  { id: 'cat-outros-desp', user_id: null, nome: 'Outros', tipo: 'despesa', cor: '#6C757D', icone: 'HelpCircle' },
  
  // Receitas
  { id: 'cat-salario', user_id: null, nome: 'Salário', tipo: 'receita', cor: '#2A9D8F', icone: 'Briefcase' },
  { id: 'cat-freelance', user_id: null, nome: 'Freelance', tipo: 'receita', cor: '#E9C46A', icone: 'Code' },
  { id: 'cat-investimentos', user_id: null, nome: 'Investimentos', tipo: 'receita', cor: '#264653', icone: 'TrendingUp' },
  { id: 'cat-outros-rec', user_id: null, nome: 'Outros', tipo: 'receita', cor: '#6C757D', icone: 'Coins' }
];

// In-Memory Database State, bootstrapped from LocalStorage
interface LocalDatabase {
  users: User[];
  authStore: { [email: string]: string }; // email -> password basic store
  categorias: Categoria[];
  receitas: Receita[];
  receitas_recebidas: ReceitaRecebida[];
  despesas_fixas: DespesaFixa[];
  despesas_pagas: DespesaPaga[];
  parcelamentos: Parcelamento[];
  parcelas_pagas: ParcelaPaga[];
  transacoes: Transacao[];
  notas: Nota[];
  projecoes: Projecao[];
}

const STORAGE_KEY = 'financeiro_pessoal_db';

function loadDB(): LocalDatabase {
  if (typeof window === 'undefined') {
    return {
      users: [],
      authStore: {},
      categorias: [],
      receitas: [],
      receitas_recebidas: [],
      despesas_fixas: [],
      despesas_pagas: [],
      parcelamentos: [],
      parcelas_pagas: [],
      transacoes: [],
      notas: [],
      projecoes: []
    };
  }

  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    const fresh: LocalDatabase = {
      users: [],
      authStore: {},
      categorias: [],
      receitas: [],
      receitas_recebidas: [],
      despesas_fixas: [],
      despesas_pagas: [],
      parcelamentos: [],
      parcelas_pagas: [],
      transacoes: [],
      notas: [],
      projecoes: []
    };
    saveDB(fresh);
    return fresh;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to parse Local Database, resetting empty", e);
    return {
      users: [],
      authStore: {},
      categorias: [],
      receitas: [],
      receitas_recebidas: [],
      despesas_fixas: [],
      despesas_pagas: [],
      parcelamentos: [],
      parcelas_pagas: [],
      transacoes: [],
      notas: [],
      projecoes: []
    };
  }
}

function saveDB(db: LocalDatabase) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }
}

// Global DB instance
let dbData = loadDB();

export const DatabaseService = {
  // EXPORT / IMPORT
  exportData(): string {
    return JSON.stringify(dbData, null, 2);
  },

  importData(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      // Basic duck validation
      if (parsed && typeof parsed === 'object' && 'users' in parsed && 'receitas' in parsed) {
        dbData = parsed;
        saveDB(dbData);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  // USER & AUTH
  getActiveSession(): User | null {
    if (typeof window === 'undefined') return null;
    const activeId = localStorage.getItem('finance_active_user_id');
    if (!activeId) return null;
    return dbData.users.find(u => u.id === activeId) || null;
  },

  signOut(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('finance_active_user_id');
    }
  },

  getUserById(userId: string): User | null {
    return dbData.users.find(u => u.id === userId) || null;
  },

  createUser(email: string, passwordHash: string, nome: string): User | null {
    const cleanEmail = email.trim().toLowerCase();
    if (dbData.authStore[cleanEmail]) {
      return null; // Email taken
    }

    const userId = generateId();
    const newUser: User = {
      id: userId,
      email: cleanEmail,
      nome: nome.trim(),
      closing_day: 5, // Default closing day
      card_limit: 5000, // Default limit R$ 5,000.00
      created_at: new Date().toISOString()
    };

    dbData.users.push(newUser);
    dbData.authStore[cleanEmail] = passwordHash;
    saveDB(dbData);
    if (typeof window !== 'undefined') {
      localStorage.setItem('finance_active_user_id', userId);
    }
    return newUser;
  },

  loginUser(email: string, passwordHash: string): User | null {
    const cleanEmail = email.trim().toLowerCase();
    const storedHash = dbData.authStore[cleanEmail];
    if (storedHash && storedHash === passwordHash) {
      const user = dbData.users.find(u => u.email === cleanEmail) || null;
      if (user && typeof window !== 'undefined') {
        localStorage.setItem('finance_active_user_id', user.id);
      }
      return user;
    }
    return null;
  },

  checkCategoryUsage(userId: string, catId: string): boolean {
    const hasRec = dbData.receitas.some(r => r.user_id === userId && r.categoria_id === catId);
    const hasDesp = dbData.despesas_fixas.some(d => d.user_id === userId && d.categoria_id === catId);
    const hasParc = dbData.parcelamentos.some(p => p.user_id === userId && p.categoria_id === catId);
    const hasTr = dbData.transacoes.some(t => t.user_id === userId && t.categoria_id === catId);
    return hasRec || hasDesp || hasParc || hasTr;
  },

  resetUserData(userId: string): void {
    dbData.receitas = dbData.receitas.filter(r => r.user_id !== userId);
    dbData.receitas_recebidas = [];
    dbData.despesas_fixas = dbData.despesas_fixas.filter(d => d.user_id !== userId);
    dbData.despesas_pagas = [];
    dbData.parcelamentos = dbData.parcelamentos.filter(p => p.user_id !== userId);
    dbData.parcelas_pagas = [];
    dbData.transacoes = dbData.transacoes.filter(t => t.user_id !== userId);
    dbData.notas = dbData.notas.filter(n => n.user_id !== userId);
    dbData.projecoes = dbData.projecoes.filter(pr => pr.user_id !== userId);
    saveDB(dbData);
  },

  updateUserProfile(userId: string, updates: Partial<Pick<User, 'nome' | 'closing_day' | 'card_limit' | 'onboarding_completed'>>): User {
    const userIndex = dbData.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      throw new Error("User not found");
    }
    const updated = {
      ...dbData.users[userIndex],
      ...updates
    };
    dbData.users[userIndex] = updated;
    saveDB(dbData);
    return updated;
  },

  deleteUserAccount(userId: string): void {
    const user = dbData.users.find(u => u.id === userId);
    if (!user) return;
    
    // Purge user's credentials
    delete dbData.authStore[user.email];
    // Purge user-owned records
    dbData.users = dbData.users.filter(u => u.id !== userId);
    dbData.categorias = dbData.categorias.filter(c => c.user_id !== userId);
    dbData.receitas = dbData.receitas.filter(r => r.user_id !== userId);
    dbData.despesas_fixas = dbData.despesas_fixas.filter(d => d.user_id !== userId);
    dbData.parcelamentos = dbData.parcelamentos.filter(p => p.user_id !== userId);
    dbData.transacoes = dbData.transacoes.filter(t => t.user_id !== userId);
    dbData.notas = dbData.notas.filter(n => n.user_id !== userId);
    dbData.projecoes = dbData.projecoes.filter(pr => pr.user_id !== userId);

    // Clean cross matrices
    const activeReceitas = new Set(dbData.receitas.map(r => r.id));
    dbData.receitas_recebidas = dbData.receitas_recebidas.filter(rr => activeReceitas.has(rr.receita_id));

    const activeDespesas = new Set(dbData.despesas_fixas.map(d => d.id));
    dbData.despesas_pagas = dbData.despesas_pagas.filter(dp => activeDespesas.has(dp.despesa_id));

    const activeParcelamentos = new Set(dbData.parcelamentos.map(p => p.id));
    dbData.parcelas_pagas = dbData.parcelas_pagas.filter(pp => activeParcelamentos.has(pp.parcelamento_id));

    saveDB(dbData);
  },

  // CATEGORIES
  getCategories(userId: string): Categoria[] {
    const custom = dbData.categorias.filter(c => c.user_id === userId);
    return [...PREDEFINED_CATEGORIES, ...custom];
  },

  createCategory(userId: string, cat: Omit<Categoria, 'id' | 'user_id'>): Categoria {
    const newCat: Categoria = {
      id: `cat-${generateId()}`,
      user_id: userId,
      ...cat
    };
    dbData.categorias.push(newCat);
    saveDB(dbData);
    return newCat;
  },

  updateCategory(catId: string, updates: Partial<Pick<Categoria, 'nome' | 'cor' | 'icone'>>): Categoria {
    const index = dbData.categorias.findIndex(c => c.id === catId);
    if (index === -1) {
      throw new Error("Category not found or is preset");
    }
    const updated = {
      ...dbData.categorias[index],
      ...updates
    };
    dbData.categorias[index] = updated;
    saveDB(dbData);
    return updated;
  },

  deleteCategory(catId: string): void {
    dbData.categorias = dbData.categorias.filter(c => c.id !== catId);
    saveDB(dbData);
  },

  // RECEITAS
  getReceitas(userId: string): Receita[] {
    return dbData.receitas.filter(r => r.user_id === userId);
  },

  createReceita(userId: string, receita: Omit<Receita, 'id' | 'user_id' | 'created_at'>): Receita {
    const item: Receita = {
      id: `rec-${generateId()}`,
      user_id: userId,
      created_at: new Date().toISOString(),
      ...receita
    };
    dbData.receitas.push(item);
    saveDB(dbData);
    return item;
  },

  updateReceita(id: string, updates: Partial<Omit<Receita, 'id' | 'user_id' | 'created_at'>>): Receita {
    const index = dbData.receitas.findIndex(r => r.id === id);
    if (index === -1) throw new Error("Receita not found");
    const updated = { ...dbData.receitas[index], ...updates };
    dbData.receitas[index] = updated;
    saveDB(dbData);
    return updated;
  },

  deleteReceita(id: string): void {
    dbData.receitas = dbData.receitas.filter(r => r.id !== id);
    // Purge clearances
    dbData.receitas_recebidas = dbData.receitas_recebidas.filter(rr => rr.receita_id !== id);
    saveDB(dbData);
  },

  // RECEITAS RECEBIDAS (CLEARANCE CHECK OFFERS)
  getReceitasRecebidas(financialMonth: string, receiptIds: string[]): ReceitaRecebida[] {
    return dbData.receitas_recebidas.filter(
      rr => rr.mes_financeiro === financialMonth && receiptIds.includes(rr.receita_id)
    );
  },

  toggleReceitaRecebida(receitaId: string, financialMonth: string): boolean {
    const existingIndex = dbData.receitas_recebidas.findIndex(
      rr => rr.receita_id === receitaId && rr.mes_financeiro === financialMonth
    );
    if (existingIndex !== -1) {
      dbData.receitas_recebidas.splice(existingIndex, 1);
      saveDB(dbData);
      return false; // unmarked
    } else {
      const record: ReceitaRecebida = {
        id: `rec-rec-${generateId()}`,
        receita_id: receitaId,
        mes_financeiro: financialMonth,
        data_pagamento: new Date().toISOString()
      };
      dbData.receitas_recebidas.push(record);
      saveDB(dbData);
      return true; // marked
    }
  },

  // DESPESAS FIXAS
  getDespesasFixas(userId: string): DespesaFixa[] {
    return dbData.despesas_fixas.filter(d => d.user_id === userId);
  },

  createDespesaFixa(userId: string, despesa: Omit<DespesaFixa, 'id' | 'user_id' | 'created_at'>): DespesaFixa {
    const item: DespesaFixa = {
      id: `df-${generateId()}`,
      user_id: userId,
      created_at: new Date().toISOString(),
      ...despesa
    };
    dbData.despesas_fixas.push(item);
    saveDB(dbData);
    return item;
  },

  updateDespesaFixa(id: string, updates: Partial<Omit<DespesaFixa, 'id' | 'user_id' | 'created_at'>>): DespesaFixa {
    const index = dbData.despesas_fixas.findIndex(d => d.id === id);
    if (index === -1) throw new Error("Despesa not found");
    const updated = { ...dbData.despesas_fixas[index], ...updates };
    dbData.despesas_fixas[index] = updated;
    saveDB(dbData);
    return updated;
  },

  deleteDespesaFixa(id: string): void {
    dbData.despesas_fixas = dbData.despesas_fixas.filter(d => d.id !== id);
    dbData.despesas_pagas = dbData.despesas_pagas.filter(dp => dp.despesa_id !== id);
    saveDB(dbData);
  },

  // DESPESAS PAGAS (CLEARANCE CHECK OFFERS)
  getDespesasPagas(financialMonth: string, despesaIds: string[]): DespesaPaga[] {
    return dbData.despesas_pagas.filter(
      dp => dp.mes_financeiro === financialMonth && despesaIds.includes(dp.despesa_id)
    );
  },

  toggleDespesaPaga(despesaId: string, financialMonth: string): boolean {
    const index = dbData.despesas_pagas.findIndex(
      dp => dp.despesa_id === despesaId && dp.mes_financeiro === financialMonth
    );
    if (index !== -1) {
      dbData.despesas_pagas.splice(index, 1);
      saveDB(dbData);
      return false; // unmarked
    } else {
      const record: DespesaPaga = {
        id: `dp-pg-${generateId()}`,
        despesa_id: despesaId,
        mes_financeiro: financialMonth,
        data_pagamento: new Date().toISOString()
      };
      dbData.despesas_pagas.push(record);
      saveDB(dbData);
      return true; // marked
    }
  },

  // PARCELAMENTOS (INSTALLMENTS / SUBSCRIPTIONS)
  getParcelamentos(userId: string): Parcelamento[] {
    return dbData.parcelamentos.filter(p => p.user_id === userId);
  },

  createParcelamento(userId: string, data: Omit<Parcelamento, 'id' | 'user_id' | 'created_at'>): Parcelamento {
    const item: Parcelamento = {
      id: `parc-${generateId()}`,
      user_id: userId,
      created_at: new Date().toISOString(),
      ...data
    };
    dbData.parcelamentos.push(item);
    saveDB(dbData);
    return item;
  },

  updateParcelamento(id: string, updates: Partial<Omit<Parcelamento, 'id' | 'user_id' | 'created_at'>>): Parcelamento {
    const index = dbData.parcelamentos.findIndex(p => p.id === id);
    if (index === -1) throw new Error("Parcelamento not found");
    const updated = { ...dbData.parcelamentos[index], ...updates };
    dbData.parcelamentos[index] = updated;
    saveDB(dbData);
    return updated;
  },

  deleteParcelamento(id: string): void {
    dbData.parcelamentos = dbData.parcelamentos.filter(p => p.id !== id);
    dbData.parcelas_pagas = dbData.parcelas_pagas.filter(pp => pp.parcelamento_id !== id);
    saveDB(dbData);
  },

  // PARCELAS PAGAS (CLEARANCE CHECK OFFERS)
  getParcelasPagas(financialMonth: string, parcelamentoIds: string[]): ParcelaPaga[] {
    return dbData.parcelas_pagas.filter(
      pp => pp.mes_financeiro === financialMonth && parcelamentoIds.includes(pp.parcelamento_id)
    );
  },

  toggleParcelaPaga(parcelamentoId: string, financialMonth: string): boolean {
    const index = dbData.parcelas_pagas.findIndex(
      pp => pp.parcelamento_id === parcelamentoId && pp.mes_financeiro === financialMonth
    );
    if (index !== -1) {
      dbData.parcelas_pagas.splice(index, 1);
      saveDB(dbData);
      return false; // unmarked
    } else {
      const record: ParcelaPaga = {
        id: `parc-pg-${generateId()}`,
        parcelamento_id: parcelamentoId,
        mes_financeiro: financialMonth,
        data_pagamento: new Date().toISOString()
      };
      dbData.parcelas_pagas.push(record);
      saveDB(dbData);
      return true; // marked
    }
  },

  // TRANSACTIONS (DAILY TRANSACTIONS)
  getTransacoes(userId: string): Transacao[] {
    return dbData.transacoes.filter(t => t.user_id === userId);
  },

  createTransacao(userId: string, trans: Omit<Transacao, 'id' | 'user_id' | 'created_at'>): Transacao {
    const item: Transacao = {
      id: `tr-${generateId()}`,
      user_id: userId,
      created_at: new Date().toISOString(),
      ...trans
    };
    dbData.transacoes.push(item);
    saveDB(dbData);
    return item;
  },

  updateTransacao(id: string, updates: Partial<Omit<Transacao, 'id' | 'user_id' | 'created_at'>>): Transacao {
    const index = dbData.transacoes.findIndex(t => t.id === id);
    if (index === -1) throw new Error("Transaction not found");
    const updated = { ...dbData.transacoes[index], ...updates };
    dbData.transacoes[index] = updated;
    saveDB(dbData);
    return updated;
  },

  deleteTransacao(id: string): void {
    dbData.transacoes = dbData.transacoes.filter(t => t.id !== id);
    saveDB(dbData);
  },

  // NOTAS (LIGHTWEIGHT MARKDOWN NOTES)
  getNotas(userId: string): Nota[] {
    return dbData.notas.filter(n => n.user_id === userId);
  },

  createNota(userId: string, title: string, content: string): Nota {
    const item: Nota = {
      id: `nota-${generateId()}`,
      user_id: userId,
      titulo: title,
      conteudo: content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    dbData.notas.push(item);
    saveDB(dbData);
    return item;
  },

  updateNota(id: string, updates: Partial<Pick<Nota, 'titulo' | 'conteudo'>>): Nota {
    const index = dbData.notas.findIndex(n => n.id === id);
    if (index === -1) throw new Error("Note not found");
    const updated = {
      ...dbData.notas[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    dbData.notas[index] = updated;
    saveDB(dbData);
    return updated;
  },

  deleteNota(id: string): void {
    dbData.notas = dbData.notas.filter(n => n.id !== id);
    saveDB(dbData);
  },

  // PROJECOES (FORECASTS AND SCENARIOS)
  getProjecoes(userId: string): Projecao[] {
    return dbData.projecoes.filter(p => p.user_id === userId);
  },

  createProjecao(userId: string, nome: string, mesRefStr: string, ajustes: any[]): Projecao {
    const item: Projecao = {
      id: `proj-${generateId()}`,
      user_id: userId,
      nome,
      mes_referencia: mesRefStr,
      ajustes,
      created_at: new Date().toISOString()
    };
    dbData.projecoes.push(item);
    saveDB(dbData);
    return item;
  },

  deleteProjecao(id: string): void {
    dbData.projecoes = dbData.projecoes.filter(p => p.id !== id);
    saveDB(dbData);
  }
};
