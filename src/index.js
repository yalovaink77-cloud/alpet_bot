require('dotenv').config();

const cron = require('node-cron');
const { APP_CONFIG } = require('../config/app');
const logger = require('./utils/logger');
const deduplicator = require('./utils/deduplicator');
const supabaseClient = require('./storage/supabaseClient');
const localNewsCollector = require('./collectors/localNewsCollector');
const companyDisclosureCollector = require('./collectors/companyDisclosureCollector');
const globalNewsCollector = require('./collectors/globalNewsCollector');
const cryptoNewsCollector = require('./collectors/cryptoNewsCollector');
const macroCalendarCollector = require('./collectors/macroCalendarCollector');
const tcmbCollector = require('./collectors/tcmbCollector');
const commodityNewsCollector = require('./collectors/commodityNewsCollector');
const eventNormalizer = require('./analyzers/eventNormalizer');
const historicalEventMatcher = require('./analyzers/historicalEventMatcher');
const marketReactionAnalyzer = require('./analyzers/marketReactionAnalyzer');
const decisionEngine = require('./analyzers/decisionEngine');
const riskGuard = require('./risk/riskGuard');
const orderManager = require('./execution/orderManager');
const telegram = require('./utils/telegramNotifier');
const paperPortfolio = require('./utils/paperPortfolio');
const { volatilityPositionSizer } = require('./risk/volatilityPositionSizer');

let isRunning = false;

async function collectNews() {
  const [localNews, disclosures, globalNews, cryptoNews, macroNews, tcmbNews, commodityNews] = await Promise.all([
    localNewsCollector.fetchAll(),
    companyDisclosureCollector.fetchAll(),
    globalNewsCollector.fetchAll(),
    cryptoNewsCollector.fetchAll(),
    macroCalendarCollector.fetchAll(),
    tcmbCollector.fetchAll(),
    commodityNewsCollector.fetchAll()
  ]);

  return [...localNews, ...disclosures, ...globalNews, ...cryptoNews, ...macroNews, ...tcmbNews, ...commodityNews];
}

