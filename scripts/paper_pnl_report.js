require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Açık pozisyonlar
  const { data: openPositions, error: openErr } = await sb
    .from('paper_positions')
    .select('*')
    .eq('status', 'open');
  if (openErr) { console.error('Açık pozisyonlar okunamadı:', openErr.message); return; }

  const openTotal = openPositions.reduce((sum, p) => sum + Number(p.position_usd || 0), 0);
  const openKar = openPositions.filter(p => Number(p.pnl_usd || 0) > 0).reduce((sum, p) => sum + Number(p.pnl_usd || 0), 0);
  const openZarar = openPositions.filter(p => Number(p.pnl_usd || 0) < 0).reduce((sum, p) => sum + Number(p.pnl_usd || 0), 0);

  // Kapalı pozisyonlar
  const { data: closedPositions, error: closedErr } = await sb
    .from('paper_positions')
    .select('*')
    .eq('status', 'closed');
  if (closedErr) { console.error('Kapalı pozisyonlar okunamadı:', closedErr.message); return; }

  const closedKar = closedPositions.filter(p => Number(p.pnl_usd || 0) > 0).reduce((sum, p) => sum + Number(p.pnl_usd || 0), 0);
  const closedZarar = closedPositions.filter(p => Number(p.pnl_usd || 0) < 0).reduce((sum, p) => sum + Number(p.pnl_usd || 0), 0);

  const netKarZarar = closedKar + closedZarar;

  console.log('--- KAR/ZARAR RAPORU ---');
  console.log('Açık pozisyonlarda toplam para: $', openTotal.toFixed(2));
  console.log('Açık pozisyonlarda toplam kar: $', openKar.toFixed(2));
  console.log('Açık pozisyonlarda toplam zarar: $', openZarar.toFixed(2));
  console.log('Kapanan pozisyonlarda toplam kar: $', closedKar.toFixed(2));
  console.log('Kapanan pozisyonlarda toplam zarar: $', closedZarar.toFixed(2));
  console.log('Kapanan pozisyonlarda NET:', netKarZarar >= 0 ? `KARDA ($${netKarZarar.toFixed(2)})` : `ZARARDA ($${netKarZarar.toFixed(2)})`);
}

main();
