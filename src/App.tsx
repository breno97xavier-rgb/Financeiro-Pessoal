/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from './types';
import { DatabaseService } from './utils/db';
import Login from './components/Login';
import Setup from './components/Setup';
import Dashboard from './components/Dashboard';
import Projection from './components/Projection';
import Registrations from './components/Registrations';
import Settings from './components/Settings';
import LucideIcon from './components/LucideIcon';
import { motion } from 'motion/react';

type AppTab = 'dashboard' | 'projection' | 'registrations' | 'settings';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab ] = useState<AppTab>('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  // Auto-login active session on mount
  useEffect(() => {
    const session = DatabaseService.getActiveSession();
    if (session) {
      setCurrentUser(session);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
  };

  const handleOnboardingComplete = (updatedUser: User) => {
    // Explicitly set onboarding completion to true
    const finishedUser = DatabaseService.updateUserProfile(updatedUser.id, {
      onboarding_completed: true
    });
    setCurrentUser(finishedUser);
    setActiveTab('dashboard');
  };

  const handleUserUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser);
  };

  const handleSignOut = () => {
    DatabaseService.signOut();
    setCurrentUser(null);
  };

  if (isLoading) {
    return (
      <div id="loader-screen" className="min-h-screen bg-[#0F1419] flex items-center justify-center font-mono text-[#8A95A5] text-xs">
        <div className="flex flex-col items-center gap-2">
          <LucideIcon name="Sparkles" className="animate-spin text-[#C9A84C]" size={24} />
          <span>Carregando ambiente financeiro...</span>
        </div>
      </div>
    );
  }

  // 1. GUEST OR USER AUTHENTICATION GATES
  if (!currentUser) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  // 2. ONBOARDING SETUP STEPS WIZARD GATE
  if (!currentUser.onboarding_completed) {
    return <Setup user={currentUser} onOnboardingComplete={handleOnboardingComplete} />;
  }

  // 3. MAIN APP INTERACTIVE WORKSPACE
  return (
    <div id="app-workspace" className="min-h-screen bg-[#0F1419] text-[#F5F5F7] pb-24 md:pb-8 flex flex-col">
      {/* Dynamic Desktop Header Navigation */}
      <header className="sticky top-0 z-40 bg-[#1A2332]/95 border-b border-[#2E3C51]/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex justify-between items-center">
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5">
            <div className="p-1 px-1.5 bg-gradient-to-br from-[#C9A84C] to-[#977B30] text-[#0F1419] rounded-lg font-bold flex items-center justify-center shadow-lg shadow-[#C9A84C]/10">
              <LucideIcon name="Coins" size={17} />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white leading-none">Mês Financeiro</h1>
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#C9A84C] block mt-0.5">Gestor Inteligente</span>
            </div>
          </div>

          {/* Desktop centered Navigation links */}
          <nav className="hidden md:flex items-center gap-1 bg-[#0F1419] p-1 rounded-xl border border-[#2E3C51]/80">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
              { id: 'projection', label: 'Projeções', icon: 'Sparkles' },
              { id: 'registrations', label: 'Cadastros', icon: 'Table' },
              { id: 'settings', label: 'Configurações', icon: 'Settings' }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as AppTab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#C9A84C] text-[#0F1419]'
                      : 'text-[#8A95A5] hover:text-[#F5F5F7]'
                  }`}
                >
                  <LucideIcon name={tab.icon} size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User badge and Signout panel */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <span className="text-xs font-semibold text-[#F5F5F7] block leading-none">{currentUser.name}</span>
              <span className="text-[10px] text-[#8A95A5] font-mono leading-none mt-1 inline-block">Ciclo: dia {currentUser.closing_day}</span>
            </div>
            <button
              onClick={handleSignOut}
              aria-label="Sair da Conta"
              className="p-2 bg-[#0F1419] hover:bg-[#E63946]/10 hover:text-[#E63946] border border-[#2E3C51] rounded-xl text-[#8A95A5] transition cursor-pointer"
            >
              <LucideIcon name="LogOut" size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="w-full">
          {activeTab === 'dashboard' && <Dashboard user={currentUser} onUpdateUser={handleUserUpdate} />}
          {activeTab === 'projection' && <Projection user={currentUser} />}
          {activeTab === 'registrations' && <Registrations user={currentUser} />}
          {activeTab === 'settings' && (
            <Settings
              user={currentUser}
              onUpdateUser={handleUserUpdate}
              onSignOut={handleSignOut}
            />
          )}
        </div>
      </main>

      {/* Dynamic Mobile Sticky Bottom Navigation target height: 48px */}
      <footer className="md:hidden fixed bottom-1.5 left-1.5 right-1.5 z-40 bg-[#1A2332]/95 border border-[#2E3C51] rounded-2xl shadow-xl backdrop-blur">
        <nav className="flex justify-around items-center h-14 px-2">
          {[
            { id: 'dashboard', label: 'Início', icon: 'LayoutDashboard' },
            { id: 'projection', label: 'Cenários', icon: 'Sparkles' },
            { id: 'registrations', label: 'Filtros', icon: 'Table' },
            { id: 'settings', label: 'Ajustes', icon: 'Settings' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AppTab)}
                className="flex flex-col items-center justify-center flex-1 h-full font-semibold transition cursor-pointer"
              >
                <div className={`p-1.5 px-3 rounded-xl transition ${isActive ? 'bg-[#C9A84C]/15 text-[#C9A84C]' : 'text-[#8A95A5]'}`}>
                  <LucideIcon name={tab.icon} size={18} className="mx-auto" />
                  <span className="text-[9px] block mt-1 font-sans">{tab.label}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </footer>
    </div>
  );
}
