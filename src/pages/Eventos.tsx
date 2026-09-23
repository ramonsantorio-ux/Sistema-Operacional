import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Download, Search, Filter, Plus, User, AlertTriangle, TrendingUp, TrendingDown, Calendar, Trash2, Eye, FileText, CheckCircle2, ChevronRight, Menu, X, CheckCircle, Clock, Activity, Wrench, Stethoscope, LineChart as LucideLineChart, BarChart3, Target, Zap, ChevronDown, ChevronUp, MapPin, Truck, HeartPulse, Pencil, ShieldAlert, Loader2, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SEED_EVENTS } from '@/data/seedEvents';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { FastInput } from '@/components/ui/fast-input';
import { FastTextarea } from '@/components/ui/fast-textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import PeriodFilter, { getMonthPeriod } from '@/components/filters/PeriodFilter';
import type { PeriodRange } from '@/components/filters/PeriodFilter';
import { toast } from 'sonner';
import { BarChart, Bar, LineChart, Line, AreaChart, ReferenceLine, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, LabelList, PieChart, Pie, ComposedChart } from 'recharts';
import { readExcelRows, writeExcelFile, parseExcelDate } from '@/lib/excel';
import { ExpandableChart } from '@/components/ui/ExpandableChart';
import { TreinamentosSSMA } from '@/components/TreinamentosSSMA';
import N3Dashboard from '@/components/N3Dashboard';
import { usePermissions } from '@/hooks/usePermissions';

interface EventRow {
  id: string;
  event_date: string;
  event_time: string;
  day_of_week: string;
  description: string;
  location: string;
  contract: string;
  equipment: string;
  plate_tag: string;
  shift: string;
  supervisor: string;
  involved_name: string;
  tipo_acidente?: string;
  agente_lesao?: string;
  parte_corpo?: string;
  genero_envolvido?: string;
  custo?: number;
  cid?: string;
  atestado?: boolean;
  afastamento?: boolean;
  danos_materiais?: boolean;
  atendimento_medico?: boolean;
  tecnico_seguranca?: string;
  hora_extra?: boolean;
  categoria_evento?: string;
  encaminhamento_medico?: string;
  area?: string;
  created_at: string;
}

const CHART_COLORS = [
  'hsl(200, 80%, 38%)', 'hsl(155, 60%, 38%)', 'hsl(38, 90%, 50%)', 'hsl(0, 68%, 50%)',
  'hsl(270, 60%, 55%)', 'hsl(180, 45%, 40%)', 'hsl(330, 60%, 50%)', 'hsl(210, 75%, 50%)',
  'hsl(120, 40%, 45%)', 'hsl(45, 80%, 55%)',
];

const LETRA_COLORS_MAP: Record<string, string> = {
  'A Dia': '#ec4899',   // Rosa vibrante
  'A Noite': '#10b981', // Verde esmeralda
  'B Dia': '#f59e0b',   // Laranja ambar
  'B Noite': '#8b5cf6', // Roxo violeta
  'ADM': '#06b6d4',     // Ciano
};
const FALLBACK_LETRA_COLORS = ['#3b82f6', '#ef4444', '#14b8a6', '#6366f1', '#eab308'];

