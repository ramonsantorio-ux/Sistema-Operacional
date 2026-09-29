import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Download, Plus, Save, Activity, Target, ShieldAlert, BarChart3, Trash, GripVertical, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { readExcelRows, writeExcelFile } from '@/lib/excel';
import ExpandableChart from './ExpandableChart';
import { BarChart, Bar, LineChart, Line, AreaChart, ReferenceLine, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';

export interface N3Data {
  id?: string;
  nome_email: string;
  cargo?: string;
  letra?: string;
  periodo: string;
  total_verificacoes: number;
  total_treinamentos: number;
  total_assistencia: number;
  verificacoes_nc: number;
  verificacoes_s1?: number;
  verificacoes_s2?: number;
  verificacoes_s3?: number;
  verificacoes_s4?: number;
  verificacoes_s5?: number;
  verificacoes_nc_s1?: number;
  verificacoes_nc_s2?: number;
  verificacoes_nc_s3?: number;
  verificacoes_nc_s4?: number;
  verificacoes_nc_s5?: number;
  perguntas_nc?: number;
}

const DEFAULT_NAMES = [
  { nome: 'EDUARDO LIMA BOY', cargo: 'Supervisor de Campo', letra: 'ADM' },
  { nome: 'CRISTALLY DE JESUS NETTO', cargo: 'Técnico de Segurança', letra: 'A Noite' },
  { nome: 'GABRIELE GALDINO MONTARROYOS', cargo: 'Técnico de Segurança', letra: 'A Dia' },
  { nome: 'NAIARA LIMA DOS SANTOS', cargo: 'Técnico de Segurança', letra: 'B Dia' },
  { nome: 'THIAGO DIAS GOMES', cargo: 'Técnico de Segurança', letra: 'B Noite' }
];

export function encodeN3Row(row: N3Data) {
  const s1 = Number(row.verificacoes_s1) || 0;
  const s2 = Number(row.verificacoes_s2) || 0;
  const s3 = Number(row.verificacoes_s3) || 0;
  const s4 = Number(row.verificacoes_s4) || 0;
  const s5 = Number(row.verificacoes_s5) || 0;

  const ncs1 = Number(row.verificacoes_nc_s1) || 0;
  const ncs2 = Number(row.verificacoes_nc_s2) || 0;
  const ncs3 = Number(row.verificacoes_nc_s3) || 0;
  const ncs4 = Number(row.verificacoes_nc_s4) || 0;
  const ncs5 = Number(row.verificacoes_nc_s5) || 0;

  const totVerif = (s1 + s2 + s3 + s4 + s5) || Number(row.total_verificacoes) || 0;
  const totNC = (ncs1 + ncs2 + ncs3 + ncs4 + ncs5) || Number(row.verificacoes_nc) || 0;

  const rawLetra = row.letra || '';
  const cleanLetra = rawLetra.includes('::') ? rawLetra.split('::')[0].trim() : rawLetra.trim();
  
  const metaObj = {
    s: [s1, s2, s3, s4, s5],
    ncs: [ncs1, ncs2, ncs3, ncs4, ncs5],
    cargo: row.cargo || ''
  };

  const encodedLetra = `${cleanLetra}::${JSON.stringify(metaObj)}`;

  return {
    nome_email: row.nome_email || 'SEM NOME',
    letra: encodedLetra,
    periodo: row.periodo,
    total_verificacoes: totVerif,
    total_treinamentos: Number(row.total_treinamentos) || 0,
    total_assistencia: Number(row.total_assistencia) || 0,
    verificacoes_nc: totNC,
    perguntas_nc: Number(row.perguntas_nc) || 0
  };
}

export function decodeN3Row(dbRow: Record<string, unknown>, cargoMap: Record<string, string> = {}): N3Data {
  const rawLetra = String(dbRow.letra || '');
  let cleanLetra = rawLetra;
  let s1 = 0, s2 = 0, s3 = 0, s4 = 0, s5 = 0;
  let ncs1 = 0, ncs2 = 0, ncs3 = 0, ncs4 = 0, ncs5 = 0;
  let decodedCargo = '';

  if (rawLetra.includes('::')) {
    const parts = rawLetra.split('::');
    cleanLetra = parts[0].trim();
    try {
      const meta = JSON.parse(parts.slice(1).join('::'));
      if (Array.isArray(meta.s)) {
        s1 = Number(meta.s[0]) || 0;
        s2 = Number(meta.s[1]) || 0;
        s3 = Number(meta.s[2]) || 0;
        s4 = Number(meta.s[3]) || 0;
        s5 = Number(meta.s[4]) || 0;
      }
      if (Array.isArray(meta.ncs)) {
        ncs1 = Number(meta.ncs[0]) || 0;
        ncs2 = Number(meta.ncs[1]) || 0;
        ncs3 = Number(meta.ncs[2]) || 0;
        ncs4 = Number(meta.ncs[3]) || 0;
        ncs5 = Number(meta.ncs[4]) || 0;
      }
      if (meta.cargo) decodedCargo = meta.cargo;
    } catch {
      // ignore
    }
  }

  const nome = String(dbRow.nome_email || '');
  const finalCargo = String(dbRow.cargo || decodedCargo || cargoMap[nome.toUpperCase().trim()] || '');
  const totVerif = (s1 + s2 + s3 + s4 + s5) || Number(dbRow.total_verificacoes) || 0;
  const totNC = (ncs1 + ncs2 + ncs3 + ncs4 + ncs5) || Number(dbRow.verificacoes_nc) || 0;

  return {
    id: String(dbRow.id || Math.random().toString(36).substring(2, 9)),
    nome_email: nome,
    cargo: finalCargo,
    letra: cleanLetra,
    periodo: String(dbRow.periodo || ''),
    total_verificacoes: totVerif,
    total_treinamentos: Number(dbRow.total_treinamentos) || 0,
    total_assistencia: Number(dbRow.total_assistencia) || 0,
    verificacoes_nc: totNC,
    verificacoes_s1: s1,
    verificacoes_s2: s2,
    verificacoes_s3: s3,
    verificacoes_s4: s4,
    verificacoes_s5: s5,
    verificacoes_nc_s1: ncs1,
    verificacoes_nc_s2: ncs2,
    verificacoes_nc_s3: ncs3,
    verificacoes_nc_s4: ncs4,
    verificacoes_nc_s5: ncs5,
    perguntas_nc: Number(dbRow.perguntas_nc) || 0,
  };
}

interface FuncItem { id: string; nome: string; cargo?: string; letra?: string; turno?: string; }
interface SortableRowProps {
  row: N3Data;
  idx: number;
  handleChange: (index: number, field: keyof N3Data, value: string) => void;
  handleRemoveRow: (idx: number) => void;
  funcionariosList?: FuncItem[];
}

// ─── Combobox de colaborador: digita para filtrar, clica para selecionar ───
interface ColaboradorComboboxProps {
  value: string;
  funcionariosList: FuncItem[];
  onChange: (nome: string) => void;
}
function ColaboradorCombobox({ value, funcionariosList, onChange }: ColaboradorComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincroniza o texto quando o valor externo muda (ex: ao carregar dados)
  useEffect(() => { setQuery(value || ''); }, [value]);

  // Fecha ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // Se o texto digitado não corresponde ao valor salvo, restaura
        if (query !== value) setQuery(value || '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [query, value]);

  const filtered = funcionariosList.filter(f =>
    !query || f.nome.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 20);

  const handleSelect = useCallback((nome: string) => {
    onChange(nome);
    setQuery(nome);
    setOpen(false);
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Se não há filtro ou o texto não bate com nenhuma opção, aceita como valor livre
      if (filtered.length > 0) {
        handleSelect(filtered[0].nome);
      } else {
        onChange(query);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery(value || '');
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder="Buscar colaborador..."
        autoComplete="off"
        className="flex h-8 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        onChange={e => { setQuery(e.target.value); setOpen(true); onChange(e.target.value); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg text-xs">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-muted-foreground italic">Nenhum colaborador encontrado</div>
          ) : (
            filtered.map(f => (
              <div
                key={f.id}
                className={`px-3 py-1.5 cursor-pointer hover:bg-primary/10 font-medium ${f.nome === value ? 'bg-primary/5 text-primary' : 'text-slate-800 dark:text-slate-200'}`}
                onMouseDown={e => { e.preventDefault(); handleSelect(f.nome); }}
              >
                {f.nome}
                {f.cargo && <span className="ml-2 text-[10px] text-muted-foreground font-normal">{f.cargo}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SortableRow({ row, idx, handleChange, handleRemoveRow, funcionariosList = [] }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id || `row-${idx}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative' as const, zIndex: 50, backgroundColor: 'var(--background)' } : {}),
  };

  const calculatedTotalVerif = (Number(row.verificacoes_s1) || 0) + (Number(row.verificacoes_s2) || 0) + (Number(row.verificacoes_s3) || 0) + (Number(row.verificacoes_s4) || 0) + (Number(row.verificacoes_s5) || 0);
  const totalVerifDisplay = calculatedTotalVerif || (Number(row.total_verificacoes) || 0);

  const calculatedTotalNC = (Number(row.verificacoes_nc_s1) || 0) + (Number(row.verificacoes_nc_s2) || 0) + (Number(row.verificacoes_nc_s3) || 0) + (Number(row.verificacoes_nc_s4) || 0) + (Number(row.verificacoes_nc_s5) || 0);
  const totalNCDisplay = calculatedTotalNC || (Number(row.verificacoes_nc) || 0);

  const pctNCNumber = totalVerifDisplay > 0 ? Number(((totalNCDisplay / totalVerifDisplay) * 100).toFixed(1)) : 0;
  const pctNCDisplay = `${pctNCNumber}%`;

  const badgeClass = pctNCNumber === 0 
    ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700' 
    : pctNCNumber <= 25 
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40' 
    : pctNCNumber <= 50 
    ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40' 
    : 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40';

  // Base input style
  const baseInput = "h-8 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm transition-all focus:outline-none focus:ring-2";
  
  const numInputStyle = `${baseInput} w-full text-center px-1 text-blue-700 dark:text-blue-300 focus:border-blue-500 focus:ring-blue-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;
  const ncInputStyle = `${baseInput} w-full text-center px-1 text-rose-600 dark:text-rose-400 focus:border-rose-500 focus:ring-rose-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;
  const sideNumStyle = `${baseInput} w-full text-center px-1 text-slate-800 dark:text-slate-200 focus:border-primary focus:ring-primary/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;

  return (
    <TableRow ref={setNodeRef} style={style} className={`group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-200 dark:border-slate-800 ${isDragging ? 'shadow-lg opacity-90' : ''}`}>
      {/* Drag handle */}
      <TableCell className="p-1 w-9 text-center">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing hover:bg-slate-200 dark:hover:bg-slate-800 p-1 rounded-md text-slate-400 hover:text-slate-600 transition-colors inline-flex touch-none">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      </TableCell>

      {/* Nome ── Combobox com busca */}
      <TableCell className="p-1 min-w-[210px]">
        <ColaboradorCombobox
          value={row.nome_email}
          funcionariosList={funcionariosList}
          onChange={(nome) => handleChange(idx, 'nome_email', nome)}
        />
      </TableCell>

      {/* Cargo */}
      <TableCell className="p-1 min-w-[150px]">
        <Input 
          value={row.cargo || ''} 
          onChange={(e) => handleChange(idx, 'cargo', e.target.value)}
          className={`${baseInput} px-2.5 text-slate-700 dark:text-slate-300 font-normal focus:border-primary focus:ring-primary/20`}
          placeholder="Cargo"
        />
      </TableCell>

      {/* Letra */}
      <TableCell className="p-1 min-w-[80px]">
        <Input 
          value={row.letra || ''} 
          onChange={(e) => handleChange(idx, 'letra', e.target.value)}
          className={`${baseInput} text-center px-1 font-bold text-slate-800 dark:text-slate-200 uppercase focus:border-primary focus:ring-primary/20`}
          placeholder="Letra"
        />
      </TableCell>

      {/* ── VERIFICAÇÕES POR SEMANA (S1, S2, S3, S4, S5, TOTAL) ── */}
      <TableCell className="p-1 text-center min-w-[54px] bg-blue-50/25 dark:bg-blue-950/15">
        <Input 
          type="number" min="0" 
          value={row.verificacoes_s1 ?? ''} 
          onChange={(e) => handleChange(idx, 'verificacoes_s1', e.target.value)}
          onFocus={(e) => e.target.select()}
          className={numInputStyle}
          placeholder="0"
        />
      </TableCell>
      <TableCell className="p-1 text-center min-w-[54px] bg-blue-50/25 dark:bg-blue-950/15">
        <Input 
          type="number" min="0" 
          value={row.verificacoes_s2 ?? ''} 
          onChange={(e) => handleChange(idx, 'verificacoes_s2', e.target.value)}
          onFocus={(e) => e.target.select()}
          className={numInputStyle}
          placeholder="0"
        />
      </TableCell>
      <TableCell className="p-1 text-center min-w-[54px] bg-blue-50/25 dark:bg-blue-950/15">
        <Input 
          type="number" min="0" 
          value={row.verificacoes_s3 ?? ''} 
          onChange={(e) => handleChange(idx, 'verificacoes_s3', e.target.value)}
          onFocus={(e) => e.target.select()}
          className={numInputStyle}
          placeholder="0"
        />
      </TableCell>
      <TableCell className="p-1 text-center min-w-[54px] bg-blue-50/25 dark:bg-blue-950/15">
        <Input 
          type="number" min="0" 
          value={row.verificacoes_s4 ?? ''} 
          onChange={(e) => handleChange(idx, 'verificacoes_s4', e.target.value)}
          onFocus={(e) => e.target.select()}
          className={numInputStyle}
          placeholder="0"
        />
      </TableCell>
      <TableCell className="p-1 text-center min-w-[54px] bg-blue-50/25 dark:bg-blue-950/15">
        <Input 
          type="number" min="0" 
          value={row.verificacoes_s5 ?? ''} 
          onChange={(e) => handleChange(idx, 'verificacoes_s5', e.target.value)}
          onFocus={(e) => e.target.select()}
          className={numInputStyle}
          placeholder="0"
        />
      </TableCell>
      {/* Total Verificações */}
      <TableCell className="p-1 text-center min-w-[62px] bg-blue-100/50 dark:bg-blue-950/40 border-r border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-center h-8 px-2 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-blue-100 font-mono font-black text-xs shadow-inner">
          {totalVerifDisplay}
        </div>
      </TableCell>

      {/* ── TREINAMENTOS & ASSISTÊNCIA ── */}
      <TableCell className="p-1 text-center min-w-[75px]">
        <Input 
          type="number" min="0" 
          value={row.total_treinamentos || ''} 
          onChange={(e) => handleChange(idx, 'total_treinamentos', e.target.value)}
          onFocus={(e) => e.target.select()}
          className={sideNumStyle}
          placeholder="0"
        />
      </TableCell>
      <TableCell className="p-1 text-center min-w-[75px]">
        <Input 
          type="number" min="0" 
          value={row.total_assistencia || ''} 
          onChange={(e) => handleChange(idx, 'total_assistencia', e.target.value)}
          onFocus={(e) => e.target.select()}
          className={sideNumStyle}
          placeholder="0"
        />
      </TableCell>

      {/* ── VERIFICAÇÕES NC POR SEMANA (S1, S2, S3, S4, S5, TOTAL) ── */}
      <TableCell className="p-1 text-center min-w-[54px] bg-rose-50/25 dark:bg-rose-950/15 border-l border-rose-100 dark:border-rose-900/40">
        <Input 
          type="number" min="0" 
          value={row.verificacoes_nc_s1 ?? ''} 
          onChange={(e) => handleChange(idx, 'verificacoes_nc_s1', e.target.value)}
          onFocus={(e) => e.target.select()}
          className={ncInputStyle}
          placeholder="0"
        />
      </TableCell>
      <TableCell className="p-1 text-center min-w-[54px] bg-rose-50/25 dark:bg-rose-950/15">
        <Input 
          type="number" min="0" 
          value={row.verificacoes_nc_s2 ?? ''} 
          onChange={(e) => handleChange(idx, 'verificacoes_nc_s2', e.target.value)}
          onFocus={(e) => e.target.select()}
          className={ncInputStyle}
          placeholder="0"
        />
      </TableCell>
      <TableCell className="p-1 text-center min-w-[54px] bg-rose-50/25 dark:bg-rose-950/15">
        <Input 
          type="number" min="0" 
          value={row.verificacoes_nc_s3 ?? ''} 
          onChange={(e) => handleChange(idx, 'verificacoes_nc_s3', e.target.value)}
          onFocus={(e) => e.target.select()}
          className={ncInputStyle}
          placeholder="0"
        />
      </TableCell>
      <TableCell className="p-1 text-center min-w-[54px] bg-rose-50/25 dark:bg-rose-950/15">
        <Input 
          type="number" min="0" 
          value={row.verificacoes_nc_s4 ?? ''} 
          onChange={(e) => handleChange(idx, 'verificacoes_nc_s4', e.target.value)}
          onFocus={(e) => e.target.select()}
          className={ncInputStyle}
          placeholder="0"
        />
      </TableCell>
      <TableCell className="p-1 text-center min-w-[54px] bg-rose-50/25 dark:bg-rose-950/15">
        <Input 
          type="number" min="0" 
          value={row.verificacoes_nc_s5 ?? ''} 
          onChange={(e) => handleChange(idx, 'verificacoes_nc_s5', e.target.value)}
          onFocus={(e) => e.target.select()}
          className={ncInputStyle}
          placeholder="0"
        />
      </TableCell>
      {/* Total NC */}
      <TableCell className="p-1 text-center min-w-[62px] bg-rose-100/50 dark:bg-rose-950/40 border-r border-rose-200 dark:border-rose-800">
        <div className="flex items-center justify-center h-8 px-2 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-900 dark:text-rose-100 font-mono font-black text-xs shadow-inner">
          {totalNCDisplay}
        </div>
      </TableCell>

      {/* ── % NC & AÇÕES ── */}
      <TableCell className="p-1 text-center min-w-[75px]">
        <div className={`inline-flex items-center justify-center w-full h-8 px-2 rounded-md text-xs font-black shadow-sm ${badgeClass}`}>
          {pctNCDisplay}
        </div>
      </TableCell>
      <TableCell className="p-1 text-center w-9">
        <Button variant="ghost" size="icon" onClick={() => handleRemoveRow(idx)} className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-colors">
          <Trash className="w-4 h-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

interface N3DashboardProps {
  globalPeriod?: { start: string; end: string; label: string; };
}

export default function N3Dashboard({ globalPeriod }: N3DashboardProps) {
  const [data, setData] = useState<N3Data[]>([]);
  const [historicalData, setHistoricalData] = useState<N3Data[]>([]);
  const [cargoMapState, setCargoMapState] = useState<Record<string, string>>({});
  const [periodo, setPeriodo] = useState<string>((globalPeriod as unknown as string) || new Date().toISOString().substring(0, 7));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState(false);

  const handleClearMonth = async () => {
    if (!confirm(`Tem certeza que deseja apagar todos os lançamentos do período ${periodo}?`)) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('n3_lancamentos').delete().eq('periodo', periodo);
      if (error) throw error;
      toast.success('Dados apagados com sucesso!');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao apagar dados');
    } finally {
      setDeleting(false);
    }
  };

  const handleSortByNC = () => {
    const sorted = [...data].sort((a: N3Data, b: N3Data) => {
      const ncA = (Number(a.verificacoes_nc_s1) || 0) + (Number(a.verificacoes_nc_s2) || 0) + (Number(a.verificacoes_nc_s3) || 0) + (Number(a.verificacoes_nc_s4) || 0) + (Number(a.verificacoes_nc_s5) || 0) || Number(a.verificacoes_nc || 0);
      const ncB = (Number(b.verificacoes_nc_s1) || 0) + (Number(b.verificacoes_nc_s2) || 0) + (Number(b.verificacoes_nc_s3) || 0) + (Number(b.verificacoes_nc_s4) || 0) + (Number(b.verificacoes_nc_s5) || 0) || Number(b.verificacoes_nc || 0);
      const diff = ncB - ncA;
      return diff !== 0 ? diff : (a.nome_email || '').localeCompare(b.nome_email || '');
    });
    setData(sorted);
    toast.success('Lista atualizada pelo ranking de Verificações NC!');
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: { active: { id: string }; over: { id: string } | null }) => {
    const { active, over } = event;

    if (active && over && active.id !== over.id) {
      setData((items) => {
        const oldIndex = items.findIndex((i) => (i.id || '') === active.id);
        const newIndex = items.findIndex((i) => (i.id || '') === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  const [funcionariosList, setFuncionariosList] = useState<FuncItem[]>([]);

  const findBestFuncionario = (name: string, list: FuncItem[]) => {
    if (!name) return null;
    const cleanName = name.toUpperCase().trim();
    // exact match
    const exact = list.find(f => f.nome.toUpperCase().trim() === cleanName);
    if (exact) return exact;
    // partial / startsWith
    const parts = cleanName.split(' ');
    const first = parts[0];
    const last = parts[parts.length - 1];
    return list.find(f => {
      const fName = f.nome.toUpperCase().trim();
      return fName.includes(first) && fName.includes(last);
    });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: emps } = await supabase.from('funcionarios').select('id, nome, cargo, letra, turno').order('nome');
      const list = emps || [];
      setFuncionariosList(list);
      
      const cargoMap = list.reduce((acc: Record<string, string>, e: FuncItem) => {
        if (e.nome) acc[e.nome.toUpperCase().trim()] = (e.cargo || '').trim();
        return acc;
      }, {});
      setCargoMapState(cargoMap);

      const { data: allData, error } = await supabase
        .from('n3_lancamentos')
        .select('*')
        .order('periodo', { ascending: true });

      if (error) {
        console.error('Erro ao buscar n3_lancamentos. Inicializando padrão.');
        initMockData(cargoMap, list);
      } else {
        const decodedAll = (allData || []).map((d: Record<string, unknown>) => decodeN3Row(d, cargoMap));
        setHistoricalData(decodedAll);
        
        let currentPeriodData: N3Data[] = [];
        if (periodo === 'all') {
          const aggregated = decodedAll.reduce((acc: Record<string, N3Data>, curr: N3Data) => {
            const key = curr.nome_email;
            if (!acc[key]) {
              acc[key] = {
                ...curr,
                id: key,
                periodo: 'all',
                total_verificacoes: 0,
                total_treinamentos: 0,
                total_assistencia: 0,
                verificacoes_nc: 0,
                verificacoes_s1: 0,
                verificacoes_s2: 0,
                verificacoes_s3: 0,
                verificacoes_s4: 0,
                verificacoes_s5: 0,
                verificacoes_nc_s1: 0,
                verificacoes_nc_s2: 0,
                verificacoes_nc_s3: 0,
                verificacoes_nc_s4: 0,
                verificacoes_nc_s5: 0,
                perguntas_nc: 0
              };
            }
            acc[key].total_verificacoes += Number(curr.total_verificacoes || 0);
            acc[key].total_treinamentos += Number(curr.total_treinamentos || 0);
            acc[key].total_assistencia += Number(curr.total_assistencia || 0);
            acc[key].verificacoes_nc += Number(curr.verificacoes_nc || 0);
            acc[key].verificacoes_s1 = (acc[key].verificacoes_s1 || 0) + Number(curr.verificacoes_s1 || 0);
            acc[key].verificacoes_s2 = (acc[key].verificacoes_s2 || 0) + Number(curr.verificacoes_s2 || 0);
            acc[key].verificacoes_s3 = (acc[key].verificacoes_s3 || 0) + Number(curr.verificacoes_s3 || 0);
            acc[key].verificacoes_s4 = (acc[key].verificacoes_s4 || 0) + Number(curr.verificacoes_s4 || 0);
            acc[key].verificacoes_s5 = (acc[key].verificacoes_s5 || 0) + Number(curr.verificacoes_s5 || 0);
            acc[key].verificacoes_nc_s1 = (acc[key].verificacoes_nc_s1 || 0) + Number(curr.verificacoes_nc_s1 || 0);
            acc[key].verificacoes_nc_s2 = (acc[key].verificacoes_nc_s2 || 0) + Number(curr.verificacoes_nc_s2 || 0);
            acc[key].verificacoes_nc_s3 = (acc[key].verificacoes_nc_s3 || 0) + Number(curr.verificacoes_nc_s3 || 0);
            acc[key].verificacoes_nc_s4 = (acc[key].verificacoes_nc_s4 || 0) + Number(curr.verificacoes_nc_s4 || 0);
            acc[key].verificacoes_nc_s5 = (acc[key].verificacoes_nc_s5 || 0) + Number(curr.verificacoes_nc_s5 || 0);
            return acc;
          }, {});
          currentPeriodData = Object.values(aggregated);
        } else {
          currentPeriodData = decodedAll.filter((d: N3Data) => d.periodo === periodo);
        }

        if (currentPeriodData.length > 0) {
          const sorted = currentPeriodData.sort((a: N3Data, b: N3Data) => {
            const ncA = (Number(a.verificacoes_nc_s1) || 0) + (Number(a.verificacoes_nc_s2) || 0) + (Number(a.verificacoes_nc_s3) || 0) + (Number(a.verificacoes_nc_s4) || 0) + (Number(a.verificacoes_nc_s5) || 0) || Number(a.verificacoes_nc || 0);
            const ncB = (Number(b.verificacoes_nc_s1) || 0) + (Number(b.verificacoes_nc_s2) || 0) + (Number(b.verificacoes_nc_s3) || 0) + (Number(b.verificacoes_nc_s4) || 0) + (Number(b.verificacoes_nc_s5) || 0) || Number(b.verificacoes_nc || 0);
            const diff = ncB - ncA;
            return diff !== 0 ? diff : (a.nome_email || '').localeCompare(b.nome_email || '');
          });
          setData(sorted);
        } else {
          initMockData(cargoMap, list);
        }
      }
    } catch {
      initMockData();
    }
    setLoading(false);
  };

  const initMockData = (cargoMap: Record<string, string> = {}, list: FuncItem[] = []) => {
    setData(
      DEFAULT_NAMES.map(colab => {
        const found = findBestFuncionario(colab.nome, list);
        const nomeFinal = found ? found.nome : colab.nome;
        const cargoFinal = found?.cargo || colab.cargo || cargoMap[nomeFinal.toUpperCase().trim()] || '';
        const letraFinal = found?.letra ? (found.turno?.toLowerCase().includes('noite') ? `${found.letra} Noite` : found.turno?.toLowerCase().includes('dia') ? `${found.letra} Dia` : found.letra) : colab.letra;

        return {
          id: Math.random().toString(36).substring(2, 9),
          nome_email: nomeFinal,
          cargo: cargoFinal,
          letra: letraFinal,
          periodo,
          total_verificacoes: 0,
          total_treinamentos: 0,
          total_assistencia: 0,
          verificacoes_nc: 0,
          verificacoes_s1: 0,
          verificacoes_s2: 0,
          verificacoes_s3: 0,
          verificacoes_s4: 0,
          verificacoes_s5: 0,
          verificacoes_nc_s1: 0,
          verificacoes_nc_s2: 0,
          verificacoes_nc_s3: 0,
          verificacoes_nc_s4: 0,
          verificacoes_nc_s5: 0
        };
      })
    );
  };

  const handleChange = (index: number, field: keyof N3Data, value: string) => {
    const newData = [...data];
    if (field === 'nome_email' || field === 'letra' || field === 'cargo') {
      newData[index] = { ...newData[index], [field]: value };
      
      if (field === 'nome_email') {
        const func = funcionariosList.find((f: FuncItem) => f.nome === value);
        if (func) {
          if (func.cargo) newData[index].cargo = func.cargo;
          if (func.letra) {
            const turnoStr = func.turno?.toLowerCase().includes('noite') ? 'Noite' : func.turno?.toLowerCase().includes('dia') ? 'Dia' : '';
            newData[index].letra = turnoStr ? `${func.letra} ${turnoStr}` : func.letra;
          }
        }
      }
    } else {
      const numVal = value === '' ? 0 : Number(value) || 0;
      newData[index] = { ...newData[index], [field]: numVal };

      // Recalculate row totals
      const row = newData[index];
      row.total_verificacoes = (Number(row.verificacoes_s1) || 0) + (Number(row.verificacoes_s2) || 0) + (Number(row.verificacoes_s3) || 0) + (Number(row.verificacoes_s4) || 0) + (Number(row.verificacoes_s5) || 0);
      row.verificacoes_nc = (Number(row.verificacoes_nc_s1) || 0) + (Number(row.verificacoes_nc_s2) || 0) + (Number(row.verificacoes_nc_s3) || 0) + (Number(row.verificacoes_nc_s4) || 0) + (Number(row.verificacoes_nc_s5) || 0);
    }
    setData(newData);
  };

  const handleAddRow = () => {
    setData([...data, {
      id: Math.random().toString(36).substring(2, 9),
      nome_email: '',
      cargo: '',
      letra: '',
      periodo,
      total_verificacoes: 0,
      total_treinamentos: 0,
      total_assistencia: 0,
      verificacoes_nc: 0,
      verificacoes_s1: 0,
      verificacoes_s2: 0,
      verificacoes_s3: 0,
      verificacoes_s4: 0,
      verificacoes_s5: 0,
      verificacoes_nc_s1: 0,
      verificacoes_nc_s2: 0,
      verificacoes_nc_s3: 0,
      verificacoes_nc_s4: 0,
      verificacoes_nc_s5: 0
    }]);
  };

  const handleRemoveRow = (index: number) => {
    const newData = [...data];
    newData.splice(index, 1);
    setData(newData);
  };

  const handleSave = async () => {
    if (periodo === 'all') {
      toast.error('Selecione um mês específico para postar os dados.');
      return;
    }
    setSaving(true);
    try {
      await supabase.from('n3_lancamentos').delete().eq('periodo', periodo);
      
      const insertPayload = data.map(d => encodeN3Row(d));

      const { error } = await supabase.from('n3_lancamentos').insert(insertPayload);

      if (error) throw error;
      toast.success('Lançamentos N3 postados com sucesso!');
      fetchData(); 
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Ocorreu um erro ao salvar: ' + msg);
    }
    setSaving(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ab = await file.arrayBuffer();
      const rawData = await readExcelRows(ab);

      const importedData: N3Data[] = rawData.map((row: Record<string, unknown>) => {
        const nome = (row['NOME-EMAIL'] || row['Nome'] || row['NOME'] || '') as string;
        const vs1 = Number(row['VERIF S1'] || row['S1 Verificacoes'] || row['S1'] || 0);
        const vs2 = Number(row['VERIF S2'] || row['S2 Verificacoes'] || row['S2'] || 0);
        const vs3 = Number(row['VERIF S3'] || row['S3 Verificacoes'] || row['S3'] || 0);
        const vs4 = Number(row['VERIF S4'] || row['S4 Verificacoes'] || row['S4'] || 0);
        const vs5 = Number(row['VERIF S5'] || row['S5 Verificacoes'] || row['S5'] || 0);

        const ncs1 = Number(row['NC S1'] || row['S1 NC'] || 0);
        const ncs2 = Number(row['NC S2'] || row['S2 NC'] || 0);
        const ncs3 = Number(row['NC S3'] || row['S3 NC'] || 0);
        const ncs4 = Number(row['NC S4'] || row['S4 NC'] || 0);
        const ncs5 = Number(row['NC S5'] || row['S5 NC'] || 0);

        const totVerif = (vs1 + vs2 + vs3 + vs4 + vs5) || Number(row['TOTAL VERIFICAÇÕES'] || row['Total Verificações'] || 0);
        const totNC = (ncs1 + ncs2 + ncs3 + ncs4 + ncs5) || Number(row['VERIFICAÇÕES NÃO CONFORMES'] || row['Verificações NC'] || 0);

        return {
          id: Math.random().toString(36).substring(2, 9),
          nome_email: nome,
          cargo: (row['CARGO'] || row['Cargo'] || cargoMapState[nome.toUpperCase().trim()] || '') as string,
          letra: (row['LETRA'] || row['Letra'] || '') as string,
          periodo: periodo,
          total_verificacoes: totVerif,
          total_treinamentos: Number(row['TOTAL TREINAMENTOS'] || row['Total Treinamentos'] || 0),
          total_assistencia: Number(row['TOTAL ASSISTÊNCIA'] || row['Total Assistência'] || 0),
          verificacoes_nc: totNC,
          verificacoes_s1: vs1,
          verificacoes_s2: vs2,
          verificacoes_s3: vs3,
          verificacoes_s4: vs4,
          verificacoes_s5: vs5,
          verificacoes_nc_s1: ncs1,
          verificacoes_nc_s2: ncs2,
          verificacoes_nc_s3: ncs3,
          verificacoes_nc_s4: ncs4,
          verificacoes_nc_s5: ncs5,
        };
      });

      if (importedData.length > 0) {
        setData(importedData);
        toast.success('Planilha importada! Clique em Postar para salvar.');
      } else {
        toast.error('Planilha vazia ou formato inválido.');
      }
    } catch {
      toast.error('Erro ao ler a planilha.');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = async () => {
    const templateData = [
      {
        'NOME-EMAIL': 'CRISTALLY DE JESUS NETTO',
        'CARGO': 'Técnico de Segurança',
        'LETRA': 'A Noite',
        'VERIF S1': 5,
        'VERIF S2': 5,
        'VERIF S3': 5,
        'VERIF S4': 5,
        'VERIF S5': 0,
        'TOTAL TREINAMENTOS': 1,
        'TOTAL ASSISTÊNCIA': 0,
        'NC S1': 1,
        'NC S2': 0,
        'NC S3': 0,
        'NC S4': 1,
        'NC S5': 0,
      }
    ];
    await writeExcelFile(templateData as Record<string, unknown>[], 'Modelo_Importacao_N3_Semanal.xlsx', 'N3_Template');
  };

  const filteredHistoricalData = useMemo(() => {
    if (!globalPeriod) return historicalData;
    const startMonth = globalPeriod.start.substring(0, 7);
    const endMonth = globalPeriod.end.substring(0, 7);
    return historicalData.filter(curr => curr.periodo >= startMonth && curr.periodo <= endMonth);
  }, [historicalData, globalPeriod]);

  const kpis = useMemo(() => {
    const totais = {
      verificacoes: 0,
      treinamentos: 0,
      assistencia: 0,
      ncs: 0
    };

    filteredHistoricalData.forEach(d => {
      const totVerif = (Number(d.verificacoes_s1) || 0) + (Number(d.verificacoes_s2) || 0) + (Number(d.verificacoes_s3) || 0) + (Number(d.verificacoes_s4) || 0) + (Number(d.verificacoes_s5) || 0) || Number(d.total_verificacoes || 0);
      const totNc = (Number(d.verificacoes_nc_s1) || 0) + (Number(d.verificacoes_nc_s2) || 0) + (Number(d.verificacoes_nc_s3) || 0) + (Number(d.verificacoes_nc_s4) || 0) + (Number(d.verificacoes_nc_s5) || 0) || Number(d.verificacoes_nc || 0);
      totais.verificacoes += totVerif;
      totais.treinamentos += Number(d.total_treinamentos || 0);
      totais.assistencia += Number(d.total_assistencia || 0);
      totais.ncs += totNc;
    });

    const pctNc = totais.verificacoes > 0 ? ((totais.ncs / totais.verificacoes) * 100).toFixed(1) : '0.0';

    return { totais, pctNc };
  }, [filteredHistoricalData]);

  const chartData = useMemo(() => {
    const aggregated = filteredHistoricalData.reduce((acc, curr) => {
      const name = curr.nome_email.split(' ')[0] || 'Novo';
      if (!acc[name]) {
        acc[name] = { name, Verificações: 0, Treinamentos: 0, 'Não Conformes': 0 };
      }
      const totVerif = (Number(curr.verificacoes_s1) || 0) + (Number(curr.verificacoes_s2) || 0) + (Number(curr.verificacoes_s3) || 0) + (Number(curr.verificacoes_s4) || 0) + (Number(curr.verificacoes_s5) || 0) || Number(curr.total_verificacoes || 0);
      const totNc = (Number(curr.verificacoes_nc_s1) || 0) + (Number(curr.verificacoes_nc_s2) || 0) + (Number(curr.verificacoes_nc_s3) || 0) + (Number(curr.verificacoes_nc_s4) || 0) + (Number(curr.verificacoes_nc_s5) || 0) || Number(curr.verificacoes_nc || 0);

      acc[name].Verificações += totVerif;
      acc[name].Treinamentos += Number(curr.total_treinamentos || 0);
      acc[name]['Não Conformes'] += totNc;
      return acc;
    }, {} as Record<string, { name: string; Verificações: number; Treinamentos: number; 'Não Conformes': number }>);
    return Object.values(aggregated).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredHistoricalData]);

  const evolutionChartData = useMemo(() => {
    const grouped = filteredHistoricalData.reduce((acc, curr) => {
      if (!acc[curr.periodo]) {
        acc[curr.periodo] = { periodo: curr.periodo, 'Total Verificações': 0, 'Total Treinamentos': 0, 'Total Não Conformes': 0 };
      }
      const totVerif = (Number(curr.verificacoes_s1) || 0) + (Number(curr.verificacoes_s2) || 0) + (Number(curr.verificacoes_s3) || 0) + (Number(curr.verificacoes_s4) || 0) + (Number(curr.verificacoes_s5) || 0) || Number(curr.total_verificacoes || 0);
      const totNc = (Number(curr.verificacoes_nc_s1) || 0) + (Number(curr.verificacoes_nc_s2) || 0) + (Number(curr.verificacoes_nc_s3) || 0) + (Number(curr.verificacoes_nc_s4) || 0) + (Number(curr.verificacoes_nc_s5) || 0) || Number(curr.verificacoes_nc || 0);

      (acc[curr.periodo]['Total Verificações'] as number) += totVerif;
      (acc[curr.periodo]['Total Treinamentos'] as number) += Number(curr.total_treinamentos || 0);
      (acc[curr.periodo]['Total Não Conformes'] as number) += totNc;
      return acc;
    }, {} as Record<string, Record<string, number | string>>);
    return Object.values(grouped).sort((a, b) => a.periodo.localeCompare(b.periodo));
  }, [filteredHistoricalData]);

  const uniqueNames = useMemo(() => {
    const names = new Set<string>();
    filteredHistoricalData.forEach(d => names.add(d.nome_email.split(' ')[0] || 'Novo'));
    return Array.from(names).sort();
  }, [filteredHistoricalData]);

  const evolutionByPersonData = useMemo(() => {
    const grouped = filteredHistoricalData.reduce((acc, curr) => {
      if (!acc[curr.periodo]) {
        acc[curr.periodo] = { periodo: curr.periodo };
        uniqueNames.forEach(name => {
          acc[curr.periodo][name] = 0;
        });
      }
      const name = curr.nome_email.split(' ')[0] || 'Novo';
      const totNc = (Number(curr.verificacoes_nc_s1) || 0) + (Number(curr.verificacoes_nc_s2) || 0) + (Number(curr.verificacoes_nc_s3) || 0) + (Number(curr.verificacoes_nc_s4) || 0) + (Number(curr.verificacoes_nc_s5) || 0) || Number(curr.verificacoes_nc || 0);
      (acc[curr.periodo][name] as number) += totNc;
      return acc;
    }, {} as Record<string, Record<string, number | string>>);
    return Object.values(grouped).sort((a, b) => a.periodo.localeCompare(b.periodo));
  }, [filteredHistoricalData, uniqueNames]);
  
  const colors = [
    '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#3b82f6', '#f97316', '#06b6d4', '#ef4444', '#84cc16'
  ];

  return (
    <div className="space-y-6">
      {/* KPIs Top Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-white/50 dark:border-slate-800/50 shadow-lg shadow-blue-500/5 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-400/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
          <CardContent className="p-5 flex items-center justify-between relative z-10">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Verificações</p>
              <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">{kpis.totais.verificacoes}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/50 dark:to-blue-800/30 flex items-center justify-center border border-blue-200/50 dark:border-blue-700/50 shadow-inner group-hover:rotate-6 transition-transform duration-300">
              <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400 drop-shadow-sm" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-white/50 dark:border-slate-800/50 shadow-lg shadow-indigo-500/5 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-400/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
          <CardContent className="p-5 flex items-center justify-between relative z-10">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Treinamentos</p>
              <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">{kpis.totais.treinamentos}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900/50 dark:to-indigo-800/30 flex items-center justify-center border border-indigo-200/50 dark:border-indigo-700/50 shadow-inner group-hover:rotate-6 transition-transform duration-300">
              <Target className="w-6 h-6 text-indigo-600 dark:text-indigo-400 drop-shadow-sm" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-white/50 dark:border-slate-800/50 shadow-lg shadow-rose-500/5 hover:-translate-y-1 hover:shadow-xl hover:shadow-rose-500/10 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-400/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
          <CardContent className="p-5 flex items-center justify-between relative z-10">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Não Conformidades</p>
              <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">{kpis.totais.ncs}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-100 to-rose-50 dark:from-rose-900/50 dark:to-rose-800/30 flex items-center justify-center border border-rose-200/50 dark:border-rose-700/50 shadow-inner group-hover:rotate-6 transition-transform duration-300">
              <ShieldAlert className="w-6 h-6 text-rose-600 dark:text-rose-400 drop-shadow-sm" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-white/50 dark:border-slate-800/50 shadow-lg shadow-amber-500/5 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-400/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
          <CardContent className="p-5 flex items-center justify-between relative z-10">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Taxa de NC Global</p>
              <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">{kpis.pctNc}%</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/50 dark:to-amber-800/30 flex items-center justify-center border border-amber-200/50 dark:border-amber-700/50 shadow-inner group-hover:rotate-6 transition-transform duration-300">
              <BarChart3 className="w-6 h-6 text-amber-600 dark:text-amber-400 drop-shadow-sm" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <div className="space-y-4">
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
            <CardHeader className="flex flex-col xl:flex-row items-start xl:items-center justify-between pb-4 gap-4 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Lançamentos N3 - CRM</CardTitle>
                  <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Controle semanal detalhado (S1 a S5) por colaborador</CardDescription>
                </div>
                <Select value={periodo} onValueChange={setPeriodo}>
                  <SelectTrigger className="w-[160px] h-9 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm">
                    <SelectValue placeholder="Selecione o Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                    ].map((m, i) => {
                      const val = '2026-' + (i + 1).toString().padStart(2, '0');
                      return <SelectItem key={val} value={val} className="text-xs font-medium">{m} 2026</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 text-xs h-9 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 rounded-lg shadow-sm font-semibold">
                      <MoreHorizontal className="w-4 h-4" /> Opções
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 shadow-xl">
                    <DropdownMenuItem onClick={handleDownloadTemplate} className="gap-2 text-xs font-medium cursor-pointer">
                      <Download className="w-4 h-4" /> Baixar Modelo Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2 text-xs font-medium cursor-pointer">
                      <Upload className="w-4 h-4" /> Importar Planilha
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSortByNC} className="gap-2 text-xs font-medium cursor-pointer">
                      <BarChart3 className="w-4 h-4" /> Ordenar por Maior NC
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleClearMonth} disabled={deleting} className="gap-2 text-xs font-bold text-rose-600 focus:bg-rose-50 focus:text-rose-700 cursor-pointer">
                      <Trash className="w-4 h-4" /> {deleting ? 'Limpando...' : 'Limpar Mês'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button onClick={handleAddRow} size="sm" variant="outline" className="gap-1.5 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 rounded-lg shadow-sm text-xs h-9 font-semibold">
                  <Plus className="w-4 h-4" /> Adicionar
                </Button>
                
                <Button onClick={handleSave} disabled={saving || loading} size="sm" className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 border-0 rounded-lg transition-all hover:scale-[1.02] text-xs h-9 px-5 font-bold">
                  <Save className="w-4 h-4" /> {saving ? 'Postando...' : 'Postar'}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <Table className="text-xs w-full">
                    <TableHeader className="bg-slate-100 dark:bg-slate-800/90 select-none">
                      {/* Top Header Group */}
                      <TableRow className="border-b border-slate-200 dark:border-slate-700/80">
                        <TableHead rowSpan={2} className="w-9 p-1 text-center bg-slate-100 dark:bg-slate-800/90"></TableHead>
                        <TableHead rowSpan={2} className="min-w-[210px] p-2.5 font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[11px] bg-slate-100 dark:bg-slate-800/90">
                          NOME
                        </TableHead>
                        <TableHead rowSpan={2} className="min-w-[150px] p-2.5 font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[11px] bg-slate-100 dark:bg-slate-800/90">
                          CARGO
                        </TableHead>
                        <TableHead rowSpan={2} className="min-w-[80px] p-2.5 font-bold text-slate-700 dark:text-slate-200 text-center uppercase tracking-wider text-[11px] bg-slate-100 dark:bg-slate-800/90">
                          LETRA
                        </TableHead>
                        
                        {/* Grupo: VERIFICAÇÕES (S1 a S5 + TOTAL = colSpan 6) */}
                        <TableHead colSpan={6} className="p-2 text-center font-black text-blue-700 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-950/60 border-x border-blue-200 dark:border-blue-800/60 uppercase tracking-wider text-[11px]">
                          VERIFICAÇÕES POR SEMANA
                        </TableHead>

                        <TableHead rowSpan={2} className="min-w-[75px] p-2 font-bold text-slate-700 dark:text-slate-200 text-center uppercase tracking-wider text-[10px] leading-tight bg-slate-100 dark:bg-slate-800/90">
                          T.<br/>TREINAMENTOS
                        </TableHead>
                        <TableHead rowSpan={2} className="min-w-[75px] p-2 font-bold text-slate-700 dark:text-slate-200 text-center uppercase tracking-wider text-[10px] leading-tight bg-slate-100 dark:bg-slate-800/90">
                          T.<br/>ASSISTÊNCIA
                        </TableHead>

                        {/* Grupo: VERIFICAÇÕES NC (S1 a S5 + TOTAL = colSpan 6) */}
                        <TableHead colSpan={6} className="p-2 text-center font-black text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950/60 border-x border-rose-200 dark:border-rose-800/60 uppercase tracking-wider text-[11px]">
                          VERIFICAÇÕES NC POR SEMANA
                        </TableHead>

                        <TableHead rowSpan={2} className="min-w-[75px] p-2.5 font-bold text-slate-700 dark:text-slate-200 text-center uppercase tracking-wider text-[11px] bg-slate-100 dark:bg-slate-800/90">
                          % NC
                        </TableHead>
                        <TableHead rowSpan={2} className="w-9 p-1 text-center bg-slate-100 dark:bg-slate-800/90"></TableHead>
                      </TableRow>

                      {/* Sub Header (S1..S5 + TOTAL) */}
                      <TableRow className="border-b border-slate-200 dark:border-slate-700">
                        {/* Sub-colunas Verificações */}
                        <TableHead className="p-1 text-center font-extrabold text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/30 min-w-[54px]">S1</TableHead>
                        <TableHead className="p-1 text-center font-extrabold text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/30 min-w-[54px]">S2</TableHead>
                        <TableHead className="p-1 text-center font-extrabold text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/30 min-w-[54px]">S3</TableHead>
                        <TableHead className="p-1 text-center font-extrabold text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/30 min-w-[54px]">S4</TableHead>
                        <TableHead className="p-1 text-center font-extrabold text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/30 min-w-[54px]">S5</TableHead>
                        <TableHead className="p-1 text-center font-black text-blue-900 dark:text-blue-100 bg-blue-100 dark:bg-blue-900/60 border-r border-blue-200 dark:border-blue-800 min-w-[62px]">TOTAL</TableHead>

                        {/* Sub-colunas Verificações NC */}
                        <TableHead className="p-1 text-center font-extrabold text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/30 border-l border-rose-100 dark:border-rose-900/40 min-w-[54px]">S1</TableHead>
                        <TableHead className="p-1 text-center font-extrabold text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/30 min-w-[54px]">S2</TableHead>
                        <TableHead className="p-1 text-center font-extrabold text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/30 min-w-[54px]">S3</TableHead>
                        <TableHead className="p-1 text-center font-extrabold text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/30 min-w-[54px]">S4</TableHead>
                        <TableHead className="p-1 text-center font-extrabold text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/30 min-w-[54px]">S5</TableHead>
                        <TableHead className="p-1 text-center font-black text-rose-900 dark:text-rose-100 bg-rose-100 dark:bg-rose-900/60 border-r border-rose-200 dark:border-rose-800 min-w-[62px]">TOTAL</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      <SortableContext items={data.map(d => d.id || '')} strategy={verticalListSortingStrategy}>
                        {data.map((row, idx) => (
                          <SortableRow 
                            key={row.id || `row-${idx}`} 
                            row={row} 
                            idx={idx} 
                            handleChange={handleChange} 
                            handleRemoveRow={handleRemoveRow} 
                            funcionariosList={funcionariosList}
                          />
                        ))}
                      </SortableContext>

                      {/* ── ROW TOTAL GERAL NO RODAPÉ ── */}
                      {(() => {
                        if (data.length === 0) return null;

                        const totals = data.reduce((acc, curr) => {
                          const vs1 = Number(curr.verificacoes_s1) || 0;
                          const vs2 = Number(curr.verificacoes_s2) || 0;
                          const vs3 = Number(curr.verificacoes_s3) || 0;
                          const vs4 = Number(curr.verificacoes_s4) || 0;
                          const vs5 = Number(curr.verificacoes_s5) || 0;
                          const totV = (vs1 + vs2 + vs3 + vs4 + vs5) || Number(curr.total_verificacoes || 0);

                          const ncs1 = Number(curr.verificacoes_nc_s1) || 0;
                          const ncs2 = Number(curr.verificacoes_nc_s2) || 0;
                          const ncs3 = Number(curr.verificacoes_nc_s3) || 0;
                          const ncs4 = Number(curr.verificacoes_nc_s4) || 0;
                          const ncs5 = Number(curr.verificacoes_nc_s5) || 0;
                          const totN = (ncs1 + ncs2 + ncs3 + ncs4 + ncs5) || Number(curr.verificacoes_nc || 0);

                          return {
                            vs1: acc.vs1 + vs1,
                            vs2: acc.vs2 + vs2,
                            vs3: acc.vs3 + vs3,
                            vs4: acc.vs4 + vs4,
                            vs5: acc.vs5 + vs5,
                            totalVerif: acc.totalVerif + totV,

                            treinamentos: acc.treinamentos + Number(curr.total_treinamentos || 0),
                            assistencia: acc.assistencia + Number(curr.total_assistencia || 0),

                            ncs1: acc.ncs1 + ncs1,
                            ncs2: acc.ncs2 + ncs2,
                            ncs3: acc.ncs3 + ncs3,
                            ncs4: acc.ncs4 + ncs4,
                            ncs5: acc.ncs5 + ncs5,
                            totalNC: acc.totalNC + totN,
                          };
                        }, { 
                          vs1: 0, vs2: 0, vs3: 0, vs4: 0, vs5: 0, totalVerif: 0, 
                          treinamentos: 0, assistencia: 0, 
                          ncs1: 0, ncs2: 0, ncs3: 0, ncs4: 0, ncs5: 0, totalNC: 0 
                        });

                        const pctNcGlobal = totals.totalVerif > 0 ? ((totals.totalNC / totals.totalVerif) * 100).toFixed(1) : "0.0";
                        const numPctGlobal = Number(pctNcGlobal);
                        const totalsBadgeClass = numPctGlobal === 0
                          ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                          : numPctGlobal <= 25 
                          ? 'bg-emerald-600 text-white shadow-sm' 
                          : numPctGlobal <= 50 
                          ? 'bg-amber-500 text-white shadow-sm' 
                          : 'bg-rose-600 text-white shadow-sm';
                        
                        return (
                          <TableRow className="bg-slate-100/90 dark:bg-slate-800/90 font-bold hover:bg-slate-100 border-t-2 border-slate-300 dark:border-slate-700">
                            <TableCell colSpan={4} className="text-right p-3 font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider text-xs">
                              TOTAL GERAL:
                            </TableCell>

                            {/* Totais Verificações por semana */}
                            <TableCell className="text-center p-1.5 font-mono text-blue-700 dark:text-blue-300 font-extrabold text-xs">{totals.vs1}</TableCell>
                            <TableCell className="text-center p-1.5 font-mono text-blue-700 dark:text-blue-300 font-extrabold text-xs">{totals.vs2}</TableCell>
                            <TableCell className="text-center p-1.5 font-mono text-blue-700 dark:text-blue-300 font-extrabold text-xs">{totals.vs3}</TableCell>
                            <TableCell className="text-center p-1.5 font-mono text-blue-700 dark:text-blue-300 font-extrabold text-xs">{totals.vs4}</TableCell>
                            <TableCell className="text-center p-1.5 font-mono text-blue-700 dark:text-blue-300 font-extrabold text-xs">{totals.vs5}</TableCell>
                            <TableCell className="text-center p-1.5 font-mono bg-blue-100 dark:bg-blue-900/60 border-r border-blue-200 dark:border-blue-800">
                              <span className="inline-flex items-center justify-center min-w-[36px] px-2 py-1 rounded bg-blue-600 text-white font-mono font-black text-xs shadow-sm">
                                {totals.totalVerif}
                              </span>
                            </TableCell>

                            {/* Totais Treinamentos & Assistência */}
                            <TableCell className="text-center p-1.5 font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">{totals.treinamentos}</TableCell>
                            <TableCell className="text-center p-1.5 font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">{totals.assistencia}</TableCell>

                            {/* Totais NC por semana */}
                            <TableCell className="text-center p-1.5 font-mono text-rose-700 dark:text-rose-300 font-extrabold text-xs border-l border-rose-100 dark:border-rose-900/40">{totals.ncs1}</TableCell>
                            <TableCell className="text-center p-1.5 font-mono text-rose-700 dark:text-rose-300 font-extrabold text-xs">{totals.ncs2}</TableCell>
                            <TableCell className="text-center p-1.5 font-mono text-rose-700 dark:text-rose-300 font-extrabold text-xs">{totals.ncs3}</TableCell>
                            <TableCell className="text-center p-1.5 font-mono text-rose-700 dark:text-rose-300 font-extrabold text-xs">{totals.ncs4}</TableCell>
                            <TableCell className="text-center p-1.5 font-mono text-rose-700 dark:text-rose-300 font-extrabold text-xs">{totals.ncs5}</TableCell>
                            <TableCell className="text-center p-1.5 font-mono bg-rose-100 dark:bg-rose-900/60 border-r border-rose-200 dark:border-rose-800">
                              <span className="inline-flex items-center justify-center min-w-[36px] px-2 py-1 rounded bg-rose-600 text-white font-mono font-black text-xs shadow-sm">
                                {totals.totalNC}
                              </span>
                            </TableCell>

                            {/* Total % NC */}
                            <TableCell className="text-center p-1.5">
                              <div className={`inline-flex items-center justify-center w-full py-1 px-2 rounded-md text-xs font-black ${totalsBadgeClass}`}>
                                {pctNcGlobal}%
                              </div>
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        );
                      })()}
                    </TableBody>
                  </Table>
                </DndContext>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <ExpandableChart title="Engajamento por Colaborador" description="Volume de entregas no período">
          <div className="h-[240px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} tickMargin={10} />
                  <YAxis axisLine={false} tickLine={false} fontSize={12} />
                  <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="Verificações" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="Verificações" position="top" fill="hsl(var(--primary))" fontSize={11} fontWeight="bold" />
                  </Bar>
                  
                  <Bar dataKey="Não Conformes" fill="#ef4444" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="Não Conformes" position="top" fill="#ef4444" fontSize={11} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Sem dados para o gráfico
              </div>
            )}
          </div>
        </ExpandableChart>

        <ExpandableChart title="Evolução Geral do Contrato" description="Crescimento de Verificações e Não Conformes">
          <div className="h-[240px] w-full">
            {evolutionChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolutionChartData} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVerif" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorNC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                  <XAxis dataKey="periodo" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                  <ReferenceLine y={140} ifOverflow="extendDomain" stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Meta N3 (140)', fill: '#ef4444', fontSize: 12, fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="Total Verificações" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorVerif)">
                    <LabelList dataKey="Total Verificações" position="top" fill="#3b82f6" fontSize={11} fontWeight="bold" />
                  </Area>
                  <Area type="monotone" dataKey="Total Não Conformes" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorNC)">
                    <LabelList dataKey="Total Não Conformes" position="bottom" fill="#ef4444" fontSize={11} fontWeight="bold" />
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados históricos</div>
            )}
          </div>
        </ExpandableChart>

        <ExpandableChart title="Evolução por Colaborador" description="Não Conformes ao longo do tempo">
          <div className="h-[240px] w-full">
            {evolutionByPersonData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionByPersonData} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                  <XAxis dataKey="periodo" axisLine={false} tickLine={false} fontSize={12} tickMargin={10} />
                  <YAxis axisLine={false} tickLine={false} fontSize={12} />
                  <RechartsTooltip cursor={{ stroke: 'rgba(0,0,0,0.1)', strokeWidth: 2 }} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <ReferenceLine y={45} ifOverflow="extendDomain" stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Meta N3 (45)', fill: '#ef4444', fontSize: 12, fontWeight: 'bold' }} />
                  {uniqueNames.map((name, idx) => (
                    <Line key={name} type="monotone" dataKey={name} stroke={colors[idx % colors.length]} strokeWidth={2} dot={{ r: 4 }}>
                      <LabelList dataKey={name} position="top" fill={colors[idx % colors.length]} fontSize={11} fontWeight="bold" />
                    </Line>
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados históricos</div>
            )}
          </div>
        </ExpandableChart>
      </div>
    </div>
  );
}
