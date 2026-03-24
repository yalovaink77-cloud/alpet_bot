require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await sb
    .from('event_signals')
    .select('instrument,direction,decision,final_score')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) { console.error('DB hatası:', error.message); return; }

  const g = {};
  data.forEach(s => {
    if (!g[s.instrument]) g[s.instrument] = { EXECUTE: 0, WAIT: 0, SKIP: 0 };
    g[s.instrument][s.decision] = (g[s.instrument][s.decision] || 0) + 1;
  });

  console.log('\n=== Market bazında son 50 sinyal ===');
  console.table(g);

  const ex = data.filter(s => s.decision === 'EXECUTE');
  console.log('\n=== EXECUTE sinyaller ===');
  if (ex.length === 0) {
    console.log('Henüz EXECUTE sinyal yok (skor eşiği aşılmadı)');
  } else {
    ex.forEach(s => console.log(' ', s.instrument.padEnd(10), s.direction.padEnd(6), 'skor:', s.final_score));
  }
}

main();
