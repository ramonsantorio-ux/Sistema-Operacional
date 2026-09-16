import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BarChart3, Settings, ChevronLeft, ChevronRight,
  Users, Target, Shield, LogOut, Calendar, AlertTriangle, CalendarDays,
  Briefcase, Brain, ClipboardList, GitMerge, TrendingUp, FileText, FileWarning, MessageSquare, BrainCircuit, Activity, Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
const busatoGlobo = '/logo.png';
import busatoLogoFull from '@/assets/busato-logo-full.png';

import type { LucideIcon } from 'lucide-react';

interface NavItem { to: string; icon: LucideIcon; label: string; badge?: string; key: string }
interface NavGroup { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: 'Visão Geral',
    items: [
      { to: '/', icon: Activity, label: 'Central de Movimentações', key: 'dashboard' },
    ],
  },
  {
    label: 'Gestão de Pessoas',
    items: [
      { to: '/colaboradores', icon: Users, label: 'Colaboradores', key: 'colaboradores' },
      { to: '/organograma', icon: GitMerge, label: 'Organograma', key: 'organograma' },
      { to: '/ausencias', icon: CalendarDays, label: 'Ponto & Férias', key: 'ausencias' },
    ],
  },
  {
    label: 'Liderança & Gestão',
    items: [
      { to: '/desempenho', icon: BrainCircuit, label: 'Painel do Gestor', key: 'desempenho' },
    ],
  },
  {
    label: 'Talentos & Comportamento',
    items: [
      { to: '/treinamentos', icon: ClipboardList, label: 'Central de Assessments', key: 'treinamentos' },
    ],
  },
  {
    label: 'Operações',
    items: [
      { to: '/cco', icon: Radio, label: 'CCO', key: 'cco' },
      { to: '/eventos', icon: AlertTriangle, label: 'SSMA', key: 'eventos' },
      { to: '/evolucao', icon: Briefcase, label: 'Contratos', key: 'evolucao' },
      { to: '/notificacoes', icon: FileWarning, label: 'Notificações/Multas', key: 'notificacoes' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/configuracoes', icon: Settings, label: 'Configurações', key: 'configuracoes' },
    ],
  },
];

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { isAdmin, isDepartmentLocked, permissions, signOut } = useAuth();

  let baseGroups = isAdmin
    ? [
        ...navGroups.slice(0, -1),
        {
          label: 'Sistema',
          items: [
            { to: '/configuracoes', icon: Settings, label: 'Configurações', key: 'configuracoes' },
            { to: '/admin', icon: Shield, label: 'Administração', key: 'admin' },
          ],
        },
      ]
    : navGroups;

  if (isDepartmentLocked) {
    // Para contas de departamento, remove o módulo Operações e Visão Geral
    baseGroups = baseGroups.filter(g => g.label !== 'Operações' && g.label !== 'Visão Geral');
  }

  const allGroups = baseGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (isAdmin) return true;
      if (isDepartmentLocked) {
        const allowedKeys = ['colaboradores', 'organograma', 'ausencias', 'desempenho', 'treinamentos', 'configuracoes'];
        return allowedKeys.includes(item.key);
      }
      return permissions[item.key]?.can_view === true;
    })
  })).filter(group => group.items.length > 0);

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 252 }}
      transition={{ duration: 0.18, ease: 'easeInOut' }}
      className="hidden md:flex flex-col h-screen sticky top-0 z-30 bg-sidebar border-r border-sidebar-border"
    >
      {/* ── Brand ── */}
      <div className="flex items-center px-4 h-20 border-b border-sidebar-border/50 flex-shrink-0 relative overflow-hidden">
        {/* Efeito luminoso de fundo sutil */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-50" />
        
        <AnimatePresence mode="wait">
          {!collapsed ? (
            <motion.div 
              key="full-logo"
              initial={{ opacity: 0, x: -10 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -10 }} 
              transition={{ duration: 0.2 }}
              className="w-full flex items-center px-4"
            >
              <img src={busatoLogoFull} alt="Busato Group" className="h-8 w-auto object-contain drop-shadow-sm" />
            </motion.div>
          ) : (
            <motion.div 
              key="icon-logo"
              initial={{ opacity: 0, scale: 0.8 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.8 }} 
              transition={{ duration: 0.2 }}
              className="w-full flex justify-center"
            >
              <img src={busatoGlobo} alt="Busato" className="w-8 h-8 object-contain drop-shadow-sm" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 py-2 overflow-y-auto px-2">
        {collapsed ? (
          allGroups.map((group, gi) => (
            <div key={group.label} className={cn('mb-1', gi > 0 && 'mt-2')}>
              {gi > 0 && <div className="mx-3 my-1.5 border-t border-sidebar-border/30" />}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={item.label}
                      className={cn(
                        'group relative flex items-center justify-center h-10 w-10 mx-auto rounded-lg transition-all duration-150',
                        isActive ? 'bg-sidebar-primary/12 text-sidebar-primary' : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/70'
                      )}
                    >
                      <item.icon className={cn('w-4 h-4 transition-colors', isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70')} />
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <Accordion type="multiple" defaultValue={allGroups.map(g => g.label)} className="w-full space-y-1">
            {allGroups.map((group) => (
              <AccordionItem value={group.label} key={group.label} className="border-none px-2">
                <AccordionTrigger className="hover:no-underline py-2 px-2 hover:bg-sidebar-accent/50 rounded-lg transition-colors [&[data-state=open]>svg]:rotate-180 group text-left">
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80 transition-colors flex-1">
                    {group.label}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-1 pt-1 space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={cn(
                          'group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] font-medium transition-all duration-150',
                          isActive
                            ? 'bg-sidebar-primary/12 text-sidebar-primary'
                            : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/70'
                        )}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="sidebar-indicator"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-sidebar-primary"
                            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                          />
                        )}
                        <item.icon className={cn(
                          'w-4 h-4 flex-shrink-0 transition-colors',
                          isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70'
                        )} />
                        <span className="whitespace-nowrap flex-1 flex items-center justify-between">
                          {item.label}
                          {item.badge && (
                            <span className="text-[9px] font-bold bg-sidebar-primary text-white px-1.5 py-0.5 rounded-full leading-none">
                              {item.badge}
                            </span>
                          )}
                        </span>
                      </NavLink>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </nav>

      {/* ── Footer ── */}
      <div className="border-t border-sidebar-border flex-shrink-0">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-4 py-3 w-full text-[12.5px] text-sidebar-foreground/50 hover:text-destructive transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="whitespace-nowrap font-medium">
                Sair
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-8 w-full border-t border-sidebar-border/40 text-sidebar-foreground/30 hover:text-sidebar-primary transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>
    </motion.aside>
  );
}
