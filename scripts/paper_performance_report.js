require('dotenv').config();
const paperPortfolio = require('../src/utils/paperPortfolio');

function fmtPct(x) {
  if (!Number.isFinite(x)) return '';
  return `${(x * 100).toFixed(1)}%`;
}

async function main() {
  const perf = await paperPortfolio.getClosedPerformanceByInstrument();
  const rows = Object.entries(perf)
    .map(([instrument, s]) => ({
      instrument,
      trades: s.trades,
      winRate: fmtPct(s.winRate),
      pnlSum: Number(s.pnlSum.toFixed(2)),
      avgPnl: Number(s.avgPnl.toFixed(4)),
    }))
    .sort((a, b) => b.pnlSum - a.pnlSum);

  console.log('\n=== PAPER PERFORMANCE (closed positions) ===');
  if (rows.length === 0) {
    console.log('No closed positions found.');
    return;
  }

  console.table(rows);

  const losers = rows.filter(r => r.pnlSum < 0);
  console.log(`\nLosers: ${losers.length}/${rows.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

