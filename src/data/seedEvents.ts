import seedData from './seedEvents.json';

export interface EventRow {
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
  categoria_evento?: string;
  encaminhamento_medico?: string;
  area?: string;
  created_at: string;
}

export const SEED_EVENTS: EventRow[] = seedData as EventRow[];
