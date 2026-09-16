import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, Wrench, Activity, BarChart3, Plus, Search, Filter, Download,
  Upload, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2,
  Clock, MapPin, Eye, Pencil, Trash2, FileText, Calendar, TrendingUp,
  TrendingDown, Settings, ClipboardList, Shield, Zap, Package,
  CircleDot, Radio, Loader2, X, Save, ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { writeExcelFile } from '@/lib/excel';
import {
  CCO_EQUIPAMENTOS_SEED, CCO_DF_SEED, CCO_MINIS_SEED,
  CCO_FMDS_SEED, CCO_PLANEJAMENTO_SEED
} from '@/data/seedCCO';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CcoEquipamento {
  id: string;
  equipamento: string;
  placa: string;
  tipo: string;
  area: string;
  situacao: string;
  local: string;
  status_atual?: string;
  observacao?: string;
  created_at?: string;
}

interface CcoDiarioDF {
  id: string;
  data: string;
  equipamento: string;
  local: string;
  area: string;
  fidelizacao: string;
  os: string;
  turno: string;
  letra: string;
  profissional_titular: string;
  status: string;
  horario_inicio: string;
  horario_termino: string;
  total_horas: number;
  total_minutos: number;
  hora_chegada: string;
  atraso_horas: number;
  atraso_minutos: number;
  executado_minutos: number;
  df_percent: number;
  encarregado_1?: string;
  encarregado_2?: string;
  created_at?: string;
}

interface CcoMini {
  id: string;
  equipamento: string;
  area: string;
  tag: string;
  modelo: string;
  situacao: string;
  status: string;
  observacao: string;
  manutencao: string;
  rastreador: string;
  updated_at?: string;
}

interface CcoFmds {
  id: string;
  equipamento: string;
  df_status: string;
  justificativa: string;
  data?: string;
  created_at?: string;
}

interface CcoPlanejamento {
  id: string;
  data: string;
  equipamento: string;
  local_planejado: string;
  local_executado: string;
  status: string;
  observacao: string;
  created_at?: string;
}

// ─── Color constants ──────────────────────────────────────────────────────────

const CHART_COLORS = [
  'hsl(210, 85%, 55%)', 'hsl(145, 65%, 42%)', 'hsl(38, 90%, 52%)', 'hsl(0, 68%, 52%)',
  'hsl(270, 65%, 58%)', 'hsl(180, 55%, 42%)', 'hsl(330, 65%, 52%)', 'hsl(28, 85%, 52%)',
];