interface TooltipPayloadItem { name: string; value: number | string; color?: string; }
interface CustomTooltipProps { active?: boolean; payload?: TooltipPayloadItem[]; label?: string; }
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function Eventos() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [funcionarios, setFuncionarios] = useState<{ id: string; nome: string; cargo: string; departamento: string; foto_url: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [involvedFilter, setInvolvedFilter] = useState('all');
  const [plateFilter, setPlateFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'operacional' | 'medico'>('all');
  const [period, setPeriod] = useState<PeriodRange>(() => ({
    start: '2025-08-01',
    end: new Date().toISOString().slice(0, 10),
    label: 'Todo o período',
  }));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [detailEvent, setDetailEvent] = useState<EventRow | null>(null);
  const [deleteEvent, setDeleteEvent] = useState<EventRow | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState({
    event_date: '', event_time: '', day_of_week: '', description: '',
    location: '', contract: 'PORTO', equipment: '', plate_tag: '',
    shift: '', supervisor1: '', supervisor2: '', involved_name: '', tipo_acidente: '', agente_lesao: '', parte_corpo: '', genero_envolvido: '', custo: 0,
    cid: '', atestado: false, afastamento: false, danos_materiais: false, atendimento_medico: false, tecnico_seguranca: '', hora_extra: false,
    categoria_evento: 'Material', encaminhamento_medico: '', area: ''
  });

  const openCreateModal = () => {
    setEditingEvent(null);
    setNewEvent({
      event_date: '', event_time: '', day_of_week: '', description: '',
      location: '', contract: 'PORTO', equipment: '', plate_tag: '',
      shift: '', supervisor1: '', supervisor2: '', involved_name: '', tipo_acidente: '', agente_lesao: '', parte_corpo: '', genero_envolvido: '', custo: 0,
      cid: '', atestado: false, afastamento: false, danos_materiais: false, atendimento_medico: false, tecnico_seguranca: '', hora_extra: false,
      categoria_evento: 'Material', encaminhamento_medico: '', area: ''
    });
  };

  const openEditModal = (ev: EventRow) => {
    setEditingEvent(ev);
    let s1 = ev.supervisor || '';
    let s2 = '';
    if (s1.includes(' / ')) {
      const parts = s1.split(' / ');
      s1 = parts[0].trim();
      s2 = parts.slice(1).join(' / ').trim();
    } else if (s1.includes(' - ')) {
      const parts = s1.split(' - ');
      s1 = parts[0].trim();
      s2 = parts.slice(1).join(' - ').trim();
    }

    setNewEvent({
      event_date: ev.event_date.split('T')[0],
      event_time: (ev.event_time || '').match(/\b\d{2}:\d{2}\b/) ? (ev.event_time || '').match(/\b\d{2}:\d{2}\b/)![0] : (ev.event_time || '').substring(0, 5),
      day_of_week: ev.day_of_week,
      description: ev.description,
      location: ev.location,
      contract: ev.contract,
      equipment: ev.equipment,
      plate_tag: ev.plate_tag,
      shift: ev.shift || '',
      supervisor1: s1,
      supervisor2: s2,
      involved_name: ev.involved_name,
      tipo_acidente: ev.tipo_acidente || '',
      agente_lesao: ev.agente_lesao || '',
      parte_corpo: ev.parte_corpo || '',
      genero_envolvido: ev.genero_envolvido || '',
      custo: ev.custo || 0,
      cid: ev.cid || '',
      atestado: ev.atestado || false,
      afastamento: ev.afastamento || false,
      danos_materiais: ev.danos_materiais || false,
      atendimento_medico: ev.atendimento_medico || false,
      tecnico_seguranca: ev.tecnico_seguranca || '',
      hora_extra: ev.hora_extra || false,
      categoria_evento: ev.categoria_evento || 'Material',
      encaminhamento_medico: ev.encaminhamento_medico || '',
      area: ev.area || ''
    });
    setDialogOpen(true);
  };

  // Employee filter
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; nome: string; cargo: string; departamento: string; foto_url: string } | null>(null);
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);

  const filteredSearchEmps = useMemo(() => {
    if (!employeeSearch.trim()) return [];
    return funcionarios.filter(f => f.nome.toLowerCase().includes(employeeSearch.toLowerCase())).slice(0, 8);
  }, [employeeSearch, funcionarios]);

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const activeFiltersCount = (equipmentFilter !== 'all' ? 1 : 0) + (locationFilter !== 'all' ? 1 : 0) + (plateFilter !== 'all' ? 1 : 0) + (timeFilter !== 'all' ? 1 : 0) + (selectedEmployee ? 1 : 0);

  const [evolutionLetra, setEvolutionLetra] = useState<string>('all');
  const [evolutionPeriod, setEvolutionPeriod] = useState<'mensal' | 'trimestral' | 'semestral'>('mensal');
  type EvolutionEntry = { date: string; [key: string]: number | string };
  const [historicalEvolution, setHistoricalEvolution] = useState<EvolutionEntry[]>([]);

  useEffect(() => {
    fetchEvents();
    fetchHistoricalEvolution();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const parseEvent = (ev: EventRow): EventRow => {
    if (ev.shift) {
      ev.shift = ev.shift.toUpperCase().replace(/\s*-\s*/g, ' ').replace('A DIA', 'A Dia').replace('A NOITE', 'A Noite').replace('B DIA', 'B Dia').replace('B NOITE', 'B Noite').trim();
    }
    if (ev.description && ev.description.includes('||EXTRA||')) {
      const parts = ev.description.split('||EXTRA||');
      ev.description = parts[0].trim();
      try {
        const extra = JSON.parse(parts[1]) as Partial<EventRow>;
        return { ...ev, ...extra };
      } catch(e){
        // JSON inválido no campo extra — ignorado
      }
    }
    return ev;
  };

  function getStoredEvents(): EventRow[] {
    try {
      const saved = localStorage.getItem('corporate_cheerleader_events');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed; // retorna mesmo se vazio
      }
    } catch {}
    return []; // não usa mais SEED_EVENTS como fallback automático
  }

  function saveStoredEvents(evts: EventRow[]) {
    try {
      localStorage.setItem('corporate_cheerleader_events', JSON.stringify(evts));
    } catch {}
  }

  async function fetchHistoricalEvolution() {
    let all: EventRow[] = [];
    let supabaseOk = false;
    try {
      const { data, error } = await supabase.from('events').select('*');
      if (!error) {
        supabaseOk = true;
        all = (data || []).map(parseEvent);
        saveStoredEvents(data || []); // sincroniza localStorage (inclusive array vazio)
      }
    } catch {}

    // Só usa cache local se o Supabase falhou por completo
    if (!supabaseOk) {
      all = getStoredEvents().map(parseEvent);
    }
    setHistoricalEvolution(all);
  }

  async function fetchEvents() {
    setLoading(true);
    let evtData: EventRow[] = [];
    let fData: { id: string; nome: string; cargo: string; departamento: string; foto_url: string }[] = [];
    let supabaseOk = false;

    try {
      const [evtRes, fRes] = await Promise.all([
        supabase.from('events').select('*').gte('event_date', period.start).lte('event_date', period.end).order('event_date', { ascending: false }),
        supabase.from('funcionarios').select('id, nome, cargo, departamento, foto_url').order('nome'),
      ]);
      if (!evtRes.error) {
        // Supabase respondeu com sucesso (mesmo que vazio)
        supabaseOk = true;
        evtData = (evtRes.data || []) as EventRow[];
      }
      fData = (fRes.data || []) as typeof fData;
    } catch (e) {
      console.error(e);
    }

    // Só usa o cache local se o Supabase falhou (sem conexão, erro de rede, etc.)
    if (!supabaseOk) {
      const allEvents = getStoredEvents();
      evtData = allEvents.filter(e => {
        if (!e.event_date) return false;
        return e.event_date >= period.start && e.event_date <= period.end;
      }).sort((a, b) => b.event_date.localeCompare(a.event_date));
    }

    const parsedEvents = evtData.map(parseEvent);
    setEvents(parsedEvents as EventRow[]);
    setFuncionarios(fData);
    setLoading(false);
  }

  async function fixHistoricalShifts() {
    toast.info("Iniciando limpeza de base de dados (Turnos)...");
    const { data: allEvents, error } = await supabase.from('events').select('id, shift');
    if (error) {
      toast.error("Erro ao buscar eventos: " + error.message);
      return;
    }
    
    let updatedCount = 0;
    for (const ev of allEvents) {
      if (!ev.shift) continue;
      const original = ev.shift;
      const formatted = original.toUpperCase().replace(/\s*-\s*/g, ' ')
                            .replace('A DIA', 'A Dia')
                            .replace('A NOITE', 'A Noite')
                            .replace('B DIA', 'B Dia')
                            .replace('B NOITE', 'B Noite')
                            .trim();
      
      if (original !== formatted) {
        const { error: upErr } = await supabase.from('events').update({ shift: formatted }).eq('id', ev.id);
        if (!upErr) updatedCount++;
      }
    }
    toast.success(`Limpeza concluída! ${updatedCount} eventos atualizados.`);
    fetchHistoricalEvolution();
  }

  const scrollToTable = () => {
    setTimeout(() => {
      document.getElementById('events-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleChartClick = (data: { name?: string; payload?: { name?: string }; activePayload?: { payload: { name?: string } }[] }, type: string) => {
    if (!data) return;
    const name = data.name || data.payload?.name || data.activePayload?.[0]?.payload?.name;
    if (!name || name === 'N/A' || name === 'NA') return;

    if (type === 'person') {
       const emp = funcionarios.find(f => f.nome.trim().toLowerCase() === name.trim().toLowerCase());
       if (emp) {
         setSelectedEmployee(emp);
       } else {
         setSelectedEmployee({ id: 'stub', nome: name, cargo: '', departamento: '', foto_url: '' });
       }
       setActiveTab('visao-geral'); // Voltar para a aba com a tabela caso esteja na aba colaboradores
    } else if (type === 'equipment') {
       setEquipmentFilter(name);
    } else if (type === 'location') {
       setLocationFilter(name);
    }
    
    // Pequeno atraso para dar tempo de mudar a aba se necessário
    setTimeout(scrollToTable, 50);
  };

  async function handleCreate() {
    if (!newEvent.event_date || !newEvent.description || !newEvent.involved_name) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const eventToSave: any = { ...newEvent };
    
    const isNightShift = eventToSave.shift === 'A Noite' || eventToSave.shift === 'B Noite';
    const sup1 = (eventToSave.supervisor1 || '').trim();
    const sup2 = isNightShift ? '' : (eventToSave.supervisor2 || '').trim();

    if (sup1 && sup2) {
      eventToSave.supervisor = `${sup1} / ${sup2}`;
    } else {
      eventToSave.supervisor = sup1 || sup2;
    }
    delete eventToSave.supervisor1;
    delete eventToSave.supervisor2;
    
    // Format event_time specifically for the database (HH:mm:ss or HH:mm)
    if (eventToSave.event_time) {
      const match = eventToSave.event_time.match(/\b(\d{2}:\d{2}(?::\d{2})?)\b/);
      if (match) {
        eventToSave.event_time = match[1];
      } else {
        // Fallback: truncate to prevent the huge string from crashing the insert/update
        eventToSave.event_time = eventToSave.event_time.substring(0, 8);
      }
    }

    const extraData = { 
      cid: eventToSave.cid, 
      atestado: eventToSave.atestado, 
      afastamento: eventToSave.afastamento, 
      danos_materiais: eventToSave.danos_materiais,
      atendimento_medico: eventToSave.atendimento_medico,
      tipo_acidente: eventToSave.tipo_acidente,
      agente_lesao: eventToSave.agente_lesao,
      parte_corpo: eventToSave.parte_corpo,
      genero_envolvido: eventToSave.genero_envolvido,
      custo: eventToSave.custo,
      tecnico_seguranca: eventToSave.tecnico_seguranca,
      hora_extra: eventToSave.hora_extra,
      categoria_evento: eventToSave.categoria_evento,
      encaminhamento_medico: eventToSave.encaminhamento_medico,
      area: eventToSave.area
    };
    delete eventToSave.cid;
    delete eventToSave.atestado;
    delete eventToSave.afastamento;
    delete eventToSave.danos_materiais;
    delete eventToSave.atendimento_medico;
    delete eventToSave.tipo_acidente;
    delete eventToSave.agente_lesao;
    delete eventToSave.parte_corpo;
    delete eventToSave.genero_envolvido;
    delete eventToSave.custo;
    delete eventToSave.tecnico_seguranca;
    delete eventToSave.hora_extra;
    delete eventToSave.categoria_evento;
    delete eventToSave.encaminhamento_medico;
    delete eventToSave.area;

    const cleanDesc = (eventToSave.description || '').split('||EXTRA||')[0].trim();
    eventToSave.description = cleanDesc + " ||EXTRA||" + JSON.stringify(extraData);

    let error;
    try {
      if (editingEvent) {
        const res = await supabase.from('events').update(eventToSave).eq('id', editingEvent.id);
        error = res.error;
      } else {
        const res = await supabase.from('events').insert(eventToSave);
        error = res.error;
      }
    } catch (e: any) {
      error = e;
    }

    // Always update local cache so changes are immediate
    const stored = getStoredEvents();
    if (editingEvent) {
      const idx = stored.findIndex(e => e.id === editingEvent.id);
      if (idx !== -1) {
        stored[idx] = { ...stored[idx], ...eventToSave, id: editingEvent.id, ...extraData, description: cleanDesc };
      }
    } else {
      stored.unshift({
        id: 'evt-' + Date.now(),
        ...eventToSave,
        ...extraData,
        description: cleanDesc,
        created_at: new Date().toISOString()
      } as EventRow);
    }
    saveStoredEvents(stored);

    toast.success(editingEvent ? 'Evento atualizado com sucesso!' : 'Evento registrado com sucesso!');
    setDialogOpen(false);
    openCreateModal();
    fetchEvents();
    fetchHistoricalEvolution();
  }

  async function confirmDelete() {
    if (!deleteEvent) return;
    if (!canDelete('eventos')) { toast.error('Você não tem permissão para excluir eventos.'); return; }
    try {
      await supabase.from('events').delete().eq('id', deleteEvent.id);
    } catch {}

    const stored = getStoredEvents().filter(e => e.id !== deleteEvent.id);
    saveStoredEvents(stored);

    toast.success('Evento removido');
    setDeleteEvent(null);
    fetchEvents();
    fetchHistoricalEvolution();
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    if (!canCreate('eventos')) { toast.error('Você não tem permissão para importar eventos.'); return; }
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const ab = await file.arrayBuffer();
      const rows = await readExcelRows(ab);
      
      const mapped = rows.map((r: Record<string, unknown>) => {
          let dateVal = '';
          const rawDate = r['DATA'] || r['data'] || r['DATA DO EVENTO'];
          if (rawDate) {
            if (rawDate instanceof Date) {
               dateVal = rawDate.toISOString().split('T')[0];
            } else if (typeof rawDate === 'number') {
               const parsed = parseExcelDate(rawDate);
               dateVal = typeof parsed === 'string' ? parsed : (parsed ? String(parsed) : '');
            } else {
               const str = String(rawDate).trim();
               const parts = str.match(/(\d+)\/(\d+)\/(\d+)/);
               if (parts) {
                 let d = parseInt(parts[1]);
                 let m = parseInt(parts[2]);
                 let y = parseInt(parts[3]);
                 if (y < 100) y += 2000;
                 if (m > 12 && d <= 12) {
                   const temp = d; d = m; m = temp;
                 }
                 dateVal = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
               } else {
                 dateVal = str;
               }
            }
          }
          if (!dateVal) dateVal = new Date().toISOString().split('T')[0];

          const extraData = {
            cid: String(r['CID'] || r['cid'] || ''),
            atestado: String(r['ATESTADO'] || r['atestado'] || '').trim().toLowerCase() === 'sim',
            afastamento: String(r['AFASTAMENTO'] || r['afastamento'] || '').trim().toLowerCase() === 'sim',
            danos_materiais: String(r['DANOS MATERIAIS'] || r['danos_materiais'] || r['danos materiais'] || '').trim().toLowerCase() === 'sim',
            tecnico_seguranca: String(r['TÉCNICO DE SEGURANÇA'] || r['tecnico seguranca'] || ''),
            hora_extra: String(r['HORA EXTRA'] || r['hora extra'] || '').trim().toLowerCase() === 'sim',
            data_admissao: String(r['DATA ADMISSÃO'] || r['data admissao'] || ''),
            categoria_evento: String(r['CATEGORIA DO EVENTO'] || r['categoria evento'] || r['categoria_evento'] || ''),
            encaminhamento_medico: String(r['ENCAMINHAMENTO MÉDICO'] || r['encaminhamento medico'] || ''),
            area: String(r['ÁREA'] || r['area'] || ''),
            tipo_acidente: String(r['TIPO ACIDENTE'] || r['tipo_acidente'] || ''),
            agente_lesao: String(r['AGENTE LESÃO'] || r['agente_lesao'] || ''),
            parte_corpo: String(r['PARTE CORPO'] || r['parte_corpo'] || ''),
            genero_envolvido: String(r['GÊNERO'] || r['genero_envolvido'] || ''),
            custo: parseFloat(String(r['CUSTO'] || r['custo'] || '0')) || 0,
          };
          
          if (!extraData.categoria_evento) {
             const isMedical = String(r['LOCAL ESPECÍFICO'] || r['LOCAL'] || '').toUpperCase().includes('ATENDIMENTO MÉDICO') || extraData.atestado || extraData.afastamento || !!extraData.cid;
             extraData.categoria_evento = isMedical ? 'Médico' : 'Material';
          }
          
          const rawDesc = String(r['DESCRIÇÃO DO EVENTO'] || r['descricao'] || '').trim();
          const cleanDesc = rawDesc.split('||EXTRA||')[0].trim();
          const involved = String(r['NOME DO ENVOLVIDO'] || r['nome_envolvido'] || '').trim();
          const loc = String(r['LOCAL ESPECÍFICO'] || r['LOCAL'] || r['local'] || '').trim();
          
          // Attach a flag to identify truly empty rows
          const isEmptyRow = !rawDesc && !involved && !loc && !r['EQUIPAMENTO'] && !r['CONTRATO'];

          return {
            isEmptyRow,
            event_date: dateVal,
            event_time: String(r['HORÁRIO'] || r['horario'] || ''),
            day_of_week: String(r['DIA DA SEMANA'] || r['dia_da_semana'] || ''),
            description: cleanDesc + " ||EXTRA||" + JSON.stringify(extraData),
            location: loc,
            contract: String(r['CONTRATO'] || r['contrato'] || 'PORTO'),
            equipment: String(r['EQUIPAMENTO'] || r['equipamento'] || ''),
            plate_tag: String(r['PLACA OU TAG'] || r['PLACA/TAG'] || r['placa_tag'] || ''),
            shift: String(r['LETRA/TURNO'] || r['TURNO'] || r['turno'] || '').toUpperCase().replace(/\s*-\s*/g, ' ').replace('A DIA', 'A Dia').replace('A NOITE', 'A Noite').replace('B DIA', 'B Dia').replace('B NOITE', 'B Noite').trim(),
            supervisor: [String(r['ENCARREGADO 1'] || r['ENCARREGADO'] || r['encarregado 1'] || r['encarregado'] || ''), String(r['ENCARREGADO 2'] || r['encarregado 2'] || '')].filter(Boolean).join(' / '),
            involved_name: involved
          };
      }).filter(r => !r.isEmptyRow && r.event_date);

      if (!mapped.length) { toast.error('Nenhum dado válido encontrado'); return; }

      // Remove the isEmptyRow flag before inserting
      const toInsert = mapped.map(({ isEmptyRow, ...rest }) => rest);

      for (let i = 0; i < toInsert.length; i += 50) {
        const batch = toInsert.slice(i, i + 50);
        try {
          await supabase.from('events').insert(batch);
        } catch {}
      }

      // Sync with local cache
      const currentStored = getStoredEvents();
      const newItems = toInsert.map((ev, i) => ({
        ...ev,
        id: 'evt-' + Date.now() + '-' + i,
        created_at: new Date().toISOString()
      }));
      saveStoredEvents([...newItems, ...currentStored]);

      toast.success(`${mapped.length} eventos importados com sucesso!`);
      fetchEvents();
      fetchHistoricalEvolution();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erro ao importar: ' + msg);
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  }

  function handleRestoreSeed() {
    saveStoredEvents(SEED_EVENTS);
    toast.success('Base oficial de 63 eventos restaurada com sucesso!');
    fetchEvents();
    fetchHistoricalEvolution();
  }

  async function handleDeleteAll() {
    if (!canDelete('eventos')) { toast.error('Você não tem permissão para excluir eventos.'); return; }
    setIsDeletingAll(true);
    try {
      // Busca todos os IDs sem filtro de período para garantir exclusão completa
      const { data: allIds, error: fetchError } = await supabase.from('events').select('id');
      if (fetchError) throw fetchError;
      const ids = (allIds || []).map((e: { id: string }) => e.id);
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        const { error: delError } = await supabase.from('events').delete().in('id', batch);
        if (delError) throw delError;
      }
      saveStoredEvents([]);
      toast.success('Todos os eventos foram excluídos.');
      fetchEvents();
      fetchHistoricalEvolution();
      setDeleteAllConfirm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erro ao excluir eventos: ' + msg);
    } finally {
      setIsDeletingAll(false);
    }
  }

  async function handleExport() {
    const exportData = events.map(ev => {
      let extra: Record<string, unknown> = {};
      if (ev.description?.includes('||EXTRA||')) {
         try { extra = JSON.parse(ev.description.split('||EXTRA||')[1]) as Record<string, unknown>; } catch(e){
           // JSON inválido no campo extra — ignorado
         }
      }

      return {
        'DATA': ev.event_date ? new Date(ev.event_date + 'T12:00').toLocaleDateString('pt-BR') : '',
        'HORÁRIO': ev.event_time || '',
        'DIA DA SEMANA': ev.day_of_week || '',
        'LETRA/TURNO': ev.shift || '',
        'CATEGORIA DO EVENTO': (extra.categoria_evento as string) || ev.categoria_evento || 'Material',
        'ÁREA': ev.area || '',
        'LOCAL ESPECÍFICO': ev.location || '',
        'DESCRIÇÃO DO EVENTO': ev.description?.split('||EXTRA||')[0].trim() || '',
        'NOME DO ENVOLVIDO': ev.involved_name || '',
        'DATA ADMISSÃO': (extra.data_admissao as string) || '',
        'HORA EXTRA': (extra.hora_extra || ev.hora_extra) ? 'SIM' : 'NÃO',
        'ENCARREGADO 1': (ev.supervisor || '').includes(' / ') ? (ev.supervisor || '').split(' / ')[0].trim() : (ev.supervisor || '').includes(' - ') ? (ev.supervisor || '').split(' - ')[0].trim() : (ev.supervisor || ''),
        'ENCARREGADO 2': (ev.supervisor || '').includes(' / ') ? (ev.supervisor || '').split(' / ').slice(1).join(' / ').trim() : (ev.supervisor || '').includes(' - ') ? (ev.supervisor || '').split(' - ').slice(1).join(' - ').trim() : '',
        'TÉCNICO DE SEGURANÇA': (extra.tecnico_seguranca as string) || '',
        'EQUIPAMENTO': ev.equipment || '',
        'PLACA OU TAG': ev.plate_tag || '',
        'DANOS MATERIAIS': (extra.danos_materiais || ev.danos_materiais) ? 'SIM' : 'NÃO',
        'ENCAMINHAMENTO MÉDICO': (extra.encaminhamento_medico as string) || ev.encaminhamento_medico || '',
        'CID': (extra.cid as string) || ev.cid || '',
        'ATESTADO': (extra.atestado || ev.atestado) ? 'SIM' : 'NÃO',
        'AFASTAMENTO': (extra.afastamento || ev.afastamento) ? 'SIM' : 'NÃO',
        'TIPO ACIDENTE': ev.tipo_acidente || '',
        'AGENTE LESÃO': ev.agente_lesao || '',
        'PARTE CORPO': ev.parte_corpo || '',
        'GÊNERO': ev.genero_envolvido || '',
        'CUSTO': ev.custo || 0,
        'CONTRATO': ev.contract || '',
      };
    });
    await writeExcelFile(exportData as Record<string, unknown>[], 'Eventos_Porto.xlsx', 'Eventos');
  }

  // Unique equipment types for filter
  const equipmentTypes = useMemo(() => {
    const types = new Set(events.map(e => e.equipment).filter(Boolean).filter(e => e !== 'NA'));
    return Array.from(types).sort();
  }, [events]);

  const dateTypes = useMemo(() => Array.from(new Set(events.map(e => e.event_date).filter(Boolean))).sort((a,b)=>b.localeCompare(a)), [events]);
  const timeTypes = useMemo(() => Array.from(new Set(events.map(e => e.event_time).filter(Boolean))).sort(), [events]);
  const involvedTypes = useMemo(() => Array.from(new Set(events.map(e => e.involved_name).filter(Boolean))).sort(), [events]);
  const plateTypes = useMemo(() => Array.from(new Set(events.map(e => e.plate_tag).filter(Boolean).filter(e => e !== 'NA'))).sort(), [events]);
  const locationTypes = useMemo(() => Array.from(new Set(events.map(e => e.location).filter(Boolean))).sort(), [events]);
  const shiftTypes = useMemo(() => Array.from(new Set(events.map(e => e.shift?.trim().replace(/\s*-\s*/g, ' - ').toUpperCase()).filter(Boolean))).sort(), [events]);

  // Filtered events
  const filtered = useMemo(() => {
    return events.filter(ev => {
      const q = search.toLowerCase();
      const matchSearch = !q || ev.description.toLowerCase().includes(q) ||
        ev.involved_name.toLowerCase().includes(q) ||
        ev.location.toLowerCase().includes(q) ||
        ev.equipment.toLowerCase().includes(q) ||
        ev.plate_tag.toLowerCase().includes(q);
      const matchEquip = equipmentFilter === 'all' || ev.equipment === equipmentFilter;
      const matchEmployee = !selectedEmployee || ev.involved_name.trim().toLowerCase() === selectedEmployee.nome.trim().toLowerCase();
      
      const isMedical = ev.location?.toUpperCase().includes('ATENDIMENTO MÉDICO') || ev.location?.toUpperCase().includes('PROBLEMA PARTICULAR') || ev.atendimento_medico || ev.atestado || ev.afastamento || !!ev.cid || ev.categoria_evento === 'Médico';
      const cat = ev.categoria_evento || (isMedical ? 'Médico' : 'Material');
      const matchType = typeFilter === 'all' || typeFilter === cat;

      const matchDate = dateFilter === 'all' || ev.event_date === dateFilter;
      const matchTime = timeFilter === 'all' || ev.event_time === timeFilter;
      const matchInvolved = involvedFilter === 'all' || ev.involved_name === involvedFilter;
      const matchPlate = plateFilter === 'all' || ev.plate_tag === plateFilter;
      const matchLocation = locationFilter === 'all' || ev.location === locationFilter;
      const matchShift = shiftFilter === 'all' || ev.shift === shiftFilter;
      return matchSearch && matchEquip && matchEmployee && matchDate && matchTime && matchInvolved && matchPlate && matchLocation && matchType && matchShift;
    });
  }, [events, search, equipmentFilter, selectedEmployee, dateFilter, timeFilter, involvedFilter, plateFilter, locationFilter, typeFilter, shiftFilter]);

  // ========== ANALYTICS ==========
  const analytics = useMemo(() => {
        const byMonth: Record<string, number> = {};
    const byEquipment: Record<string, number> = {};
    const byLocation: Record<string, number> = {};
    const byPersonMaterial: Record<string, number> = {};
    const byPersonMedico: Record<string, number> = {};
    const byPersonMeioAmbiente: Record<string, number> = {};
    const byTst: Record<string, number> = {};
    const byDayOfWeek: Record<string, number> = {};
    const byYear: Record<string, number> = {};
    const byTipoAcidente: Record<string, number> = {};
    const byAgenteLesao: Record<string, number> = {};
    const byParteCorpo: Record<string, number> = {};
    const byGenero: Record<string, number> = {};
    const byTurno: Record<string, number> = {};
    const byLetra: Record<string, number> = {};
    const byCid: Record<string, number> = {};
    const byAtestado: Record<string, number> = {};
    const byArea: Record<string, number> = {};
    let afastamentoCom = 0;
    let afastamentoSem = 0;
    let danosCom = 0;
    let danosSem = 0;
    let materialCount = 0;
    let meioAmbienteCount = 0;
    let medicoCount = 0;

    let daysWithoutAccident: number | 'N/A' = 'N/A';
    const validPastDates = filtered
      .map(ev => new Date(ev.event_date))
      .filter(d => !isNaN(d.getTime()) && d.getTime() <= new Date().getTime())
      .sort((a, b) => b.getTime() - a.getTime());

    if (validPastDates.length > 0) {
      daysWithoutAccident = Math.floor((new Date().getTime() - validPastDates[0].getTime()) / (1000 * 60 * 60 * 24));
    } else if (filtered.length > 0) {
      daysWithoutAccident = 0;
    }

    const dayMap: Record<string, number> = { 'domingo': 0, 'segunda-feira': 1, 'terça-feira': 2, 'quarta-feira': 3, 'quinta-feira': 4, 'sexta-feira': 5, 'sábado': 6 };
    const hourlyGrid: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourlyGrid[h] = 0;

    for (const ev of filtered) {
      const ym = ev.event_date.slice(0, 7);
      byMonth[ym] = (byMonth[ym] || 0) + 1;
      const yr = ev.event_date.slice(0, 4);
      byYear[yr] = (byYear[yr] || 0) + 1;

      const isMedical = ev.location?.toUpperCase().includes('ATENDIMENTO MÉDICO') || ev.location?.toUpperCase().includes('PROBLEMA PARTICULAR') || ev.atendimento_medico || ev.atestado || ev.afastamento || !!ev.cid || ev.categoria_evento === 'Médico';
      const cat = ev.categoria_evento || (isMedical ? 'Médico' : 'Material');

      if (cat !== 'Médico') {
        const equipRaw = ev.equipment && ev.equipment !== 'NA' ? ev.equipment : 'N/A';
        const equip = equipRaw === 'N/A' ? 'N/A' : equipRaw.replace(/\s+/g, ' ').trim().toUpperCase();
        byEquipment[equip] = (byEquipment[equip] || 0) + 1;
      }

      if (cat !== 'Médico' && ev.location) {
        const loc = ev.location.toUpperCase().includes('ATENDIMENTO MÉDICO') || ev.location.toUpperCase().includes('PROBLEMA PARTICULAR')
          ? 'ATENDIMENTO MÉDICO / PESSOAL' : ev.location.length > 30 ? ev.location.slice(0, 30) + '...' : ev.location;
        byLocation[loc] = (byLocation[loc] || 0) + 1;
      }

      
      if (cat === 'Médico') {
        medicoCount++;
      } else if (cat === 'Meio Ambiente') {
        meioAmbienteCount++;
      } else {
        materialCount++;
      }

      // Acumula por pessoa separado por categoria (para o gráfico empilhado)
      if (ev.involved_name) {
        if (cat === 'Médico') {
          byPersonMedico[ev.involved_name] = (byPersonMedico[ev.involved_name] || 0) + 1;
        } else if (cat === 'Meio Ambiente') {
          byPersonMeioAmbiente[ev.involved_name] = (byPersonMeioAmbiente[ev.involved_name] || 0) + 1;
        } else {
          byPersonMaterial[ev.involved_name] = (byPersonMaterial[ev.involved_name] || 0) + 1;
        }
      }

      if (cat !== 'Médico' && ev.day_of_week) {
        const dow = ev.day_of_week.toLowerCase();
        byDayOfWeek[dow] = (byDayOfWeek[dow] || 0) + 1;
      }

      if (cat !== 'Médico' && ev.shift) {
        const shift = ev.shift.trim().replace(/\s*-\s*/g, ' - ').toLowerCase().replace(/\b[a-z]/g, char => char.toUpperCase()).replace('Adm', 'ADM');
        byLetra[shift] = (byLetra[shift] || 0) + 1;
      }

      if (ev.tecnico_seguranca) {
        byTst[ev.tecnico_seguranca] = (byTst[ev.tecnico_seguranca] || 0) + 1;
      }

      if (ev.cid) byCid[ev.cid] = (byCid[ev.cid] || 0) + 1;
      if (ev.atestado && ev.involved_name) byAtestado[ev.involved_name] = (byAtestado[ev.involved_name] || 0) + 1;
      if (ev.afastamento) afastamentoCom++; else afastamentoSem++;
      if (ev.danos_materiais) danosCom++; else danosSem++;

      if (ev.tipo_acidente) byTipoAcidente[ev.tipo_acidente] = (byTipoAcidente[ev.tipo_acidente] || 0) + 1;
      if (ev.agente_lesao) byAgenteLesao[ev.agente_lesao] = (byAgenteLesao[ev.agente_lesao] || 0) + 1;
      if (ev.parte_corpo) byParteCorpo[ev.parte_corpo] = (byParteCorpo[ev.parte_corpo] || 0) + 1;

      if (cat !== 'Médico' && ev.event_time) {
        const timeMatch = ev.event_time.match(/\b(\d{2}):(\d{2})(?::\d{2})?\b/);
        if (timeMatch) {
          const h = parseInt(timeMatch[1]);
          if (!isNaN(h)) {
            hourlyGrid[h] += 1;
          }
        }
      }
      if (ev.area) {
        byArea[ev.area] = (byArea[ev.area] || 0) + 1;
      }

    }

    const monthTrend = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => {
      const [y, m] = month.split('-');
      const label = `${m}/${y.slice(2)}`;
      return { month: label, eventos: count };
    });

    const topEquipment = Object.entries(byEquipment)
      .sort(([, a], [, b]) => b - a).slice(0, 8)
      .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + '...' : name, value }));

    // Merge das 3 categorias por pessoa, ordenado por total decrescente
    const allPeople = new Set([
      ...Object.keys(byPersonMaterial),
      ...Object.keys(byPersonMedico),
      ...Object.keys(byPersonMeioAmbiente)
    ]);
    const topPeople = Array.from(allPeople)
      .map(name => ({
        name,
        Material: byPersonMaterial[name] || 0,
        Médico: byPersonMedico[name] || 0,
        'Meio Ambiente': byPersonMeioAmbiente[name] || 0,
        total: (byPersonMaterial[name] || 0) + (byPersonMedico[name] || 0) + (byPersonMeioAmbiente[name] || 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);

    const dayOfWeekOrder = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];
    const dayData = dayOfWeekOrder.map(d => ({
      day: d.replace('-feira', '').charAt(0).toUpperCase() + d.replace('-feira', '').slice(1),
      eventos: byDayOfWeek[d] || 0,
    }));

    const topLocations = Object.entries(byLocation)
      .sort(([, a], [, b]) => b - a).slice(0, 6)
      .map(([name, value]) => ({ name, value }));
    const topAreasMinerio = Object.entries(byArea)
      .filter(([name]) => name.includes('Minério') || name.includes('Área Velha') || name.includes('Área Nova') || name.includes('Rota AMT') || name.includes('Virador'))
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name: name.replace(' (Minério)', ''), value }));

    const topAreasTpm = Object.entries(byArea)
      .filter(([name]) => name.includes('TPM') || name.includes('Pátios') || name.includes('Silo'))
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name: name.replace(' (TPM)', ''), value }));

    const topAreasBase = Object.entries(byArea)
      .filter(([name]) => name.includes('Base') || name.includes('Apoio'))
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name: name.replace(' (Apoio)', ''), value }));

    const topTst = Object.entries(byTst)
      .sort(([, a], [, b]) => b - a).slice(0, 8)
      .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + '...' : name, value }));

    const yearData = Object.entries(byYear).sort(([a], [b]) => a.localeCompare(b)).map(([year, count]) => ({ year, eventos: count }));

    const topTipos = Object.entries(byTipoAcidente).map(([name, value]) => ({ name, value }));
    const topAgentes = Object.entries(byAgenteLesao).sort(([,a], [,b]) => b - a).slice(0, 6).map(([name, value]) => ({ name, value }));
    const topPartes = Object.entries(byParteCorpo).sort(([,a], [,b]) => b - a).slice(0, 6).map(([name, value]) => ({ name, value }));

    const turnoData = Object.entries(byTurno || {}).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }));

    const hourlyData = Object.entries(hourlyGrid).map(([hour, count]) => ({ hour: `${hour}h`, count }));

    const letraData = Object.entries(byLetra)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, value], i) => ({
        name, value, fill: CHART_COLORS[i % CHART_COLORS.length]
      }));

    const topCids = Object.entries(byCid)
      .sort(([, a], [, b]) => b - a).slice(0, 5)
      .map(([name, value], i) => ({ name, value, fill: CHART_COLORS[i % CHART_COLORS.length] }));

    const topAtestados = Object.entries(byAtestado)
      .sort(([, a], [, b]) => b - a).slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const afastamentoData = [
      { name: 'Eventos com Afastamento', value: afastamentoCom, fill: '#ef4444' },
      { name: 'Eventos sem Afastamento', value: afastamentoSem, fill: '#10b981' }
    ].filter(d => d.value > 0);

    const danosData = [
      { name: 'Eventos Materiais', value: danosCom, fill: '#f59e0b' },
      { name: 'Eventos Sem Perda', value: danosSem, fill: '#3b82f6' }
    ].filter(d => d.value > 0);

    const evolutionChartData = (() => {
      const periodShiftData: Record<string, Record<string, number>> = {};
      const periodsSet = new Set<string>();
      const defaultLetras = ['A Dia', 'A Noite', 'B Dia', 'B Noite'];
      const letrasSet = new Set<string>(defaultLetras);

      historicalEvolution.forEach(ev => {
        const isMedical = ev.location?.toUpperCase().includes('ATENDIMENTO MÉDICO') || ev.location?.toUpperCase().includes('PROBLEMA PARTICULAR') || ev.atendimento_medico || ev.atestado || ev.afastamento || !!ev.cid || ev.categoria_evento === 'Médico';
        const cat = ev.categoria_evento || (isMedical ? 'Médico' : 'Material');

        // Considera apenas eventos materiais no gráfico de evolução
        if (cat !== 'Material') return;
        if (typeFilter !== 'all' && typeFilter !== cat) return;

        if (ev.event_date) {
          // Se não tem turno, agrupa como 'Sem Turno' em vez de ignorar
          let shift = 'Sem Turno';
          if (ev.shift && ev.shift.trim()) {
            shift = ev.shift.trim().replace(/\s*-\s*/g, ' - ').toLowerCase().replace(/\b[a-z]/g, char => char.toUpperCase()).replace('Adm', 'ADM');
            if (shift.includes('A Dia')) shift = 'A Dia';
            else if (shift.includes('A Noite')) shift = 'A Noite';
            else if (shift.includes('B Dia')) shift = 'B Dia';
            else if (shift.includes('B Noite')) shift = 'B Noite';
          }

          letrasSet.add(shift);

          // Extrai ano e mês diretamente da string (YYYY-MM-DD) sem sofrer alteração de fuso horário
          const dateParts = ev.event_date.split('T')[0].split('-');
          if (dateParts.length >= 2) {
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]); // 1-12

            if (!isNaN(year) && !isNaN(month)) {
              let periodKey = '';

              if (evolutionPeriod === 'mensal') {
                periodKey = `${year}-${String(month).padStart(2, '0')}`;
              } else if (evolutionPeriod === 'trimestral') {
                const quarter = Math.floor((month - 1) / 3) + 1;
                periodKey = `${year}-Q${quarter}`;
              } else if (evolutionPeriod === 'semestral') {
                const semester = Math.floor((month - 1) / 6) + 1;
                periodKey = `${year}-S${semester}`;
              }

              periodsSet.add(periodKey);
              if (!periodShiftData[periodKey]) periodShiftData[periodKey] = {};
              periodShiftData[periodKey][shift] = (periodShiftData[periodKey][shift] || 0) + 1;
              periodShiftData[periodKey]['Total'] = (periodShiftData[periodKey]['Total'] || 0) + 1;
            }
          }
        }
      });

      const allPeriods = Array.from(periodsSet).sort();
      const letrasList = Array.from(letrasSet);

      const chartData = allPeriods.map(pk => {
        let label = pk;
        const parts = pk.split('-');
        label = `${parts[1]}/${parts[0].slice(2)}`;

        const row: Record<string, string | number> = {
          periodo: pk,
          month: label,
          Total: periodShiftData[pk]?.['Total'] || 0,
        };

        letrasList.forEach(l => {
          row[l] = periodShiftData[pk]?.[l] || 0;
        });

        return row;
      });

      return { chartData, letrasList };
    })();

    const consolidations = (() => {
      // Conta total de eventos materiais e o número de períodos distintos no histórico
      const monthsSet = new Set<string>();
      const quartersSet = new Set<string>();
      const semestersSet = new Set<string>();
      let totalMaterial = 0;

      historicalEvolution.forEach(ev => {
        const isMedical = ev.location?.toUpperCase().includes('ATENDIMENTO MÉDICO') || ev.location?.toUpperCase().includes('PROBLEMA PARTICULAR') || ev.atendimento_medico || ev.atestado || ev.afastamento || !!ev.cid || ev.categoria_evento === 'Médico';
        const cat = ev.categoria_evento || (isMedical ? 'Médico' : 'Material');

        if (cat === 'Material' && ev.event_date) {
          let shift = 'Sem Turno';
          if (ev.shift && ev.shift.trim()) {
            shift = ev.shift.trim().replace(/\s*-\s*/g, ' - ').toLowerCase().replace(/\b[a-z]/g, char => char.toUpperCase()).replace('Adm', 'ADM');
            if (shift.includes('A Dia')) shift = 'A Dia';
            else if (shift.includes('A Noite')) shift = 'A Noite';
            else if (shift.includes('B Dia')) shift = 'B Dia';
            else if (shift.includes('B Noite')) shift = 'B Noite';
          }

          if (evolutionLetra === 'all' || evolutionLetra === shift) {
            const dateParts = ev.event_date.split('T')[0].split('-');
            if (dateParts.length >= 2) {
              const evYear = parseInt(dateParts[0]);
              const evMonth = parseInt(dateParts[1]) - 1; // 0-indexed

              if (!isNaN(evYear) && !isNaN(evMonth)) {
                totalMaterial++;

                // Registra períodos distintos
                monthsSet.add(`${evYear}-${evMonth}`);
                quartersSet.add(`${evYear}-Q${Math.floor(evMonth / 3)}`);
                semestersSet.add(`${evYear}-S${Math.floor(evMonth / 6)}`);
              }
            }
          }
        }
      });

      const nMonths = Math.max(monthsSet.size, 1);
      const nQuarters = Math.max(quartersSet.size, 1);
      const nSemesters = Math.max(semestersSet.size, 1);

      // Médias por período
      const avgMensal = Math.round(totalMaterial / nMonths);
      const avgTrimestral = Math.round(totalMaterial / nQuarters);
      const avgSemestral = Math.round(totalMaterial / nSemesters);

      // Para a variação: compara a média da primeira metade vs segunda metade dos meses
      // Isso indica tendência histórica (subindo ou caindo?)
      const sortedMonths = Array.from(monthsSet).sort();
      const mid = Math.ceil(sortedMonths.length / 2);
      const firstHalfMonths = new Set(sortedMonths.slice(0, mid));
      const secondHalfMonths = new Set(sortedMonths.slice(mid));

      let firstHalfTotal = 0; let secondHalfTotal = 0;

      historicalEvolution.forEach(ev => {
        const isMedical = ev.location?.toUpperCase().includes('ATENDIMENTO MÉDICO') || ev.location?.toUpperCase().includes('PROBLEMA PARTICULAR') || ev.atendimento_medico || ev.atestado || ev.afastamento || !!ev.cid || ev.categoria_evento === 'Médico';
        const cat = ev.categoria_evento || (isMedical ? 'Médico' : 'Material');

        if (cat === 'Material' && ev.event_date) {
          let shift = 'Sem Turno';
          if (ev.shift && ev.shift.trim()) {
            shift = ev.shift.trim().replace(/\s*-\s*/g, ' - ').toLowerCase().replace(/\b[a-z]/g, char => char.toUpperCase()).replace('Adm', 'ADM');
            if (shift.includes('A Dia')) shift = 'A Dia';
            else if (shift.includes('A Noite')) shift = 'A Noite';
            else if (shift.includes('B Dia')) shift = 'B Dia';
            else if (shift.includes('B Noite')) shift = 'B Noite';
          }
          if (evolutionLetra !== 'all' && evolutionLetra !== shift) return;

          const dateParts = ev.event_date.split('T')[0].split('-');
          if (dateParts.length >= 2) {
            const evYear = parseInt(dateParts[0]);
            const evMonth = parseInt(dateParts[1]) - 1;
            if (!isNaN(evYear) && !isNaN(evMonth)) {
              const key = `${evYear}-${evMonth}`;
              if (firstHalfMonths.has(key)) firstHalfTotal++;
              else if (secondHalfMonths.has(key)) secondHalfTotal++;
            }
          }
        }
      });

      const avgFirst = firstHalfMonths.size > 0 ? Math.round(firstHalfTotal / firstHalfMonths.size) : 0;
      const avgSecond = secondHalfMonths.size > 0 ? Math.round(secondHalfTotal / Math.max(secondHalfMonths.size, 1)) : 0;

      const calcTrend = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return Math.round(((curr - prev) / prev) * 100);
      };

      const trendMensal = calcTrend(avgSecond, avgFirst);

      return {
        mensal:     { current: avgMensal,     prev: nMonths,     trend: trendMensal,   label: 'eventos/mês',     detail: `${nMonths} mes${nMonths !== 1 ? 'es' : ''} no histórico` },
        trimestral: { current: avgTrimestral,  prev: nQuarters,   trend: trendMensal,   label: 'eventos/trim.',    detail: `${nQuarters} trim. no histórico` },
        semestral:  { current: avgSemestral,   prev: nSemesters,  trend: trendMensal,   label: 'eventos/sem.',     detail: `${nSemesters} sem. no histórico` },
      };
    })();

    return { 
      topLocations, topAreasMinerio, topAreasTpm, topAreasBase, topEquipment, topPeople, dayData, monthTrend, yearData, 
      materialCount, meioAmbienteCount, medicoCount, total: filtered.length,
      topTipos, topAgentes, topPartes, byGenero, byTurno, turnoData, topTst,
      byLetra, letraData, hourlyData, daysWithoutAccident,
      topCids, topAtestados, afastamentoData, danosData, evolutionChartData, consolidations
    };
  }, [filtered, historicalEvolution, evolutionLetra, evolutionPeriod]);

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const match = timeStr.match(/\b(\d{2}):(\d{2})(?::\d{2})?\b/);
    return match ? `${match[1]}h${match[2]}` : timeStr;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-warning" />
            Controle de Eventos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Registro e análise de ocorrências operacionais</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canCreate('eventos') && (
            <label className={isImporting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} disabled={isImporting} />
              <Button variant="outline" size="sm" asChild disabled={isImporting}>
                <span>
                  {isImporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />} 
                  {isImporting ? 'Importando...' : 'Importar'}
                </span>
              </Button>
            </label>
          )}
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />} 
            {isExporting ? 'Exportando...' : 'Exportar'}
          </Button>
          {canDelete('eventos') && (
            <Button variant="outline" size="sm" onClick={() => setDeleteAllConfirm(true)} className="text-destructive hover:bg-destructive hover:text-destructive-foreground">
              <Trash2 className="w-4 h-4 mr-1" />
              Excluir Todos
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fixHistoricalShifts} className="border-dashed" title="Padronizar textos de Letras (Turno) no Banco de Dados">
            <Wrench className="w-4 h-4 mr-1" /> Limpar Base
          </Button>
          <Button variant="outline" size="sm" onClick={handleRestoreSeed} className="border-primary/40 text-primary hover:bg-primary/10 font-semibold" title="Restaurar a base padrão com todos os 63 eventos registrados">
            <RotateCcw className="w-4 h-4 mr-1" /> Restaurar Base (63)
          </Button>
          {canCreate('eventos') && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openCreateModal}>
                  <Plus className="w-4 h-4 mr-1" /> Novo Evento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingEvent ? "Editar Evento" : "Registrar Novo Evento"}</DialogTitle></DialogHeader>
              
              {/* Category Selector */}
              <div className="pt-4 pb-2 border-b border-border">
                <Label className="text-sm font-bold text-primary mb-3 block">Categoria do Evento *</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div 
                    onClick={() => setNewEvent(p => ({ ...p, categoria_evento: 'Material' }))}
                    className={`cursor-pointer rounded-lg border-2 p-3 flex flex-col items-center justify-center gap-2 transition-all ${newEvent.categoria_evento === 'Material' ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-transparent bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                  >
                    <Wrench className="w-5 h-5" />
                    <span className="text-xs font-semibold text-center leading-tight">Evento<br/>Material</span>
                  </div>
                  <div 
                    onClick={() => setNewEvent(p => ({ ...p, categoria_evento: 'Meio Ambiente' }))}
                    className={`cursor-pointer rounded-lg border-2 p-3 flex flex-col items-center justify-center gap-2 transition-all ${newEvent.categoria_evento === 'Meio Ambiente' ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 shadow-sm' : 'border-transparent bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                  >
                    <MapPin className="w-5 h-5" />
                    <span className="text-xs font-semibold text-center leading-tight">Meio<br/>Ambiente</span>
                  </div>
                  <div 
                    onClick={() => setNewEvent(p => ({ ...p, categoria_evento: 'Médico' }))}
                    className={`cursor-pointer rounded-lg border-2 p-3 flex flex-col items-center justify-center gap-2 transition-all ${newEvent.categoria_evento === 'Médico' ? 'border-destructive bg-destructive/5 text-destructive shadow-sm' : 'border-transparent bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                  >
                    <Stethoscope className="w-5 h-5" />
                    <span className="text-xs font-semibold text-center leading-tight">Atendimento<br/>Médico</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input type="date" value={newEvent.event_date} onChange={e => setNewEvent({ ...newEvent, event_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Horário</Label>
                  <FastInput value={newEvent.event_time} onValueChange={v => setNewEvent(p => ({ ...p, event_time: v }))} placeholder="Ex: 14:30" />
                </div>
                
                {/* Common fields for all categories */}
                <div className="space-y-2">
                  <Label>Turno / Letra</Label>
                  <Select value={newEvent.shift} onValueChange={v => setNewEvent(p => ({ ...p, shift: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o turno" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A Dia">A Dia</SelectItem>
                      <SelectItem value="A Noite">A Noite</SelectItem>
                      <SelectItem value="B Dia">B Dia</SelectItem>
                      <SelectItem value="B Noite">B Noite</SelectItem>
                      <SelectItem value="ADM">ADM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nome do Envolvido *</Label>
                  <FastInput value={newEvent.involved_name} onValueChange={v => setNewEvent(p => ({ ...p, involved_name: v }))} placeholder="Nome completo" />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-orange-500" /> Área *</Label>
                  <Select value={newEvent.area} onValueChange={v => setNewEvent(p => ({ ...p, area: v }))}>
                    <SelectTrigger className={`${!newEvent.area ? 'border-orange-400/50 focus:ring-orange-400' : ''}`}>
                      <SelectValue placeholder="Selecione a área de ocorrência" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel className="text-xs font-bold text-primary uppercase tracking-wider">Minério</SelectLabel>
                        <SelectItem value="Área Velha (Minério)">Área Velha</SelectItem>
                        <SelectItem value="Área Nova (Minério)">Área Nova</SelectItem>
                        <SelectItem value="Rota AMT (Minério)">Rota AMT</SelectItem>
                        <SelectItem value="Virador de Vagões (Minério)">Virador de Vagões</SelectItem>
                        <SelectItem value="Píer (Minério)">Píer</SelectItem>
                      </SelectGroup>
                      <SelectGroup className="mt-2">
                        <SelectLabel className="text-xs font-bold text-amber-600 uppercase tracking-wider">TPM</SelectLabel>
                        <SelectItem value="Pátios (TPM)">Pátios</SelectItem>
                        <SelectItem value="Silo (TPM)">Silo</SelectItem>
                        <SelectItem value="Píer (TPM)">Píer</SelectItem>
                      </SelectGroup>
                      <SelectGroup className="mt-2">
                        <SelectLabel className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Apoio / Geral</SelectLabel>
                        <SelectItem value="Base (Apoio)">Base</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Local Específico</Label>
                  <FastInput value={newEvent.location} onValueChange={v => setNewEvent(p => ({ ...p, location: v }))} placeholder="Ex: PÁTIO P - Próximo ao terminal" />
                </div>

                {(newEvent.shift === 'A Noite' || newEvent.shift === 'B Noite') ? (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Encarregado</Label>
                    <FastInput value={newEvent.supervisor1} onValueChange={v => setNewEvent(p => ({ ...p, supervisor1: v, supervisor2: '' }))} placeholder="Nome do Encarregado" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Encarregado 1</Label>
                      <FastInput value={newEvent.supervisor1} onValueChange={v => setNewEvent(p => ({ ...p, supervisor1: v }))} placeholder="Nome do 1º Encarregado" />
                    </div>
                    <div className="space-y-2">
                      <Label>Encarregado 2</Label>
                      <FastInput value={newEvent.supervisor2} onValueChange={v => setNewEvent(p => ({ ...p, supervisor2: v }))} placeholder="Nome do 2º Encarregado" />
                    </div>
                  </>
                )}
                <div className="space-y-2 md:col-span-2">
                  <Label>Técnico de Segurança</Label>
                  <FastInput value={newEvent.tecnico_seguranca} onValueChange={v => setNewEvent(p => ({ ...p, tecnico_seguranca: v }))} placeholder="Nome do TST responsável" />
                </div>

                {/* Conditional Fields: Material */}
                {newEvent.categoria_evento === 'Material' && (
                  <>
                    <div className="space-y-2">
                      <Label>Equipamento</Label>
                      <FastInput value={newEvent.equipment} onValueChange={v => setNewEvent(p => ({ ...p, equipment: v }))} placeholder="Ex: CAMINHÃO PIPA" />
                    </div>
                    <div className="space-y-2">
                      <Label>Placa/TAG</Label>
                      <FastInput value={newEvent.plate_tag} onValueChange={v => setNewEvent(p => ({ ...p, plate_tag: v }))} placeholder="Ex: QRD0980" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <div className="flex items-center gap-2 mt-2">
                        <input type="checkbox" id="danos" className="w-4 h-4 cursor-pointer" checked={newEvent.danos_materiais} onChange={e => setNewEvent(p => ({ ...p, danos_materiais: e.target.checked }))} />
                        <Label htmlFor="danos" className="cursor-pointer">Gerou Danos Materiais</Label>
                      </div>
                    </div>
                  </>
                )}

                {/* Conditional Fields: Meio Ambiente */}
                {newEvent.categoria_evento === 'Meio Ambiente' && (
                  <div className="space-y-2 md:col-span-2">
                     <p className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg border border-border">
                       <AlertTriangle className="w-4 h-4 inline mr-1 text-warning" />
                       Para eventos de meio ambiente, descreva o tipo de substância e volume aproximado do vazamento no campo de descrição abaixo.
                     </p>
                  </div>
                )}

                {/* Conditional Fields: Médico */}
                {newEvent.categoria_evento === 'Médico' && (
                  <>
                    <div className="space-y-2">
                      <Label>Encaminhamento</Label>
                      <Select value={newEvent.encaminhamento_medico} onValueChange={v => setNewEvent(p => ({ ...p, encaminhamento_medico: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione o destino" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Liberado">Liberado p/ Casa / Área</SelectItem>
                          <SelectItem value="Posto da Vale">Posto Médico da Vale</SelectItem>
                          <SelectItem value="Hospital Externo">Hospital Externo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>CID (Opcional)</Label>
                      <FastInput value={newEvent.cid || ''} onValueChange={v => setNewEvent(p => ({ ...p, cid: v }))} placeholder="Ex: S60" />
                    </div>
                    <div className="space-y-2 md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="atestado" className="w-4 h-4 cursor-pointer text-primary" checked={newEvent.atestado} onChange={e => setNewEvent(p => ({ ...p, atestado: e.target.checked }))} />
                        <Label htmlFor="atestado" className="cursor-pointer">Gerou Atestado Médico</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="afastamento" className="w-4 h-4 cursor-pointer text-destructive" checked={newEvent.afastamento} onChange={e => setNewEvent(p => ({ ...p, afastamento: e.target.checked }))} />
                        <Label htmlFor="afastamento" className="cursor-pointer">Com Afastamento</Label>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2 md:col-span-2 mt-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="hora_extra" className="w-4 h-4 cursor-pointer text-primary" checked={newEvent.hora_extra} onChange={e => setNewEvent(p => ({ ...p, hora_extra: e.target.checked }))} />
                    <Label htmlFor="hora_extra" className="cursor-pointer">Colaborador estava em Hora Extra?</Label>
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2 mt-2">
                  <Label>Descrição do Evento *</Label>
                  <FastTextarea rows={4} value={newEvent.description} onValueChange={v => setNewEvent(p => ({ ...p, description: v }))} placeholder="Descreva o evento detalhadamente..." />
                </div>
                <div className="md:col-span-2 mt-4">
                  <Button onClick={handleCreate} className="w-full h-11 text-base font-semibold">Registrar Evento</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </motion.div>

      {/* Painel de Filtros Compacto */}
      {activeTab !== 'metas' && (
        <>
          <div className="bg-card border border-border rounded-xl p-3 mb-6 shadow-sm">
        {/* Linha Principal: Sempre visível */}
        <div className="flex flex-col md:flex-row gap-3">
          <PeriodFilter value={period} onChange={setPeriod} className="md:w-auto shrink-0" />
          
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por descrição, local, equipamento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 w-full bg-background" />
          </div>

          <Button 
            variant={activeFiltersCount > 0 ? "default" : "outline"}
            className="md:w-auto w-full flex items-center gap-2"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            <Filter className="w-4 h-4" />
            Filtros {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            {showAdvancedFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </Button>
        </div>
        
        {/* Filtros Avançados Expansíveis */}
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: 'auto', opacity: 1 }} 
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="relative w-full">
                  <div className="flex items-center gap-2 bg-background border border-input rounded-md px-3 h-10">
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    {selectedEmployee ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {selectedEmployee.foto_url ? (
                          <img src={selectedEmployee.foto_url} className="w-6 h-6 rounded-full object-cover border border-border" alt="" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">{selectedEmployee.nome.charAt(0)}</div>
                        )}
                        <span className="text-sm font-medium truncate">{selectedEmployee.nome}</span>
                        <button onClick={() => { setSelectedEmployee(null); setEmployeeSearch(''); }} className="ml-auto text-muted-foreground hover:text-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <input type="text" placeholder="Filtrar por funcionário..." value={employeeSearch}
                        onChange={e => { setEmployeeSearch(e.target.value); setShowEmpDropdown(true); }}
                        onFocus={() => setShowEmpDropdown(true)}
                        className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground" />
                    )}
                  </div>
                  {showEmpDropdown && filteredSearchEmps.length > 0 && !selectedEmployee && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                      {filteredSearchEmps.map(f => (
                        <button key={f.id} onClick={() => { setSelectedEmployee(f); setEmployeeSearch(''); setShowEmpDropdown(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left">
                          {f.foto_url ? (
                            <img src={f.foto_url} className="w-7 h-7 rounded-full object-cover border border-border" alt="" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">{f.nome.charAt(0)}</div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{f.nome}</p>
                            <p className="text-[10px] text-muted-foreground">{f.cargo} · {f.departamento}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
                  <SelectTrigger className="bg-background"><Filter className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Equipamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Equipamentos</SelectItem>
                    {equipmentTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="bg-background"><MapPin className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Local" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Locais</SelectItem>
                    {locationTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={plateFilter} onValueChange={setPlateFilter}>
                  <SelectTrigger className="bg-background"><Truck className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Placa/TAG" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Placas</SelectItem>
                    {plateTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="bg-background"><Clock className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Horário" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Horários</SelectItem>
                    {timeTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {selectedEmployee && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4 border-l-4 border-l-primary flex items-center gap-4">
          {selectedEmployee.foto_url ? (
            <img src={selectedEmployee.foto_url} className="w-10 h-10 rounded-full object-cover border-2 border-primary/30" alt="" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{selectedEmployee.nome.charAt(0)}</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground">{selectedEmployee.nome}</p>
            <p className="text-sm text-muted-foreground">{selectedEmployee.cargo} · {selectedEmployee.departamento}</p>
          </div>
          <button onClick={() => navigate(`/funcionario/${selectedEmployee.id}`)} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium shrink-0">
            <Eye className="w-3.5 h-3.5" /> Ver Perfil
          </button>
        </motion.div>
      )}
        </>
      )}
            {/* --- DASHBOARD TABS --- */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-8">
        <TabsList className="w-full justify-start h-auto flex-wrap p-1.5 bg-muted/30 rounded-xl mb-6 border border-border">
          <TabsTrigger value="visao-geral" className="px-5 py-2.5 text-sm font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all flex items-center gap-2">
            <Activity className="w-4 h-4" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="operacao" className="px-5 py-2.5 text-sm font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:text-warning data-[state=active]:shadow-sm transition-all flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Operação & Turnos
          </TabsTrigger>
          <TabsTrigger value="sst" className="px-5 py-2.5 text-sm font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:text-destructive data-[state=active]:shadow-sm transition-all flex items-center gap-2">
            <Stethoscope className="w-4 h-4" /> Saúde & Segurança (SST)
          </TabsTrigger>
          <TabsTrigger value="colaboradores" className="px-5 py-2.5 text-sm font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all flex items-center gap-2">
            <User className="w-4 h-4" /> Colaboradores
          </TabsTrigger>
          <TabsTrigger value="treinamentos_ssma" className="px-5 py-2.5 text-sm font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all flex items-center gap-2">
            <Target className="w-4 h-4" /> Treinamentos SSMA
          </TabsTrigger>
          <TabsTrigger value="n3" className="px-5 py-2.5 text-sm font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:text-rose-600 data-[state=active]:shadow-sm transition-all flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> N3
          </TabsTrigger>
        </TabsList>

        {/* 1. VISÃO GERAL */}
        <TabsContent value="visao-geral" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card 
              className={`relative overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none ${typeFilter === 'all' ? 'bg-primary/10 ring-2 ring-primary ring-offset-2' : 'bg-gradient-to-br from-primary/5 to-transparent'} group`}
              onClick={() => { setTypeFilter('all'); scrollToTable(); }}
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors" />
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Total de Eventos</p>
                    <p className="text-4xl font-black text-foreground mt-2">{analytics.total}</p>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5 font-medium"><Calendar className="w-3.5 h-3.5"/> no período selecionado</p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-xl text-primary">
                    <Activity className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className={`relative overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none ${typeFilter === 'Material' ? 'bg-blue-500/10 ring-2 ring-blue-500 ring-offset-2' : 'bg-gradient-to-br from-blue-500/5 to-transparent'} group`}
              onClick={() => { setTypeFilter('Material'); scrollToTable(); }}
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors" />
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Eventos Materiais</p>
                    <p className="text-4xl font-black text-foreground mt-2">{analytics.materialCount}</p>
                    <p className="text-xs text-blue-500 mt-2 font-bold bg-blue-500/10 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      {analytics.total ? ((analytics.materialCount / analytics.total) * 100).toFixed(0) : 0}% do total
                    </p>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                    <Wrench className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`relative overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none ${typeFilter === 'Meio Ambiente' ? 'bg-emerald-500/10 ring-2 ring-emerald-500 ring-offset-2' : 'bg-gradient-to-br from-emerald-500/5 to-transparent'} group`}
              onClick={() => { setTypeFilter('Meio Ambiente'); scrollToTable(); }}
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Meio Ambiente</p>
                    <p className="text-4xl font-black text-foreground mt-2">{analytics.meioAmbienteCount}</p>
                    <p className="text-xs text-emerald-500 mt-2 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {analytics.total ? ((analytics.meioAmbienteCount / analytics.total) * 100).toFixed(0) : 0}% do total
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`relative overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none ${typeFilter === 'Médico' ? 'bg-destructive/10 ring-2 ring-destructive ring-offset-2' : 'bg-gradient-to-br from-destructive/5 to-transparent'} group`}
              onClick={() => { setTypeFilter('Médico'); scrollToTable(); }}
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-destructive" />
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-destructive/10 rounded-full blur-2xl group-hover:bg-destructive/20 transition-colors" />
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Atendimento Médico</p>
                    <p className="text-4xl font-black text-foreground mt-2">{analytics.medicoCount}</p>
                    <p className="text-xs text-destructive mt-2 font-bold bg-destructive/10 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                      <HeartPulse className="w-3 h-3" />
                      {analytics.total ? ((analytics.medicoCount / analytics.total) * 100).toFixed(0) : 0}% do total
                    </p>
                  </div>
                  <div className="p-3 bg-destructive/10 rounded-xl text-destructive">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="relative overflow-hidden cursor-default border-none bg-gradient-to-br from-[hsl(var(--success))]/5 to-transparent group"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-[hsl(var(--success))]" />
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-[hsl(var(--success))]/10 rounded-full blur-2xl group-hover:bg-[hsl(var(--success))]/20 transition-colors" />
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Média Mensal</p>
                    <p className="text-4xl font-black text-foreground mt-2">
                      {analytics.monthTrend.length ? (analytics.total / analytics.monthTrend.length).toFixed(1) : 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5 font-medium"><LucideLineChart className="w-3.5 h-3.5"/> eventos/mês</p>
                  </div>
                  <div className="p-3 bg-[hsl(var(--success))]/10 rounded-xl text-[hsl(var(--success))]">
                    <Zap className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Card className="shadow-sm border-border hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" /> Evolução Mensal de Eventos
                </CardTitle>
                <CardDescription>Acompanhamento histórico da volumetria de eventos registrados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] w-full mt-2">
                  <ExpandableChart title="Evolução Mensal de Eventos">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={analytics.monthTrend} margin={{ top: 25, right: 20, bottom: 5, left: -20 }}>
                        <defs>
                          <linearGradient id="eventGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickMargin={10} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Area type="monotone" dataKey="eventos" name="Eventos Registrados" fill="url(#eventGrad)" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--background))", strokeWidth: 2 }} activeDot={{ r: 6, fill: "hsl(var(--primary))" }}>
                          <LabelList dataKey="eventos" position="top" offset={10} style={{ fontSize: '10px', fontWeight: 'bold', fill: 'hsl(var(--foreground))' }} />
                        </Area>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ExpandableChart>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-primary" /> Comparativo Anual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] mt-2">
                  <ExpandableChart title="Comparativo Anual">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={analytics.yearData} margin={{ top: 25, right: 20, bottom: 5, left: -20 }}>
                        <defs>
                          <linearGradient id="yearGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={12} tickMargin={10} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }} />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        <Bar dataKey="eventos" name="Volume Total" fill="url(#yearGrad)" radius={[8, 8, 0, 0]} maxBarSize={60}>
                          <LabelList dataKey="eventos" position="top" offset={10} style={{ fontSize: '12px', fill: 'hsl(var(--foreground))', fontWeight: 'bold' }} />
                        </Bar>
                        <Line type="monotone" dataKey="eventos" name="Tendência Anual" stroke="hsl(var(--warning))" strokeWidth={3} dot={{ r: 6, fill: "hsl(var(--background))", strokeWidth: 2 }} activeDot={{ r: 8, fill: "hsl(var(--warning))" }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ExpandableChart>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. OPERAÇÃO E TURNOS */}
        <TabsContent value="operacao" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <Card className="shadow-sm border-border hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" /> Principais Locais de Ocorrência
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] mt-2">
                  <ExpandableChart title="Principais Locais">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={analytics.topLocations} 
                          dataKey="value" 
                          nameKey="name" 
                          cx="50%" 
                          cy="50%" 
                          innerRadius="55%" 
                          outerRadius="80%" 
                          paddingAngle={4}
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`} 
                          labelLine={false}
                        >
                          {analytics.topLocations.map((entry, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="transparent" onClick={() => handleChartClick(entry, 'location')} className="cursor-pointer hover:opacity-80 transition-opacity" />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} formatter={(value, entry, index) => `${value} (${analytics.topLocations[index].value})`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ExpandableChart>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Truck className="w-4 h-4 text-warning" /> Por Tipo de Equipamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] mt-2">
                  <ExpandableChart title="Por Tipo de Equipamento">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.topEquipment} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={140} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" name="Eventos" fill="hsl(38, 90%, 50%)" radius={[0, 4, 4, 0]} onClick={(data) => handleChartClick(data, 'equipment')} className="cursor-pointer hover:opacity-80 transition-opacity">
                          <LabelList dataKey="value" position="right" style={{ fontSize: '11px', fontWeight: 'bold', fill: 'hsl(var(--foreground))' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ExpandableChart>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mapas de Calor por Área (Minério, TPM e Apoio/Base - Contrato Porto) em Donut Chart Premium */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {/* Mapa de Calor — Minério */}
            <Card className="shadow-sm border-border hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                    <MapPin className="w-4 h-4 text-primary" /> Minério — Locais de Ocorrência
                  </CardTitle>
                  <span className="text-xs text-primary font-bold bg-primary/10 px-2.5 py-0.5 rounded-full">
                    {analytics.topAreasMinerio.reduce((s, a) => s + a.value, 0)} eventos
                  </span>
                </div>
                <CardDescription className="text-xs mt-0.5">Área Velha, Área Nova, Rota AMT, Virador de Vagões, Píer</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.topAreasMinerio.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="font-medium">Nenhum evento registrado nas áreas de Minério.</p>
                  </div>
                ) : (() => {
                  const MINERIO_COLORS = ['#0284c7', '#0d9488', '#f59e0b', '#ef4444', '#8b5cf6'];
                  return (
                    <div className="h-[270px] relative">
                      <ExpandableChart title="Minério — Locais de Ocorrência" description={`Total de ${analytics.topAreasMinerio.reduce((s, a) => s + a.value, 0)} eventos registrados nas áreas de Minério.`}>
                        <div className="w-full h-full flex flex-col justify-between">
                          <div className="flex-1 w-full min-h-[190px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                                <Pie
                                  data={analytics.topAreasMinerio}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  innerRadius="55%"
                                  outerRadius="80%"
                                  paddingAngle={4}
                                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                  labelLine={false}
                                >
                                  {analytics.topAreasMinerio.map((entry, i) => (
                                    <Cell key={i} fill={MINERIO_COLORS[i % MINERIO_COLORS.length]} stroke="transparent" className="hover:opacity-80 transition-opacity" />
                                  ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-3 border-t border-border shrink-0">
                            {analytics.topAreasMinerio.map((area, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-xs font-semibold">
                                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: MINERIO_COLORS[i % MINERIO_COLORS.length] }} />
                                <span className="text-muted-foreground uppercase text-[11px]">{area.name}</span>
                                <span className="text-foreground font-bold">({area.value})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </ExpandableChart>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Mapa de Calor — TPM */}
            <Card className="shadow-sm border-border hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-700">
                    <MapPin className="w-4 h-4 text-amber-600" /> TPM — Locais de Ocorrência
                  </CardTitle>
                  <span className="text-xs text-amber-700 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                    {analytics.topAreasTpm.reduce((s, a) => s + a.value, 0)} eventos
                  </span>
                </div>
                <CardDescription className="text-xs mt-0.5">Pátios, Silo, Píer</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.topAreasTpm.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="font-medium">Nenhum evento registrado nas áreas da TPM.</p>
                  </div>
                ) : (() => {
                  const TPM_COLORS = ['#ef4444', '#0284c7', '#0d9488', '#f59e0b'];
                  return (
                    <div className="h-[270px] relative">
                      <ExpandableChart title="TPM — Locais de Ocorrência" description={`Total de ${analytics.topAreasTpm.reduce((s, a) => s + a.value, 0)} eventos registrados nas áreas da TPM.`}>
                        <div className="w-full h-full flex flex-col justify-between">
                          <div className="flex-1 w-full min-h-[190px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                                <Pie
                                  data={analytics.topAreasTpm}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  innerRadius="55%"
                                  outerRadius="80%"
                                  paddingAngle={4}
                                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                  labelLine={false}
                                >
                                  {analytics.topAreasTpm.map((entry, i) => (
                                    <Cell key={i} fill={TPM_COLORS[i % TPM_COLORS.length]} stroke="transparent" className="hover:opacity-80 transition-opacity" />
                                  ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-3 border-t border-border shrink-0">
                            {analytics.topAreasTpm.map((area, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-xs font-semibold">
                                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: TPM_COLORS[i % TPM_COLORS.length] }} />
                                <span className="text-muted-foreground uppercase text-[11px]">{area.name}</span>
                                <span className="text-foreground font-bold">({area.value})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </ExpandableChart>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Mapa de Calor — Apoio / Base */}
            <Card className="shadow-sm border-border hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-700">
                    <MapPin className="w-4 h-4 text-emerald-600" /> Base — Locais de Ocorrência
                  </CardTitle>
                  <span className="text-xs text-emerald-700 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                    {analytics.topAreasBase.reduce((s, a) => s + a.value, 0)} eventos
                  </span>
                </div>
                <CardDescription className="text-xs mt-0.5">Base Busato / Instalações de Apoio</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.topAreasBase.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="font-medium">Nenhum evento registrado na Base.</p>
                  </div>
                ) : (() => {
                  const BASE_COLORS = ['#ef4444', '#10b981', '#6366f1'];
                  return (
                    <div className="h-[270px] relative">
                      <ExpandableChart title="Base — Locais de Ocorrência" description={`Total de ${analytics.topAreasBase.reduce((s, a) => s + a.value, 0)} eventos registrados nas instalações de Apoio/Base.`}>
                        <div className="w-full h-full flex flex-col justify-between">
                          <div className="flex-1 w-full min-h-[190px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                                <Pie
                                  data={analytics.topAreasBase}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  innerRadius="55%"
                                  outerRadius="80%"
                                  paddingAngle={4}
                                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                  labelLine={false}
                                >
                                  {analytics.topAreasBase.map((entry, i) => (
                                    <Cell key={i} fill={BASE_COLORS[i % BASE_COLORS.length]} stroke="transparent" className="hover:opacity-80 transition-opacity" />
                                  ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-3 border-t border-border shrink-0">
                            {analytics.topAreasBase.map((area, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-xs font-semibold">
                                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: BASE_COLORS[i % BASE_COLORS.length] }} />
                                <span className="text-muted-foreground uppercase text-[11px]">{area.name}</span>
                                <span className="text-foreground font-bold">({area.value})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </ExpandableChart>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 mb-6">
            <Card className="border-t-4 border-t-primary shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" /> 
                    Evolução Eventos Materiais por Letra (Histórico Completo)
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">Filtrar Letra:</span>
                    <select
                      className="h-8 text-xs rounded-md border border-input bg-background px-3 py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={evolutionLetra}
                      onChange={(e) => setEvolutionLetra(e.target.value)}
                    >
                      <option value="all">Todas as Letras</option>
                      <option value="A Dia">A Dia</option>
                      <option value="A Noite">A Noite</option>
                      <option value="B Dia">B Dia</option>
                      <option value="B Noite">B Noite</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2 mt-2">
                  {/* Mensal */}
                  <div 
                    onClick={() => setEvolutionPeriod('mensal')}
                    className={`cursor-pointer rounded-xl p-4 border relative overflow-hidden group hover:shadow-md transition-all ${evolutionPeriod === 'mensal' ? 'bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/50 ring-1 ring-blue-500/20' : 'bg-muted/30 border-border hover:bg-blue-500/5'}`}
                  >
                    <div className="absolute right-0 top-0 opacity-10 group-hover:opacity-20 transition-opacity"><Calendar className={`w-24 h-24 -mt-4 -mr-4 ${evolutionPeriod === 'mensal' ? 'text-blue-500' : 'text-muted-foreground'}`} /></div>
                    <p className={`text-[11px] font-bold mb-1 uppercase tracking-wider ${evolutionPeriod === 'mensal' ? 'text-blue-600/80' : 'text-muted-foreground'}`}>Média Mensal</p>
                    <div className="flex items-end gap-2">
                      <span className={`text-3xl font-black tracking-tight ${evolutionPeriod === 'mensal' ? 'text-blue-600' : 'text-foreground'}`}>{analytics.consolidations.mensal.current}</span>
                      <span className="text-xs font-semibold text-muted-foreground pb-1.5 uppercase">eventos/mês</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs font-medium">
                      <div className="flex items-center gap-1.5">
                        {analytics.consolidations.mensal.trend > 0 ? (
                          <span className="text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded flex items-center"><TrendingUp className="w-3 h-3 mr-1"/> +{analytics.consolidations.mensal.trend}%</span>
                        ) : analytics.consolidations.mensal.trend < 0 ? (
                          <span className="text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center"><TrendingDown className="w-3 h-3 mr-1"/> {analytics.consolidations.mensal.trend}%</span>
                        ) : (
                          <span className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded">— 0%</span>
                        )}
                        <span className="text-muted-foreground/70">tend. hist.</span>
                      </div>
                      <span className={`text-[10px] font-bold ${evolutionPeriod === 'mensal' ? 'text-blue-600/40' : 'text-muted-foreground/40'}`}>{analytics.consolidations.mensal.detail}</span>
                    </div>
                  </div>

                  {/* Trimestral */}
                  <div 
                    onClick={() => setEvolutionPeriod('trimestral')}
                    className={`cursor-pointer rounded-xl p-4 border relative overflow-hidden group hover:shadow-md transition-all ${evolutionPeriod === 'trimestral' ? 'bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/50 ring-1 ring-indigo-500/20' : 'bg-muted/30 border-border hover:bg-indigo-500/5'}`}
                  >
                    <div className="absolute right-0 top-0 opacity-10 group-hover:opacity-20 transition-opacity"><BarChart3 className={`w-24 h-24 -mt-4 -mr-4 ${evolutionPeriod === 'trimestral' ? 'text-indigo-500' : 'text-muted-foreground'}`} /></div>
                    <p className={`text-[11px] font-bold mb-1 uppercase tracking-wider ${evolutionPeriod === 'trimestral' ? 'text-indigo-600/80' : 'text-muted-foreground'}`}>Média Trimestral</p>
                    <div className="flex items-end gap-2">
                      <span className={`text-3xl font-black tracking-tight ${evolutionPeriod === 'trimestral' ? 'text-indigo-600' : 'text-foreground'}`}>{analytics.consolidations.trimestral.current}</span>
                      <span className="text-xs font-semibold text-muted-foreground pb-1.5 uppercase">eventos/trim.</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs font-medium">
                      <div className="flex items-center gap-1.5">
                        {analytics.consolidations.trimestral.trend > 0 ? (
                          <span className="text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded flex items-center"><TrendingUp className="w-3 h-3 mr-1"/> +{analytics.consolidations.trimestral.trend}%</span>
                        ) : analytics.consolidations.trimestral.trend < 0 ? (
                          <span className="text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center"><TrendingDown className="w-3 h-3 mr-1"/> {analytics.consolidations.trimestral.trend}%</span>
                        ) : (
                          <span className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded">— 0%</span>
                        )}
                        <span className="text-muted-foreground/70">tend. hist.</span>
                      </div>
                      <span className={`text-[10px] font-bold ${evolutionPeriod === 'trimestral' ? 'text-indigo-600/40' : 'text-muted-foreground/40'}`}>{analytics.consolidations.trimestral.detail}</span>
                    </div>
                  </div>

                  {/* Semestral */}
                  <div 
                    onClick={() => setEvolutionPeriod('semestral')}
                    className={`cursor-pointer rounded-xl p-4 border relative overflow-hidden group hover:shadow-md transition-all ${evolutionPeriod === 'semestral' ? 'bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/50 ring-1 ring-violet-500/20' : 'bg-muted/30 border-border hover:bg-violet-500/5'}`}
                  >
                    <div className="absolute right-0 top-0 opacity-10 group-hover:opacity-20 transition-opacity"><Activity className={`w-24 h-24 -mt-4 -mr-4 ${evolutionPeriod === 'semestral' ? 'text-violet-500' : 'text-muted-foreground'}`} /></div>
                    <p className={`text-[11px] font-bold mb-1 uppercase tracking-wider ${evolutionPeriod === 'semestral' ? 'text-violet-600/80' : 'text-muted-foreground'}`}>Média Semestral</p>
                    <div className="flex items-end gap-2">
                      <span className={`text-3xl font-black tracking-tight ${evolutionPeriod === 'semestral' ? 'text-violet-600' : 'text-foreground'}`}>{analytics.consolidations.semestral.current}</span>
                      <span className="text-xs font-semibold text-muted-foreground pb-1.5 uppercase">eventos/sem.</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs font-medium">
                      <div className="flex items-center gap-1.5">
                        {analytics.consolidations.semestral.trend > 0 ? (
                          <span className="text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded flex items-center"><TrendingUp className="w-3 h-3 mr-1"/> +{analytics.consolidations.semestral.trend}%</span>
                        ) : analytics.consolidations.semestral.trend < 0 ? (
                          <span className="text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center"><TrendingDown className="w-3 h-3 mr-1"/> {analytics.consolidations.semestral.trend}%</span>
                        ) : (
                          <span className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded">— 0%</span>
                        )}
                        <span className="text-muted-foreground/70">tend. hist.</span>
                      </div>
                      <span className={`text-[10px] font-bold ${evolutionPeriod === 'semestral' ? 'text-violet-600/40' : 'text-muted-foreground/40'}`}>{analytics.consolidations.semestral.detail}</span>
                    </div>
                  </div>
                </div>
                <div className="h-[340px] w-full mt-4">
                  <ExpandableChart title="Evolução Eventos Materiais por Letra">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.evolutionChartData.chartData} margin={{ top: 25, right: 30, bottom: 10, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3', strokeOpacity: 0.4 }} />
                        <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '11px', fontWeight: 600 }} iconType="circle" />
                        {analytics.evolutionChartData.letrasList
                          .filter(letra => evolutionLetra === 'all' || evolutionLetra === letra)
                          .map((letra, idx) => {
                            const color = LETRA_COLORS_MAP[letra] || FALLBACK_LETRA_COLORS[idx % FALLBACK_LETRA_COLORS.length];
                            return (
                              <Line
                                key={letra}
                                type="monotone"
                                dataKey={letra}
                                name={letra.toUpperCase()}
                                stroke={color}
                                strokeWidth={3}
                                dot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--background))" }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                              >
                                <LabelList
                                  dataKey={letra}
                                  position="top"
                                  style={{ fontSize: '10px', fontWeight: 700, fill: color }}
                                  formatter={(val: number) => (val > 0 ? val : '')}
                                />
                              </Line>
                            );
                          })}
                      </LineChart>
                    </ResponsiveContainer>
                  </ExpandableChart>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#eb7d5b]" /> Horário dos Eventos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] w-full mt-2">
                  <ExpandableChart title="Horário dos Eventos">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.hourlyData} margin={{ top: 25, right: 20, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.2 }} />
                        <Bar dataKey="count" fill="#eb7d5b" radius={[4, 4, 0, 0]}>
                          <LabelList dataKey="count" position="top" style={{ fontSize: '11px', fill: 'var(--foreground)', fontWeight: 'bold' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ExpandableChart>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-warning" /> Por Dia da Semana
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] mt-2">
                  <ExpandableChart title="Por Dia da Semana">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.dayData} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.2 }} />
                        <Bar dataKey="eventos" name="Eventos" radius={[4, 4, 0, 0]}>
                          <LabelList dataKey="eventos" position="top" style={{ fontSize: '11px', fill: 'var(--foreground)', fontWeight: 'bold' }} />
                          {analytics.dayData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ExpandableChart>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#4472c4]" /> Eventos por Letra (Turno)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] w-full mt-2">
                  <ExpandableChart title="Eventos por Letra">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.letraData} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.2 }} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          <LabelList dataKey="value" position="top" style={{ fontSize: '11px', fill: 'var(--foreground)', fontWeight: 'bold' }} />
                          {analytics.letraData?.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ExpandableChart>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
{/* 3. SAÚDE & SEGURANÇA (SST) */}
        <TabsContent value="sst" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card 
              className={`relative overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none ${typeFilter === 'Meio Ambiente' ? 'bg-emerald-500/10 ring-2 ring-emerald-500 ring-offset-2' : 'bg-gradient-to-br from-emerald-500/5 to-transparent'} group`}
              onClick={() => { setTypeFilter('Meio Ambiente'); scrollToTable(); }}
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Meio Ambiente</p>
                    <p className="text-4xl font-black text-foreground mt-2">{analytics.meioAmbienteCount}</p>
                    <p className="text-xs text-emerald-500 mt-2 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {analytics.total ? ((analytics.meioAmbienteCount / analytics.total) * 100).toFixed(0) : 0}% do total
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`relative overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none ${typeFilter === 'Médico' ? 'bg-red-500/10 ring-2 ring-red-500 ring-offset-2' : 'bg-gradient-to-br from-red-500/5 to-transparent'} group`}
              onClick={() => { setTypeFilter('Médico'); scrollToTable(); }}
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500" />
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-colors" />
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Atendimento Médico</p>
                    <p className="text-4xl font-black text-foreground mt-2">{analytics.medicoCount}</p>
                    <p className="text-xs text-red-500 mt-2 font-bold bg-red-500/10 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                      <HeartPulse className="w-3 h-3" />
                      {analytics.total ? ((analytics.medicoCount / analytics.total) * 100).toFixed(0) : 0}% do total
                    </p>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-xl text-red-500">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none bg-gradient-to-br from-emerald-500/10 to-transparent shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
              <CardContent className="p-6 flex flex-col justify-center items-center text-center h-full">
                <p className="text-xs text-emerald-700 font-bold uppercase tracking-wider">Status de Segurança</p>
                <p className="text-4xl font-black text-emerald-600 mt-2">{analytics.daysWithoutAccident}</p>
                <p className="text-xs text-muted-foreground font-medium uppercase mt-2">Dias sem Ocorrências</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-destructive" /> Top CIDs (Doenças/Lesões)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  {analytics.topCids.length > 0 ? (
                    <ExpandableChart title="Top CIDs">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.topCids} layout="vertical" margin={{ left: 0, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 88%)" vertical={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} />
                          <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={50} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="value" fill="hsl(0, 68%, 50%)" radius={[0, 4, 4, 0]}>
                            <LabelList dataKey="value" position="right" style={{ fontSize: '10px' }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ExpandableChart>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Sem dados de CID</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" /> Severidade dos Eventos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  {analytics.danosData.length > 0 ? (
                    <ExpandableChart title="Eventos com Danos">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={analytics.danosData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="50%" outerRadius="80%">
                            {analytics.danosData.map((d: { fill: string }, i: number) => <Cell key={i} fill={d.fill} />)}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: "10px" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ExpandableChart>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Sem dados</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Proporção de Afastamentos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  {analytics.afastamentoData.length > 0 ? (
                    <ExpandableChart title="Afastamentos">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={analytics.afastamentoData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="50%" outerRadius="80%">
                            {analytics.afastamentoData.map((d: { fill: string }, i: number) => <Cell key={i} fill={d.fill} />)}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: "10px" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ExpandableChart>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Sem dados</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Top 10 Atestados Médicos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[250px] overflow-y-auto px-4 pb-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-8 text-xs">Colaborador</TableHead>
                        <TableHead className="h-8 text-xs text-right">Qtd de Atestados</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.topAtestados.length === 0 ? (
                        <TableRow><TableCell colSpan={2} className="text-center text-xs text-muted-foreground py-6">Nenhum atestado registrado</TableCell></TableRow>
                      ) : (
                        analytics.topAtestados.map((a, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs py-2">{a.name}</TableCell>
                            <TableCell className="text-xs py-2 text-right font-medium">{a.count}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="colaboradores" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-[#3b82f6]" /> Colaboradores com Maior Reincidência de Eventos
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Todos os tipos de evento por colaborador no período selecionado</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 mb-4">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#3b82f6]" /><span className="text-xs text-muted-foreground font-medium">Material</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#ef4444]" /><span className="text-xs text-muted-foreground font-medium">Médico</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#10b981]" /><span className="text-xs text-muted-foreground font-medium">Meio Ambiente</span></div>
              </div>
              <div className="h-[480px]">
                <ExpandableChart title="Colaboradores com Maior Reincidência">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.topPeople} layout="vertical" margin={{ top: 5, right: 55, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 88%)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={170} />
                      <Tooltip
                        content={(props) => {
                          if (!props.active || !props.payload?.length) return null;
                          const data = props.payload[0]?.payload;
                          const total = (data?.Material || 0) + (data?.Médico || 0) + (data?.['Meio Ambiente'] || 0);
                          return (
                            <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs">
                              <p className="font-bold text-foreground mb-2">{props.label}</p>
                              {(data?.Material > 0) && <p style={{ color: '#3b82f6' }} className="font-medium">Material: {data.Material}</p>}
                              {(data?.Médico > 0) && <p style={{ color: '#ef4444' }} className="font-medium">Médico: {data.Médico}</p>}
                              {(data?.['Meio Ambiente'] > 0) && <p style={{ color: '#10b981' }} className="font-medium">Meio Ambiente: {data['Meio Ambiente']}</p>}
                              <p className="text-muted-foreground mt-1 border-t border-border pt-1">Total: <strong>{total}</strong></p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="Material" name="Material" stackId="a" fill="#3b82f6" onClick={(data) => handleChartClick(data, 'person')} className="cursor-pointer">
                        <LabelList dataKey="Material" position="insideRight" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#fff' }} formatter={(v: number) => v > 0 ? v : ''} />
                      </Bar>
                      <Bar dataKey="Médico" name="Médico" stackId="a" fill="#ef4444" onClick={(data) => handleChartClick(data, 'person')} className="cursor-pointer">
                        <LabelList dataKey="Médico" position="insideRight" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#fff' }} formatter={(v: number) => v > 0 ? v : ''} />
                      </Bar>
                      <Bar dataKey="Meio Ambiente" name="Meio Ambiente" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} onClick={(data) => handleChartClick(data, 'person')} className="cursor-pointer">
                        <LabelList dataKey="total" position="right" style={{ fontSize: '12px', fontWeight: 'bold', fill: 'hsl(var(--foreground))' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ExpandableChart>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Eventos por Técnico de Segurança (TST)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ExpandableChart title="Eventos por Técnico de Segurança">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.topTst} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 88%)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Eventos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="value" position="top" style={{ fontSize: '11px', fontWeight: 'bold' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ExpandableChart>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. TREINAMENTOS SSMA */}
        <TabsContent value="treinamentos_ssma" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <TreinamentosSSMA />
        </TabsContent>

        {/* 6. N3 */}
        <TabsContent value="n3" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <N3Dashboard globalPeriod={period} />
        </TabsContent>
      </Tabs>

      {/* Events Table */}
      {activeTab !== 'treinamentos_ssma' && activeTab !== 'metas' && (
        <Card id="events-table" className="scroll-mt-24">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>
              Registro de Eventos ({filtered.length})
              {typeFilter !== 'all' && (
                <span className={`ml-3 text-xs px-2 py-1 rounded-full ${typeFilter === 'Material' ? 'bg-blue-500/20 text-blue-600' : typeFilter === 'Meio Ambiente' ? 'bg-emerald-500/20 text-emerald-600' : 'bg-destructive/20 text-destructive-foreground'}`}>
                  Filtro: {typeFilter === 'Material' ? 'Eventos Materiais' : typeFilter === 'Meio Ambiente' ? 'Eventos de Meio Ambiente' : 'Atendimentos Médicos'}
                </span>
              )}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhum evento encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">
                      <div className="flex items-center justify-between">
                        Data
                        <Select value={dateFilter} onValueChange={setDateFilter}>
                          <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent shadow-none focus:ring-0 [&>svg:not(:first-child)]:hidden">
                            <Filter className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {dateTypes.map(t => <SelectItem key={t} value={t}>{t.split('-').reverse().join('/')}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableHead>
                    <TableHead className="w-[80px]">
                      <div className="flex items-center justify-between">
                        Hora
                        <Select value={timeFilter} onValueChange={setTimeFilter}>
                          <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent shadow-none focus:ring-0 [&>svg:not(:first-child)]:hidden">
                            <Filter className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {timeTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableHead>
                    <TableHead className="w-[90px]">
                      <div className="flex items-center justify-between">
                        Letra
                        <Select value={shiftFilter} onValueChange={setShiftFilter}>
                          <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent shadow-none focus:ring-0 [&>svg:not(:first-child)]:hidden">
                            <Filter className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            <SelectItem value="A Dia">A Dia</SelectItem>
                            <SelectItem value="A Noite">A Noite</SelectItem>
                            <SelectItem value="B Dia">B Dia</SelectItem>
                            <SelectItem value="B Noite">B Noite</SelectItem>
                            <SelectItem value="ADM">ADM</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center justify-between gap-2 max-w-[150px]">
                        Envolvido
                        <Select value={involvedFilter} onValueChange={setInvolvedFilter}>
                          <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent shadow-none focus:ring-0 [&>svg:not(:first-child)]:hidden">
                            <Filter className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {involvedTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      <div className="flex items-center justify-between gap-2 max-w-[150px]">
                        Equipamento
                        <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
                          <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent shadow-none focus:ring-0 [&>svg:not(:first-child)]:hidden">
                            <Filter className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {equipmentTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      <div className="flex items-center justify-between gap-2 max-w-[100px]">
                        Placa
                        <Select value={plateFilter} onValueChange={setPlateFilter}>
                          <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent shadow-none focus:ring-0 [&>svg:not(:first-child)]:hidden">
                            <Filter className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {plateTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">
                      <div className="flex items-center justify-between gap-2 max-w-[150px]">
                        Local
                        <Select value={locationFilter} onValueChange={setLocationFilter}>
                          <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent shadow-none focus:ring-0 [&>svg:not(:first-child)]:hidden">
                            <Filter className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {locationTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 100).map((ev) => {
                    const isMedical = ev.location?.toUpperCase().includes('ATENDIMENTO MÉDICO') || ev.location?.toUpperCase().includes('PROBLEMA PARTICULAR') || ev.atendimento_medico || ev.atestado || ev.afastamento || !!ev.cid || ev.categoria_evento === 'Médico';
                    const cat = ev.categoria_evento || (isMedical ? 'Médico' : 'Material');

                    const rowBgClass = cat === 'Médico' 
                      ? 'bg-red-500/10 hover:bg-red-500/20 border-l-4 border-l-red-500' 
                      : cat === 'Meio Ambiente'
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-l-4 border-l-emerald-500'
                      : 'bg-blue-500/10 hover:bg-blue-500/20 border-l-4 border-l-blue-500';

                    const expandBgClass = cat === 'Médico'
                      ? 'bg-red-500/15 border-l-4 border-l-red-500'
                      : cat === 'Meio Ambiente'
                      ? 'bg-emerald-500/15 border-l-4 border-l-emerald-500'
                      : 'bg-blue-500/15 border-l-4 border-l-blue-500';

                    return (
                    <Fragment key={ev.id}>
                      <TableRow className={`cursor-pointer transition-colors ${rowBgClass}`} onClick={() => setExpandedRow(expandedRow === ev.id ? null : ev.id)}>
                        <TableCell className="text-xs font-medium">{new Date(ev.event_date + 'T12:00').toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="text-xs">{formatTime(ev.event_time)}</TableCell>
                        <TableCell className="text-xs text-center font-bold">
                          {ev.shift || '—'}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{ev.involved_name}</TableCell>
                        <TableCell className="text-xs hidden md:table-cell">
                          {ev.equipment && ev.equipment !== 'NA' ? (
                            <Badge variant="secondary" className="text-[10px]">{ev.equipment}</Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs hidden md:table-cell">{ev.plate_tag || '—'}</TableCell>
                        <TableCell className="text-xs hidden lg:table-cell truncate max-w-[200px]" title={ev.location}>{ev.location || '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDetailEvent(ev); }}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            {canEdit('eventos') && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); openEditModal(ev); }}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {canDelete('eventos') && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteEvent(ev); }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {expandedRow === ev.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </TableCell>
                      </TableRow>
                      <AnimatePresence>
                        {expandedRow === ev.id && (
                          <TableRow key={`${ev.id}-expand`}>
                            <TableCell colSpan={8} className={`p-4 ${expandBgClass}`}>
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                <p className="text-xs text-foreground leading-relaxed font-medium">{ev.description}</p>
                                <div className="flex flex-wrap gap-4 mt-3 text-[11px] text-muted-foreground">
                                  {ev.day_of_week && <span>📅 {ev.day_of_week}</span>}
                                  {ev.supervisor && <span>👤 Enc.: {ev.supervisor}</span>}
                                  {ev.tecnico_seguranca && <span>🛡️ Tec. Seg.: {ev.tecnico_seguranca}</span>}
                                  {ev.shift && <span>🔄 Turno: {ev.shift}</span>}
                                  {ev.contract && <span>📋 Contrato: {ev.contract}</span>}
                                </div>
                              </motion.div>
                            </TableCell>
                          </TableRow>
                        )}
                      </AnimatePresence>
                    </Fragment>
                  );
                })}
                </TableBody>
              </Table>
              {filtered.length > 100 && (
                <p className="text-xs text-center text-muted-foreground py-3">Exibindo 100 de {filtered.length} eventos. Use filtros para refinar.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailEvent} onOpenChange={(open) => !open && setDetailEvent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Detalhes do Evento</DialogTitle></DialogHeader>
          {detailEvent && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground">Data</Label><p className="font-medium">{new Date(detailEvent.event_date + 'T12:00').toLocaleDateString('pt-BR')}</p></div>
                <div><Label className="text-muted-foreground">Horário</Label><p className="font-medium">{detailEvent.event_time || '—'}</p></div>
                <div><Label className="text-muted-foreground">Envolvido</Label><p className="font-medium">{detailEvent.involved_name}</p></div>
                <div><Label className="text-muted-foreground">Equipamento</Label><p className="font-medium">{detailEvent.equipment || '—'}</p></div>
                <div><Label className="text-muted-foreground">Placa/TAG</Label><p className="font-medium">{detailEvent.plate_tag || '—'}</p></div>
                <div><Label className="text-muted-foreground">Área</Label><p className="font-medium font-bold text-orange-600">{detailEvent.area || '—'}</p></div>
                <div><Label className="text-muted-foreground">Local Específico</Label><p className="font-medium">{detailEvent.location || '—'}</p></div>
                <div><Label className="text-muted-foreground">Tipo</Label><p className="font-medium">{detailEvent.tipo_acidente || '—'}</p></div>
                <div><Label className="text-muted-foreground">Agente da Lesão</Label><p className="font-medium">{detailEvent.agente_lesao || '—'}</p></div>
                <div><Label className="text-muted-foreground">Parte do Corpo</Label><p className="font-medium">{detailEvent.parte_corpo || '—'}</p></div>
                <div><Label className="text-muted-foreground">Gênero</Label><p className="font-medium">{detailEvent.genero_envolvido || '—'}</p></div>
                <div><Label className="text-muted-foreground">Turno</Label><p className="font-medium">{detailEvent.shift || '—'}</p></div>
                {(() => {
                  const s = detailEvent.supervisor || '';
                  const s1 = s.includes(' / ') ? s.split(' / ')[0].trim() : s.includes(' - ') ? s.split(' - ')[0].trim() : s;
                  const s2 = s.includes(' / ') ? s.split(' / ').slice(1).join(' / ').trim() : s.includes(' - ') ? s.split(' - ').slice(1).join(' - ').trim() : '';
                  return (
                    <>
                      <div><Label className="text-muted-foreground">Encarregado 1</Label><p className="font-medium">{s1 || '—'}</p></div>
                      <div><Label className="text-muted-foreground">Encarregado 2</Label><p className="font-medium">{s2 || '—'}</p></div>
                    </>
                  );
                })()}
                <div><Label className="text-muted-foreground">Técnico de Segurança</Label><p className="font-medium">{detailEvent.tecnico_seguranca || '—'}</p></div>
                <div><Label className="text-muted-foreground">Hora Extra</Label><p className="font-medium">{detailEvent.hora_extra ? 'Sim' : 'Não'}</p></div>
              </div>
              <div>
                <Label className="text-muted-foreground">Descrição</Label>
                <p className="mt-1 text-foreground leading-relaxed bg-muted/50 rounded-lg p-3">{detailEvent.description}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteEvent} onOpenChange={(open) => !open && setDeleteEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Evento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este evento de "{deleteEvent?.involved_name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteAllConfirm} onOpenChange={setDeleteAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Todos os Eventos</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir TODOS os {events.length} eventos registrados? Esta ação não pode ser desfeita e removerá todos os dados do painel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAll}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} disabled={isDeletingAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeletingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Sim, Excluir Todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