async function processItem(item) {
  const rawNewsRecord = await supabaseClient.saveRawNews({
    sourceType: item.sourceType,
    sourceName: item.sourceName,
    externalId: item.externalId,
    title: item.title,
    rawContent: item.summary,
    url: item.url,
    publishedAt: item.publishedAt,
    detectedAt: new Date().toISOString(),
    contentHash: deduplicator.buildHash(item),
    metadata: { url: item.url || '' }
  });

  // Duplicate haber — DB'de zaten var, yeniden analiz etme
  if (!rawNewsRecord) return;

  const normalizedEvent = eventNormalizer.normalize(item);
  const storedEvent = await supabaseClient.saveNormalizedEvent({
    ...normalizedEvent,
    rawNewsId: rawNewsRecord.id
  });

  const matches = await historicalEventMatcher.findMatches(normalizedEvent);
  const reactionStats = await marketReactionAnalyzer.buildReactionStats(normalizedEvent, matches);

  for (const match of matches) {
    await supabaseClient.saveHistoricalMatch({
      eventId: storedEvent.id,
      matchedEventId: match.priorEvent.id || null,
      matchedEventKey: match.priorEvent.event_key || match.priorEvent.eventKey || null,
      similarityScore: match.similarityScore,
      matchedOn: match.matchContext,
      reactionStats: {
        eventType: match.priorEvent.event_type || match.priorEvent.eventType || null,
        sourceName: match.priorEvent.source_name || match.priorEvent.sourceName || null,
        publishedAt: match.priorEvent.published_at || match.priorEvent.publishedAt || null
      }
    });
  }

  if (reactionStats.length === 0) {
    logger.info('Normalized event has no mapped instruments, skipping signal creation', {
      eventType: normalizedEvent.eventType,
      title: normalizedEvent.title
    });
    return;
  }

  const signals = decisionEngine.buildSignals(normalizedEvent, reactionStats, matches);

  for (const signal of signals) {
    const riskAdjustedSignal = riskGuard.applyToSignal(signal, { openPositions: [] });
    const penaltyFlags = riskAdjustedSignal.scoreBreakdown.penaltyFlags;

    const storedSignal = await supabaseClient.saveSignal({
      eventId: storedEvent.id,
      instrument: riskAdjustedSignal.instrument,
      decision: riskAdjustedSignal.decision,
      direction: riskAdjustedSignal.direction,
      sourceScore: riskAdjustedSignal.scoreBreakdown.sourceScore,
      credibilityScore: riskAdjustedSignal.scoreBreakdown.credibilityScore,
      noveltyScore: riskAdjustedSignal.scoreBreakdown.noveltyScore,
      severityScore: riskAdjustedSignal.scoreBreakdown.severityScore,
      turkeyRelevanceScore: riskAdjustedSignal.scoreBreakdown.turkeyRelevanceScore,
      historicalSimilarityScore: riskAdjustedSignal.scoreBreakdown.historicalSimilarityScore,
      historicalConsistencyScore: riskAdjustedSignal.scoreBreakdown.historicalConsistencyScore,
      instrumentAlignmentScore: riskAdjustedSignal.scoreBreakdown.instrumentAlignmentScore,
      timingScore: riskAdjustedSignal.scoreBreakdown.timingScore,
      penaltyScore: riskAdjustedSignal.scoreBreakdown.penaltyScore,
      finalScore: riskAdjustedSignal.finalScore,
      tradeConfidence: riskAdjustedSignal.tradeConfidence,
      alreadyPricedPenalty: penaltyFlags.alreadyPricedPenalty,
      singleSourcePenalty: penaltyFlags.singleSourcePenalty,
      thematicOnlyPenalty: penaltyFlags.thematicOnlyPenalty,
      lowHistoryPenalty: penaltyFlags.lowHistoryPenalty,
      contradictoryHistoryPenalty: penaltyFlags.contradictoryHistoryPenalty,
      executionRiskPenalty: penaltyFlags.executionRiskPenalty,
      portfolioCrowdingPenalty: penaltyFlags.portfolioCrowdingPenalty,
      explanation: riskAdjustedSignal.explanation
    });

    if (riskAdjustedSignal.decision === 'EXECUTE') {
      const account = await paperPortfolio.getAccountSummary();
      const capital = (account && account.balance) || 40;
      const volSizing = await volatilityPositionSizer(riskAdjustedSignal.instrument, capital);
      const sizedSignal = {
        ...riskAdjustedSignal,
        positionSize: volSizing.positionSize,
        leverage: volSizing.leverage,
        volTargetMeta: volSizing,
      };
      const paperResult = await paperPortfolio.openPosition(sizedSignal);
      const updatedAccount = await paperPortfolio.getAccountSummary();
      telegram.notifySignal(sizedSignal, normalizedEvent, paperResult, updatedAccount);
    }

    if (riskAdjustedSignal.decision === 'EXECUTE' && riskAdjustedSignal.risk.allClear) {
      const execution = await orderManager.placeSignalOrder(riskAdjustedSignal);
      await supabaseClient.saveTrade({
        signalId: storedSignal.id,
        eventId: storedEvent.id,
        instrument: riskAdjustedSignal.instrument,
        direction: riskAdjustedSignal.direction,
        status: execution.status,
        brokerName: execution.broker,
        brokerOrderId: execution.brokerOrderId,
        executionNotes: {
          eventKey: normalizedEvent.eventKey,
          finalScore: riskAdjustedSignal.finalScore,
          tradeConfidence: riskAdjustedSignal.tradeConfidence,
          riskChecks: riskAdjustedSignal.risk.checks
        }
      });
    }
  }

  logger.info('Processed event', {
    eventType: normalizedEvent.eventType,
    sourceName: normalizedEvent.sourceName,
    instruments: normalizedEvent.candidateInstruments
  });
}

async function runCycle() {
  if (isRunning) {
    logger.warn('Previous cycle still running, skipping');
    return;
  }

  isRunning = true;

  try {
    await supabaseClient.saveAccountSnapshot({
      openPositionsCount: 0,
      dailyLossPct: 0,
      drawdownPct: 0,
      positions: [],
      metadata: {
        cycleStartedAt: new Date().toISOString(),
        liveTradingEnabled: APP_CONFIG.execution.liveTradingEnabled
      }
    });

    // Açık pozisyonları kontrol et (TP/SL)
    const closedPositions = await paperPortfolio.checkAndClosePositions();
    for (const pos of closedPositions) {
      const account = await paperPortfolio.getAccountSummary();
      telegram.notifyPositionClose(pos, account);
    }

    const items = await collectNews();
    const freshItems = deduplicator.filter(items);

    for (const item of freshItems) {
      await processItem(item);
    }

    logger.info('Cycle complete', { collected: items.length, fresh: freshItems.length });
  } catch (error) {
    logger.error('Main cycle failed', { error: error.message });
  } finally {
    isRunning = false;
  }
}

function start() {
  const schedule = APP_CONFIG.cronSchedule;
  logger.info('Starting ALPET', { schedule });
  cron.schedule(schedule, runCycle);
  runCycle().catch((error) => logger.error('Initial cycle failed', { error: error.message }));
}

if (require.main === module) {
  start();
}

module.exports = {
  start,
  runCycle
};