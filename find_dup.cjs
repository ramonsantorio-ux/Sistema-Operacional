const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xucfprdbduvrjslasyrt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JhFa9TjXwOd2gy5-g2_6Gw_vwY2AqmD';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('events')
    .select('id, event_date, description, involved_name, location, equipment, shift, supervisor, created_at')
    .order('event_date', { ascending: true });

  if (error) {
    console.error('Erro ao buscar eventos:', error.message);
    process.exit(1);
  }

  console.log(`Total de eventos no banco: ${data.length}\n`);

  const normalize = (str) => {
    if (!str) return '';
    return str.split('||EXTRA||')[0].trim().toLowerCase().replace(/\s+/g, ' ');
  };

  // Agrupa por: data + descricao normalizada + nome envolvido
  const groups = {};
  for (const ev of data) {
    const desc = normalize(ev.description);
    const name = (ev.involved_name || '').trim().toLowerCase();
    const date = (ev.event_date || '').slice(0, 10);
    const key = `${date}|${desc}|${name}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(ev);
  }

  const duplicates = Object.entries(groups).filter(([, evs]) => evs.length > 1);

  if (duplicates.length === 0) {
    console.log('[OK] Nenhuma duplicidade encontrada!');
    return;
  }

  console.log(`[AVISO] Encontrados ${duplicates.length} grupo(s) com possiveis duplicidades:\n`);
  console.log('='.repeat(100));

  let totalDuplicateIds = 0;
  const idsToDelete = [];

  for (const [key, evs] of duplicates) {
    const parts = key.split('|');
    const date = parts[0];
    const desc = parts[1];
    const name = parts.slice(2).join('|');
    console.log(`\n[GRUPO] (${evs.length} registros)`);
    console.log(`   Data      : ${date}`);
    console.log(`   Descricao : "${desc || '(vazia)'}"`);
    console.log(`   Envolvido : "${name || '(nenhum)'}"`);
    const sorted = [...evs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const toKeep = sorted[0];
    const toDelete = sorted.slice(1);
    console.log(`   [MANTER]  ID: ${toKeep.id}  | criado: ${(toKeep.created_at || '').slice(0,19)}`);
    for (const d of toDelete) {
      console.log(`   [DELETAR] ID: ${d.id}  | criado: ${(d.created_at || '').slice(0,19)}`);
      totalDuplicateIds++;
      idsToDelete.push(d.id);
    }
    console.log('-'.repeat(100));
  }

  console.log(`\n--- RESUMO ---`);
  console.log(`Grupos com duplicidade : ${duplicates.length}`);
  console.log(`Registros a deletar    : ${totalDuplicateIds}`);
  console.log(`Registros a manter     : ${data.length - totalDuplicateIds}`);
  console.log(`\nIDs sugeridos para exclusao:`);
  console.log(JSON.stringify(idsToDelete));
}

main().catch(console.error);