const STATUS_COLORS: Record<string, string> = {
  ATUANDO: 'hsl(145, 65%, 42%)',
  DISPONÍVEL: 'hsl(210, 85%, 55%)',
  MANUTENÇÃO: 'hsl(38, 90%, 52%)',
  RESERVA: 'hsl(270, 65%, 58%)',
  ATIVO: 'hsl(145, 65%, 42%)',
  CANCELADO: 'hsl(0, 68%, 52%)',
  EXECUTADO: 'hsl(145, 65%, 42%)',
  PARCIAL: 'hsl(38, 90%, 52%)',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function dfColor(pct: number) {
  if (pct >= 95) return 'text-emerald-400';
  if (pct >= 80) return 'text-yellow-400';
  return 'text-red-400';
}

function dfBg(pct: number) {
  if (pct >= 95) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (pct >= 80) return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
  return 'bg-red-500/15 text-red-400 border-red-500/30';
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    ATUANDO: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    DISPONÍVEL: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    MANUTENÇÃO: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    RESERVA: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    FIDELIZADA: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    ATIVO: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    EXECUTADO: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    CANCELADO: 'bg-red-500/15 text-red-400 border-red-500/30',
    PARCIAL: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  };
  return map[s] || 'bg-slate-500/15 text-slate-400 border-slate-500/30';
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: {name: string; value: number; color?: string}[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-2xl p-3 text-xs backdrop-blur-sm">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, trend, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; trend?: number; color: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <div>
        <div className="text-3xl font-bold text-foreground leading-none">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend)}% vs. ontem
        </div>
      )}
    </motion.div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({ dfRecords, equipamentos, minis, fmds }: {
  dfRecords: CcoDiarioDF[]; equipamentos: CcoEquipamento[];
  minis: CcoMini[]; fmds: CcoFmds[];
}) {
  const totalEquip = equipamentos.filter(e => e.situacao === 'ATIVO').length;
  const emManutencao = minis.filter(m => m.status === 'MANUTENÇÃO').length;
  const emReserva = equipamentos.filter(e => e.situacao === 'RESERVA').length + minis.filter(m => m.situacao === 'RESERVA').length;
  const dfMedio = dfRecords.length > 0 ? dfRecords.reduce((s, r) => s + (r.df_percent || 0), 0) / dfRecords.length : 0;
  const fmdsOk = fmds.filter(f => f.df_status === 'SIM').length;
  const fmdsNok = fmds.filter(f => f.df_status === 'NÃO').length;

  // DF by letra
  const dfByLetra = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    dfRecords.forEach(r => {
      const k = `${r.letra} ${r.turno}`;
      if (!map[k]) map[k] = { total: 0, count: 0 };
      map[k].total += r.df_percent;
      map[k].count += 1;
    });
    return Object.entries(map).map(([name, v]) => ({ name, df: parseFloat((v.total / v.count).toFixed(1)) }));
  }, [dfRecords]);

  // DF by equipamento (top atrasos)
  const topAtrasos = useMemo(() => {
    return [...dfRecords]
      .filter(r => r.atraso_minutos > 0)
      .sort((a, b) => b.atraso_minutos - a.atraso_minutos)
      .slice(0, 8)
      .map(r => ({
        name: r.equipamento.replace('CAMINHÃO ', '').replace('MINI CARREGADEIRA ', 'MC ').slice(0, 20),
        atraso: r.atraso_minutos,
        df: parseFloat(r.df_percent.toFixed(1)),
      }));
  }, [dfRecords]);

  // Status pie for minis
  const minisPie = useMemo(() => {
    const map: Record<string, number> = {};
    minis.forEach(m => { map[m.status] = (map[m.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [minis]);

  // Tipo breakdown
  const tipoBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    equipamentos.forEach(e => { map[e.tipo] = (map[e.tipo] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name: name.replace('CAMINHÃO ', '').slice(0, 18), value }));
  }, [equipamentos]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Equipamentos Ativos" value={totalEquip} sub="frota porto" icon={Truck} color="bg-blue-500/10 text-blue-400" />
        <KpiCard label="DF Médio" value={`${dfMedio.toFixed(1)}%`} sub={`${dfRecords.length} registros`} icon={Activity} color={dfMedio >= 95 ? 'bg-emerald-500/10 text-emerald-400' : dfMedio >= 80 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'} />
        <KpiCard label="Em Manutenção" value={emManutencao} sub="equipamentos parados" icon={Wrench} color="bg-amber-500/10 text-amber-400" />
        <KpiCard label="Reservas" value={emReserva} sub="disponíveis" icon={Package} color="bg-purple-500/10 text-purple-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KpiCard label="FMDS Conformes" value={`${fmdsOk}/${fmds.length}`} sub={`${fmdsNok} não conformes`} icon={Shield} color="bg-emerald-500/10 text-emerald-400" />
        <KpiCard label="Com Atraso Hoje" value={dfRecords.filter(r => r.atraso_minutos > 0).length} sub={`de ${dfRecords.length} registros`} icon={Clock} color="bg-orange-500/10 text-orange-400" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* DF por Letra/Turno */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">DF Médio por Letra/Turno</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dfByLetra} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="df" name="DF%" radius={[6, 6, 0, 0]}>
                {dfByLetra.map((entry, i) => (
                  <Cell key={i} fill={entry.df >= 95 ? 'hsl(145,65%,42%)' : entry.df >= 80 ? 'hsl(38,90%,52%)' : 'hsl(0,68%,52%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Atrasos */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Maiores Atrasos (minutos)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topAtrasos} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="atraso" name="Atraso (min)" fill="hsl(38,90%,52%)" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Status Minis */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Status Minis</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={minisPie} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                  {minisPie.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.name] || CHART_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2.5">
              {minisPie.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[entry.name] || CHART_COLORS[i] }} />
                  <span className="text-muted-foreground">{entry.name}</span>
                  <span className="font-bold text-foreground ml-auto">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Equipamentos por Tipo */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Frota por Tipo</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={tipoBreakdown} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} angle={-30} textAnchor="end" interval={0} height={50} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Qtd" radius={[6, 6, 0, 0]}>
                {tipoBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* FMDS quick status */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">FMDS — Status Rápido</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {fmds.map((f) => (
            <div key={f.id} className={`rounded-xl border p-2.5 text-xs ${f.df_status === 'SIM' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                {f.df_status === 'SIM' ? <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" /> : <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                <span className={`font-bold ${f.df_status === 'SIM' ? 'text-emerald-400' : 'text-red-400'}`}>{f.df_status}</span>
              </div>
              <div className="text-muted-foreground leading-tight line-clamp-2">{f.equipamento.replace('BUSATO_', '').replace(' - TERCEIROS', '')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── DF Tab ───────────────────────────────────────────────────────────────────

function DiarioDFTab({ records, onRefresh, loading }: {
  records: CcoDiarioDF[]; onRefresh: () => void; loading: boolean;
}) {
  const [search, setSearch] = useState('');
  const [letraFilter, setLetraFilter] = useState('all');
  const [turnoFilter, setTurnoFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<CcoDiarioDF | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    data: new Date().toISOString().split('T')[0],
    equipamento: '', local: '', area: 'MINÉRIO', fidelizacao: '', os: '',
    turno: 'DIA', letra: 'A', profissional_titular: '', encarregado_1: '', encarregado_2: '', status: '',
    horario_inicio: '07:00', horario_termino: '17:30',
    hora_chegada: '07:00', observacao: ''
  };
  const [form, setForm] = useState(emptyForm);

  // Computed DF
  const calcDF = (chegada: string, inicio: string, termino: string) => {
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const iniMin = toMin(inicio);
    const chegMin = toMin(chegada || inicio);
    const fimMin = toMin(termino);
    const total = fimMin - iniMin;
    const atraso = Math.max(0, chegMin - iniMin);
    const exec = total - atraso;
    const df = total > 0 ? (exec / total) * 100 : 0;
    return { total_minutos: total, atraso_minutos: atraso, executado_minutos: exec, df_percent: parseFloat(df.toFixed(2)) };
  };

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (letraFilter !== 'all' && r.letra !== letraFilter) return false;
      if (turnoFilter !== 'all' && r.turno !== turnoFilter) return false;
      if (search && !r.equipamento.toLowerCase().includes(search.toLowerCase()) &&
          !r.profissional_titular.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [records, letraFilter, turnoFilter, search]);

  const handleSave = async () => {
    setSaving(true);
    const computed = calcDF(form.hora_chegada, form.horario_inicio, form.horario_termino);
    const payload = {
      ...form,
      total_horas: computed.total_minutos / 60,
      ...computed,
    };
    try {
      if (editRecord) {
        const { error } = await supabase.from('cco_diario_df').update(payload).eq('id', editRecord.id);
        if (error) throw error;
        toast.success('Registro atualizado!');
      } else {
        const { error } = await supabase.from('cco_diario_df').insert([payload]);
        if (error) throw error;
        toast.success('Registro adicionado!');
      }
      setShowForm(false);
      setEditRecord(null);
      setForm(emptyForm);
      onRefresh();
    } catch (e: unknown) {
      toast.error('Erro ao salvar: ' + (e instanceof Error ? e.message : 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('cco_diario_df').delete().eq('id', deleteId);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Registro excluído');
    setDeleteId(null);
    onRefresh();
  };

  const handleEdit = (r: CcoDiarioDF) => {
    setEditRecord(r);
    setForm({
      data: r.data, equipamento: r.equipamento, local: r.local, area: r.area,
      fidelizacao: r.fidelizacao, os: r.os, turno: r.turno, letra: r.letra,
      profissional_titular: r.profissional_titular, encarregado_1: r.encarregado_1 || '', encarregado_2: r.encarregado_2 || '', status: r.status,
      horario_inicio: r.horario_inicio, horario_termino: r.horario_termino,
      hora_chegada: r.hora_chegada, observacao: ''
    });
    setShowForm(true);
  };

  const exportXls = () => {
    const rows = filtered.map(r => ({
      'Data': fmtDate(r.data),
      'Equipamento': r.equipamento,
      'Local': r.local,
      'Área': r.area,
      'Fidelização': r.fidelizacao,
      'O.S': r.os,
      'Turno': r.turno,
      'Letra': r.letra,
      'Profissional': r.profissional_titular,
      'Encarregado 1': r.encarregado_1 || '',
      'Encarregado 2': r.encarregado_2 || '',
      'Hr Início': r.horario_inicio,
      'Hr Término': r.horario_termino,
      'Hr Chegada': r.hora_chegada,
      'Atraso (min)': r.atraso_minutos,
      'Executado (min)': r.executado_minutos,
      'DF%': r.df_percent,
    }));
    writeExcelFile(rows, 'CCO_Diario_DF.xlsx', 'Diário DF');
  };

  const livros = ['A', 'B', 'ADM'];
  const turnos = ['DIA', 'NOITE'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Buscar equipamento ou profissional..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 w-64 text-sm" />
          </div>
          <Select value={letraFilter} onValueChange={setLetraFilter}>
            <SelectTrigger className="h-9 w-28 text-sm"><SelectValue placeholder="Letra" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {livros.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={turnoFilter} onValueChange={setTurnoFilter}>
            <SelectTrigger className="h-9 w-28 text-sm"><SelectValue placeholder="Turno" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {turnos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportXls} className="gap-1.5 h-9 text-sm">
            <Download className="w-3.5 h-3.5" /> Exportar
          </Button>
          <Button size="sm" onClick={() => { setEditRecord(null); setForm(emptyForm); setShowForm(true); }} className="gap-1.5 h-9 text-sm">
            <Plus className="w-3.5 h-3.5" /> Novo Registro
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {['A', 'B'].flatMap(l => ['DIA', 'NOITE'].map(t => {
          const regs = filtered.filter(r => r.letra === l && r.turno === t);
          const avg = regs.length ? regs.reduce((s, r) => s + r.df_percent, 0) / regs.length : null;
          return (
            <div key={`${l}-${t}`} className="bg-card border border-border rounded-xl p-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{l} {t}</div>
              <div className={`text-xl font-bold ${avg !== null ? dfColor(avg) : 'text-muted-foreground'}`}>
                {avg !== null ? `${avg.toFixed(0)}%` : '—'}
              </div>
              <div className="text-[10px] text-muted-foreground">{regs.length} equip.</div>
            </div>
          );
        }))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Equipamento</TableHead>
                <TableHead className="text-xs">Local</TableHead>
                <TableHead className="text-xs">Letra/Turno</TableHead>
                <TableHead className="text-xs">Profissional</TableHead>
                <TableHead className="text-xs">Chegada</TableHead>
                <TableHead className="text-xs">Atraso</TableHead>
                <TableHead className="text-xs">DF%</TableHead>
                <TableHead className="text-xs w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id} className="border-border hover:bg-muted/30 transition-colors">
                  <TableCell className="text-xs font-mono">{fmtDate(r.data)}</TableCell>
                  <TableCell className="text-xs font-medium max-w-[200px] truncate">{r.equipamento}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{r.local}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{r.letra}</Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{r.turno}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{r.profissional_titular}</TableCell>
                  <TableCell className="text-xs font-mono">{r.hora_chegada}</TableCell>
                  <TableCell className="text-xs">
                    {r.atraso_minutos > 0 ? (
                      <span className="text-amber-400 font-medium">{r.atraso_minutos}min</span>
                    ) : (
                      <span className="text-emerald-400">No prazo</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`text-sm font-bold ${dfColor(r.df_percent)}`}>
                      {r.df_percent.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleEdit(r)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-red-400 hover:text-red-300" onClick={() => setDeleteId(r.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog Form */}
      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setEditRecord(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editRecord ? 'Editar Registro DF' : 'Novo Registro Diário de Fidelização'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div><Label className="text-xs mb-1">Data *</Label><Input type="date" value={form.data} onChange={e => setForm(f => ({...f, data: e.target.value}))} className="text-sm" /></div>
            <div><Label className="text-xs mb-1">Equipamento *</Label><Input value={form.equipamento} onChange={e => setForm(f => ({...f, equipamento: e.target.value}))} placeholder="Ex: CAMINHÃO BASCULANTE 01" className="text-sm" /></div>
            <div className="col-span-2"><Label className="text-xs mb-1">Local</Label><Input value={form.local} onChange={e => setForm(f => ({...f, local: e.target.value}))} placeholder="Ex: REMOÇÃO LIMPEZA - SEGUIR PROGRAMAÇÃO" className="text-sm" /></div>
            <div>
              <Label className="text-xs mb-1">Área</Label>
              <Select value={form.area} onValueChange={v => setForm(f => ({...f, area: v}))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['MINÉRIO', 'TPM', 'MFE', 'PÍER', 'VIAS'].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1">Fidelização (Placa/TAG)</Label><Input value={form.fidelizacao} onChange={e => setForm(f => ({...f, fidelizacao: e.target.value}))} className="text-sm" /></div>
            <div><Label className="text-xs mb-1">O.S</Label><Input value={form.os} onChange={e => setForm(f => ({...f, os: e.target.value}))} className="text-sm" /></div>
            <div><Label className="text-xs mb-1">Profissional Titular</Label><Input value={form.profissional_titular} onChange={e => setForm(f => ({...f, profissional_titular: e.target.value}))} className="text-sm" /></div>
            <div><Label className="text-xs mb-1">Encarregado 1</Label><Input value={form.encarregado_1} onChange={e => setForm(f => ({...f, encarregado_1: e.target.value}))} className="text-sm" /></div>
            <div><Label className="text-xs mb-1">Encarregado 2</Label><Input value={form.encarregado_2} onChange={e => setForm(f => ({...f, encarregado_2: e.target.value}))} className="text-sm" /></div>
            <div>
              <Label className="text-xs mb-1">Turno</Label>
              <Select value={form.turno} onValueChange={v => setForm(f => ({...f, turno: v}))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIA">DIA</SelectItem>
                  <SelectItem value="NOITE">NOITE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1">Letra</Label>
              <Select value={form.letra} onValueChange={v => setForm(f => ({...f, letra: v}))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="ADM">ADM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1">Horário Início</Label><Input type="time" value={form.horario_inicio} onChange={e => setForm(f => ({...f, horario_inicio: e.target.value}))} className="text-sm" /></div>
            <div><Label className="text-xs mb-1">Horário Término</Label><Input type="time" value={form.horario_termino} onChange={e => setForm(f => ({...f, horario_termino: e.target.value}))} className="text-sm" /></div>
            <div>
              <Label className="text-xs mb-1">Hora de Chegada</Label>
              <Input type="time" value={form.hora_chegada} onChange={e => setForm(f => ({...f, hora_chegada: e.target.value}))} className="text-sm" />
            </div>
            {/* DF preview */}
            <div className="flex items-end">
              <div className="bg-muted/40 rounded-xl p-3 w-full">
                {(() => {
                  const c = calcDF(form.hora_chegada, form.horario_inicio, form.horario_termino);
                  return (
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-1">Prévia do DF</div>
                      <div className="flex gap-3">
                        <div><div className="text-[10px] text-muted-foreground">Atraso</div><div className="font-bold text-amber-400">{c.atraso_minutos}min</div></div>
                        <div><div className="text-[10px] text-muted-foreground">DF%</div><div className={`font-bold ${dfColor(c.df_percent)}`}>{c.df_percent.toFixed(1)}%</div></div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditRecord(null); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Equipamentos Tab ─────────────────────────────────────────────────────────

function EquipamentosTab({ equipamentos, onRefresh, loading }: {
  equipamentos: CcoEquipamento[]; onRefresh: () => void; loading: boolean;
}) {
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [situacaoFilter, setSituacaoFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<CcoEquipamento | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = { equipamento: '', placa: '', tipo: 'CAMINHÃO BASCULANTE', area: 'MINÉRIO', situacao: 'ATIVO', local: 'PORTO', status_atual: 'ATUANDO', observacao: '' };
  const [form, setForm] = useState(emptyForm);

  const tipos = [...new Set(equipamentos.map(e => e.tipo))].sort();

  const filtered = useMemo(() => equipamentos.filter(e => {
    if (tipoFilter !== 'all' && e.tipo !== tipoFilter) return false;
    if (situacaoFilter !== 'all' && e.situacao !== situacaoFilter) return false;
    if (search && !e.equipamento.toLowerCase().includes(search.toLowerCase()) && !e.placa.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [equipamentos, tipoFilter, situacaoFilter, search]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editRecord) {
        const { error } = await supabase.from('cco_equipamentos').update(form).eq('id', editRecord.id);
        if (error) throw error;
        toast.success('Equipamento atualizado!');
      } else {
        const { error } = await supabase.from('cco_equipamentos').insert([form]);
        if (error) throw error;
        toast.success('Equipamento adicionado!');
      }
      setShowForm(false); setEditRecord(null); setForm(emptyForm); onRefresh();
    } catch (e: unknown) {
      toast.error('Erro: ' + (e instanceof Error ? e.message : 'Erro desconhecido'));
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('cco_equipamentos').delete().eq('id', deleteId);
    toast.success('Excluído'); setDeleteId(null); onRefresh();
  };

  const handleEdit = (e: CcoEquipamento) => {
    setEditRecord(e);
    setForm({ equipamento: e.equipamento, placa: e.placa, tipo: e.tipo, area: e.area, situacao: e.situacao, local: e.local, status_atual: e.status_atual || '', observacao: e.observacao || '' });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Buscar por equipamento ou placa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 w-60 text-sm" />
          </div>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              {tipos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={situacaoFilter} onValueChange={setSituacaoFilter}>
            <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="Situação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="ATIVO">Ativo</SelectItem>
              <SelectItem value="RESERVA">Reserva</SelectItem>
              <SelectItem value="INATIVO">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => { setEditRecord(null); setForm(emptyForm); setShowForm(true); }} className="gap-1.5 h-9 text-sm">
          <Plus className="w-3.5 h-3.5" /> Novo Equipamento
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-1">
        {(['ATIVO', 'RESERVA'] as const).map(s => (
          <div key={s} className="bg-card border border-border rounded-xl p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">{s}</div>
            <div className="text-2xl font-bold text-foreground">{equipamentos.filter(e => e.situacao === s).length}</div>
          </div>
        ))}
        {tipos.slice(0, 2).map(t => (
          <div key={t} className="bg-card border border-border rounded-xl p-3 text-center">
            <div className="text-[10px] text-muted-foreground mb-1 truncate">{t}</div>
            <div className="text-2xl font-bold text-foreground">{equipamentos.filter(e => e.tipo === t).length}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs">Equipamento</TableHead>
                <TableHead className="text-xs">Placa/TAG</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Área</TableHead>
                <TableHead className="text-xs">Local</TableHead>
                <TableHead className="text-xs">Situação</TableHead>
                <TableHead className="text-xs w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">Nenhum equipamento encontrado</TableCell></TableRow>
              ) : filtered.map(e => (
                <TableRow key={e.id} className="border-border hover:bg-muted/30 transition-colors">
                  <TableCell className="text-xs font-medium">{e.equipamento}</TableCell>
                  <TableCell className="text-xs font-mono font-bold text-primary">{e.placa || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{e.tipo}</Badge></TableCell>
                  <TableCell className="text-xs">{e.area}</TableCell>
                  <TableCell className="text-xs">{e.local}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] border ${statusBadge(e.situacao)}`}>{e.situacao}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-red-400 hover:text-red-300" onClick={() => setDeleteId(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setEditRecord(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editRecord ? 'Editar Equipamento' : 'Novo Equipamento'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2"><Label className="text-xs mb-1">Equipamento *</Label><Input value={form.equipamento} onChange={e => setForm(f => ({...f, equipamento: e.target.value}))} className="text-sm" /></div>
            <div><Label className="text-xs mb-1">Placa/TAG</Label><Input value={form.placa} onChange={e => setForm(f => ({...f, placa: e.target.value}))} className="text-sm" /></div>
            <div>
              <Label className="text-xs mb-1">Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({...f, tipo: v}))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['CAMINHÃO BASCULANTE','CAMINHÃO PIPA','CAMINHÃO BROOK','MINI CARREGADEIRA','MINI ESCAVADEIRA','PÁ CARREGADEIRA','RETROESCAVADEIRA','CAÇAMBA','OUTRO'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1">Área</Label>
              <Select value={form.area} onValueChange={v => setForm(f => ({...f, area: v}))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['MINÉRIO','TPM','MFE','PÍER','VIAS'].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1">Situação</Label>
              <Select value={form.situacao} onValueChange={v => setForm(f => ({...f, situacao: v}))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="RESERVA">Reserva</SelectItem>
                  <SelectItem value="INATIVO">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1">Local</Label><Input value={form.local} onChange={e => setForm(f => ({...f, local: e.target.value}))} className="text-sm" /></div>
            <div className="col-span-2"><Label className="text-xs mb-1">Observação</Label><Textarea value={form.observacao} onChange={e => setForm(f => ({...f, observacao: e.target.value}))} className="text-sm h-20" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir equipamento?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Minis Tab ────────────────────────────────────────────────────────────────

function MinisTab({ minis, onRefresh, loading }: {
  minis: CcoMini[]; onRefresh: () => void; loading: boolean;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<CcoMini | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = { equipamento: '', area: 'MINÉRIO', tag: '', modelo: '', situacao: 'FIDELIZADA', status: 'ATUANDO', observacao: '', manutencao: 'OK', rastreador: '' };
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => minis.filter(m => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (search && !m.tag.toLowerCase().includes(search.toLowerCase()) && !m.equipamento.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [minis, statusFilter, search]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editRecord) {
        const { error } = await supabase.from('cco_minis').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editRecord.id);
        if (error) throw error;
        toast.success('Mini atualizada!');
      } else {
        const { error } = await supabase.from('cco_minis').insert([form]);
        if (error) throw error;
        toast.success('Mini adicionada!');
      }
      setShowForm(false); setEditRecord(null); setForm(emptyForm); onRefresh();
    } catch (e: unknown) {
      toast.error('Erro: ' + (e instanceof Error ? e.message : 'Erro desconhecido'));
    } finally { setSaving(false); }
  };

  const handleEdit = (m: CcoMini) => {
    setEditRecord(m);
    setForm({ equipamento: m.equipamento, area: m.area, tag: m.tag, modelo: m.modelo, situacao: m.situacao, status: m.status, observacao: m.observacao, manutencao: m.manutencao, rastreador: m.rastreador });
    setShowForm(true);
  };

  const statusIcons: Record<string, React.ElementType> = { ATUANDO: Zap, DISPONÍVEL: CircleDot, MANUTENÇÃO: Wrench };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Buscar por TAG..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 w-48 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ATUANDO">Atuando</SelectItem>
              <SelectItem value="DISPONÍVEL">Disponível</SelectItem>
              <SelectItem value="MANUTENÇÃO">Manutenção</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => { setEditRecord(null); setForm(emptyForm); setShowForm(true); }} className="gap-1.5 h-9 text-sm">
          <Plus className="w-3.5 h-3.5" /> Nova Mini
        </Button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-3">
        {['ATUANDO', 'DISPONÍVEL', 'MANUTENÇÃO'].map(s => {
          const count = minis.filter(m => m.status === s).length;
          const Icon = statusIcons[s] || CircleDot;
          return (
            <div key={s} className={`bg-card border rounded-2xl p-4 flex items-center gap-3 ${statusBadge(s).replace('text-', 'border-').replace('bg-', '').split(' ')[1] || 'border-border'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${statusBadge(s)}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{count}</div>
                <div className="text-xs text-muted-foreground">{s}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mini cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground text-sm">Nenhuma mini encontrada</div>
        ) : filtered.map(m => {
          const Icon = statusIcons[m.status] || CircleDot;
          const hasAlert = m.manutencao && m.manutencao !== 'OK';
          return (
            <motion.div key={m.id} layout
              className={`bg-card border rounded-2xl p-4 flex flex-col gap-3 hover:shadow-md transition-all cursor-pointer ${hasAlert ? 'border-amber-500/30' : 'border-border'}`}
              onClick={() => handleEdit(m)}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-bold text-primary font-mono">{m.tag}</div>
                  <div className="text-xs text-muted-foreground">{m.modelo || 'Mini'}</div>
                </div>
                <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full border ${statusBadge(m.status)}`}>
                  <Icon className="w-3 h-3" />
                  {m.status}
                </div>
              </div>
              <div className="text-xs text-foreground font-medium line-clamp-2 leading-relaxed">
                {m.equipamento.replace('BUSATO_', '').replace(' - TERCEIROS', '')}
              </div>
              <div className="flex gap-2 flex-wrap">
                {m.area && <Badge variant="outline" className="text-[10px]">{m.area}</Badge>}
                <Badge variant="outline" className={`text-[10px] ${statusBadge(m.situacao)}`}>{m.situacao}</Badge>
              </div>
              {hasAlert && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-[10px] text-amber-300 leading-relaxed">{m.manutencao}</span>
                </div>
              )}
              {m.rastreador && m.rastreador !== 'Ok' && m.rastreador !== 'Ok.' && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 flex items-start gap-1.5">
                  <Radio className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span className="text-[10px] text-blue-300 leading-relaxed">{m.rastreador}</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setEditRecord(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editRecord ? 'Editar Mini Carregadeira/Escavadeira' : 'Nova Mini'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div><Label className="text-xs mb-1">TAG *</Label><Input value={form.tag} onChange={e => setForm(f => ({...f, tag: e.target.value}))} className="text-sm font-mono" /></div>
            <div><Label className="text-xs mb-1">Modelo</Label><Input value={form.modelo} onChange={e => setForm(f => ({...f, modelo: e.target.value}))} className="text-sm" /></div>
            <div className="col-span-2"><Label className="text-xs mb-1">Equipamento</Label><Input value={form.equipamento} onChange={e => setForm(f => ({...f, equipamento: e.target.value}))} className="text-sm" /></div>
            <div>
              <Label className="text-xs mb-1">Área</Label>
              <Select value={form.area} onValueChange={v => setForm(f => ({...f, area: v}))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['MINÉRIO','TPM','MFE',''].map(a => <SelectItem key={a || 'none'} value={a}>{a || 'Não definida'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATUANDO">Atuando</SelectItem>
                  <SelectItem value="DISPONÍVEL">Disponível</SelectItem>
                  <SelectItem value="MANUTENÇÃO">Manutenção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1">Situação</Label>
              <Select value={form.situacao} onValueChange={v => setForm(f => ({...f, situacao: v}))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIDELIZADA">Fidelizada</SelectItem>
                  <SelectItem value="RESERVA">Reserva</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label className="text-xs mb-1">Manutenção</Label><Input value={form.manutencao} onChange={e => setForm(f => ({...f, manutencao: e.target.value}))} placeholder="OK ou descrição do problema" className="text-sm" /></div>
            <div className="col-span-2"><Label className="text-xs mb-1">Rastreador</Label><Input value={form.rastreador} onChange={e => setForm(f => ({...f, rastreador: e.target.value}))} className="text-sm" /></div>
            <div className="col-span-2"><Label className="text-xs mb-1">Observação</Label><Textarea value={form.observacao} onChange={e => setForm(f => ({...f, observacao: e.target.value}))} className="text-sm h-16" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Planejamento Tab ─────────────────────────────────────────────────────────

function PlanejamentoTab({ planejamentos, onRefresh, loading }: {
  planejamentos: CcoPlanejamento[]; onRefresh: () => void; loading: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<CcoPlanejamento | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const emptyForm = { data: new Date().toISOString().split('T')[0], equipamento: '', local_planejado: '', local_executado: '', status: 'PLANEJADO', observacao: '' };
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => planejamentos.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search && !p.equipamento.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [planejamentos, statusFilter, search]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editRecord) {
        const { error } = await supabase.from('cco_planejamento').update(form).eq('id', editRecord.id);
        if (error) throw error;
        toast.success('Planejamento atualizado!');
      } else {
        const { error } = await supabase.from('cco_planejamento').insert([form]);
        if (error) throw error;
        toast.success('Planejamento adicionado!');
      }
      setShowForm(false); setEditRecord(null); setForm(emptyForm); onRefresh();
    } catch (e: unknown) {
      toast.error('Erro: ' + (e instanceof Error ? e.message : 'Erro desconhecido'));
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Buscar equipamento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 w-56 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PLANEJADO">Planejado</SelectItem>
              <SelectItem value="EXECUTADO">Executado</SelectItem>
              <SelectItem value="CANCELADO">Cancelado</SelectItem>
              <SelectItem value="PARCIAL">Parcial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => { setEditRecord(null); setForm(emptyForm); setShowForm(true); }} className="gap-1.5 h-9 text-sm">
          <Plus className="w-3.5 h-3.5" /> Novo Planejamento
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {['EXECUTADO', 'PLANEJADO', 'CANCELADO', 'PARCIAL'].map(s => (
          <div key={s} className="bg-card border border-border rounded-xl p-3 text-center">
            <div className="text-[10px] text-muted-foreground mb-1">{s}</div>
            <div className="text-2xl font-bold text-foreground">{planejamentos.filter(p => p.status === s).length}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Equipamento</TableHead>
                <TableHead className="text-xs">Local Planejado</TableHead>
                <TableHead className="text-xs">Local Executado</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Obs.</TableHead>
                <TableHead className="text-xs w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">Nenhum registro encontrado</TableCell></TableRow>
              ) : filtered.map(p => (
                <TableRow key={p.id} className="border-border hover:bg-muted/30">
                  <TableCell className="text-xs font-mono">{fmtDate(p.data)}</TableCell>
                  <TableCell className="text-xs font-medium">{p.equipamento}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.local_planejado}</TableCell>
                  <TableCell className="text-xs">{p.local_executado}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] border ${statusBadge(p.status)}`}>{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{p.observacao}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => { setEditRecord(p); setForm({ data: p.data, equipamento: p.equipamento, local_planejado: p.local_planejado, local_executado: p.local_executado, status: p.status, observacao: p.observacao }); setShowForm(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setEditRecord(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editRecord ? 'Editar Planejamento' : 'Novo Serviço Planejado'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div><Label className="text-xs mb-1">Data *</Label><Input type="date" value={form.data} onChange={e => setForm(f => ({...f, data: e.target.value}))} className="text-sm" /></div>
            <div><Label className="text-xs mb-1">Equipamento *</Label><Input value={form.equipamento} onChange={e => setForm(f => ({...f, equipamento: e.target.value}))} className="text-sm" /></div>
            <div className="col-span-2"><Label className="text-xs mb-1">Local Planejado</Label><Input value={form.local_planejado} onChange={e => setForm(f => ({...f, local_planejado: e.target.value}))} className="text-sm" /></div>
            <div className="col-span-2"><Label className="text-xs mb-1">Local Executado</Label><Input value={form.local_executado} onChange={e => setForm(f => ({...f, local_executado: e.target.value}))} className="text-sm" /></div>
            <div>
              <Label className="text-xs mb-1">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANEJADO">Planejado</SelectItem>
                  <SelectItem value="EXECUTADO">Executado</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                  <SelectItem value="PARCIAL">Parcial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1">Observação</Label><Input value={form.observacao} onChange={e => setForm(f => ({...f, observacao: e.target.value}))} className="text-sm" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── FMDS Tab ─────────────────────────────────────────────────────────────────

function FmdsTab({ fmds, onRefresh, loading }: {
  fmds: CcoFmds[]; onRefresh: () => void; loading: boolean;
}) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<CcoFmds | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = { equipamento: '', df_status: 'SIM', justificativa: 'EM OPERAÇÃO', data: new Date().toISOString().split('T')[0] };
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => fmds.filter(f =>
    !search || f.equipamento.toLowerCase().includes(search.toLowerCase())
  ), [fmds, search]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editRecord) {
        const { error } = await supabase.from('cco_fmds').update(form).eq('id', editRecord.id);
        if (error) throw error;
        toast.success('FMDS atualizado!');
      } else {
        const { error } = await supabase.from('cco_fmds').insert([form]);
        if (error) throw error;
        toast.success('FMDS adicionado!');
      }
      setShowForm(false); setEditRecord(null); setForm(emptyForm); onRefresh();
    } catch (e: unknown) {
      toast.error('Erro: ' + (e instanceof Error ? e.message : 'Erro desconhecido'));
    } finally { setSaving(false); }
  };

  const sim = fmds.filter(f => f.df_status === 'SIM').length;
  const nao = fmds.filter(f => f.df_status === 'NÃO').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar equipamento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 w-60 text-sm" />
        </div>
        <Button size="sm" onClick={() => { setEditRecord(null); setForm(emptyForm); setShowForm(true); }} className="gap-1.5 h-9 text-sm">
          <Plus className="w-3.5 h-3.5" /> Novo FMDS
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-emerald-500/20 rounded-2xl p-4 text-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
          <div className="text-3xl font-bold text-emerald-400">{sim}</div>
          <div className="text-xs text-muted-foreground">Conformes (SIM)</div>
        </div>
        <div className="bg-card border border-red-500/20 rounded-2xl p-4 text-center">
          <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <div className="text-3xl font-bold text-red-400">{nao}</div>
          <div className="text-xs text-muted-foreground">Não Conformes (NÃO)</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <Shield className="w-6 h-6 text-blue-400 mx-auto mb-2" />
          <div className="text-3xl font-bold text-foreground">{fmds.length > 0 ? `${((sim/fmds.length)*100).toFixed(0)}%` : '—'}</div>
          <div className="text-xs text-muted-foreground">Taxa de Conformidade</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.map(f => (
          <motion.div key={f.id} layout
            className={`bg-card border rounded-2xl p-4 flex flex-col gap-2.5 cursor-pointer hover:shadow-md transition-all ${f.df_status === 'SIM' ? 'border-emerald-500/20 hover:border-emerald-500/40' : 'border-red-500/20 hover:border-red-500/40'}`}
            onClick={() => { setEditRecord(f); setForm({ equipamento: f.equipamento, df_status: f.df_status, justificativa: f.justificativa, data: f.data || new Date().toISOString().split('T')[0] }); setShowForm(true); }}>
            <div className="flex items-center justify-between gap-2">
              <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${f.df_status === 'SIM' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                {f.df_status === 'SIM' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {f.df_status}
              </div>
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="text-xs font-medium text-foreground leading-relaxed">
              {f.equipamento.replace('BUSATO_', '').replace(' - TERCEIROS', '')}
            </div>
            {f.justificativa && (
              <div className="text-[10px] text-muted-foreground italic">{f.justificativa}</div>
            )}
          </motion.div>
        ))}
      </div>

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setEditRecord(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editRecord ? 'Editar FMDS' : 'Novo FMDS'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label className="text-xs mb-1">Equipamento *</Label><Input value={form.equipamento} onChange={e => setForm(f => ({...f, equipamento: e.target.value}))} className="text-sm" /></div>
            <div><Label className="text-xs mb-1">Data</Label><Input type="date" value={form.data} onChange={e => setForm(f => ({...f, data: e.target.value}))} className="text-sm" /></div>
            <div>
              <Label className="text-xs mb-1">Status FMDS</Label>
              <Select value={form.df_status} onValueChange={v => setForm(f => ({...f, df_status: v}))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SIM">SIM — Conforme</SelectItem>
                  <SelectItem value="NÃO">NÃO — Não Conforme</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1">Justificativa</Label><Textarea value={form.justificativa} onChange={e => setForm(f => ({...f, justificativa: e.target.value}))} className="text-sm h-20" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CCO() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [equipamentos, setEquipamentos] = useState<CcoEquipamento[]>([]);
  const [dfRecords, setDfRecords] = useState<CcoDiarioDF[]>([]);
  const [minis, setMinis] = useState<CcoMini[]>([]);
  const [fmds, setFmds] = useState<CcoFmds[]>([]);
  const [planejamentos, setPlanejamentos] = useState<CcoPlanejamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [eqRes, dfRes, miniRes, fmdsRes, planRes] = await Promise.all([
      supabase.from('cco_equipamentos').select('*').order('equipamento'),
      supabase.from('cco_diario_df').select('*').order('data', { ascending: false }).order('equipamento'),
      supabase.from('cco_minis').select('*').order('tag'),
      supabase.from('cco_fmds').select('*').order('equipamento'),
      supabase.from('cco_planejamento').select('*').order('data', { ascending: false }),
    ]);
    if (eqRes.data) setEquipamentos(eqRes.data as CcoEquipamento[]);
    if (dfRes.data) setDfRecords(dfRes.data as CcoDiarioDF[]);
    if (miniRes.data) setMinis(miniRes.data as CcoMini[]);
    if (fmdsRes.data) setFmds(fmdsRes.data as CcoFmds[]);
    if (planRes.data) setPlanejamentos(planRes.data as CcoPlanejamento[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Seed initial data
  const handleSeed = async () => {
    setSeeding(true);
    try {
      // Check if already seeded
      const { count } = await supabase.from('cco_equipamentos').select('*', { count: 'exact', head: true });
      if ((count || 0) > 0) {
        toast.info('Dados já foram importados anteriormente.');
        setSeeding(false);
        return;
      }

      // Insert equipamentos
      const { error: e1 } = await supabase.from('cco_equipamentos').insert(CCO_EQUIPAMENTOS_SEED);
      if (e1) throw new Error('Equipamentos: ' + e1.message);

      // Insert DF records
      const { error: e2 } = await supabase.from('cco_diario_df').insert(CCO_DF_SEED);
      if (e2) throw new Error('DF: ' + e2.message);

      // Insert minis
      const { error: e3 } = await supabase.from('cco_minis').insert(CCO_MINIS_SEED);
      if (e3) throw new Error('Minis: ' + e3.message);

      // Insert FMDS
      const { error: e4 } = await supabase.from('cco_fmds').insert(CCO_FMDS_SEED);
      if (e4) throw new Error('FMDS: ' + e4.message);

      // Insert planejamento
      const { error: e5 } = await supabase.from('cco_planejamento').insert(CCO_PLANEJAMENTO_SEED);
      if (e5) throw new Error('Planejamento: ' + e5.message);

      toast.success('✅ Dados da planilha importados com sucesso!');
      await fetchAll();
    } catch (err: unknown) {
      toast.error('Erro na importação: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setSeeding(false);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Visão Geral', icon: BarChart3 },
    { id: 'df', label: 'Diário DF', icon: ClipboardList },
    { id: 'equipamentos', label: 'Equipamentos', icon: Truck },
    { id: 'minis', label: 'Minis', icon: Wrench },
    { id: 'planejamento', label: 'Planejamento', icon: Calendar },
    { id: 'fmds', label: 'FMDS', icon: Shield },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-0.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="w-4.5 h-4.5 text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">CCO — Centro de Controle Operacional</h1>
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-primary border-primary/30 bg-primary/5">PORTO</Badge>
            </div>
            <p className="text-xs text-muted-foreground ml-10.5">
              Controle de frota, diário de fidelização e planejamento de serviços
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {(equipamentos.length === 0 && !loading) && (
              <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding} className="gap-1.5 h-9 text-xs border-primary/30 text-primary hover:bg-primary/5">
                {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Importar dados da planilha
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-1.5 h-9 text-xs">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="px-6 flex gap-0 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-all ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 p-6 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'dashboard' && (
              <DashboardTab dfRecords={dfRecords} equipamentos={equipamentos} minis={minis} fmds={fmds} />
            )}
            {activeTab === 'df' && (
              <DiarioDFTab records={dfRecords} onRefresh={fetchAll} loading={loading} />
            )}
            {activeTab === 'equipamentos' && (
              <EquipamentosTab equipamentos={equipamentos} onRefresh={fetchAll} loading={loading} />
            )}
            {activeTab === 'minis' && (
              <MinisTab minis={minis} onRefresh={fetchAll} loading={loading} />
            )}
            {activeTab === 'planejamento' && (
              <PlanejamentoTab planejamentos={planejamentos} onRefresh={fetchAll} loading={loading} />
            )}
            {activeTab === 'fmds' && (
              <FmdsTab fmds={fmds} onRefresh={fetchAll} loading={loading} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
